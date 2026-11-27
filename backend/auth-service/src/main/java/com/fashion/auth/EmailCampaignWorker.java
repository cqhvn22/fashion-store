package com.fashion.auth;

import com.fashion.common.Sql;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.jboss.logging.Logger;

import javax.sql.DataSource;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@ApplicationScoped
class EmailCampaignWorker {
    private static final Logger LOG = Logger.getLogger(EmailCampaignWorker.class);
    private static final Pattern EMPHASIS = Pattern.compile("\\*\\*([^*\\n]+)\\*\\*|\\*([^*\\n]+)\\*");
    @Inject DataSource database;
    @Inject ObjectMapper json;
    @Inject ResendMail mail;

    @Scheduled(every = "1s", concurrentExecution = Scheduled.ConcurrentExecution.SKIP)
    void deliverPending() {
        if (!mail.configured()) return;
        Sql.update(database, """
            UPDATE email_campaign_recipients r SET status='FAILED',last_error='Đã hết thời gian thử gửi'
            FROM email_campaigns c WHERE c.id=r.campaign_id AND c.created_at<now()-interval '23 hours'
                AND r.status IN ('QUEUED','SENDING') AND r.next_attempt_at<=now()
            """);
        var pending = Sql.list(database, """
            WITH claimed AS (
                SELECT r.id FROM email_campaign_recipients r
                WHERE r.status IN ('QUEUED','SENDING') AND r.next_attempt_at<=now()
                ORDER BY r.next_attempt_at,r.id LIMIT 4 FOR UPDATE SKIP LOCKED
            )
            UPDATE email_campaign_recipients r SET status='SENDING',attempts=r.attempts+1,
                next_attempt_at=now()+interval '2 minutes'
            FROM claimed WHERE r.id=claimed.id RETURNING r.id,r.campaign_id,r.email,r.attempts
            """);
        if (pending.isEmpty()) return;
        try (var pool = Executors.newVirtualThreadPerTaskExecutor()) {
            var work = pending.stream().map(row -> pool.submit(() -> deliver(row))).toList();
            for (Future<?> task : work) task.get();
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
        } catch (java.util.concurrent.ExecutionException error) {
            LOG.error("Email campaign worker failed", error.getCause());
        }
    }

    private void deliver(Map<String, Object> row) {
        Object id = row.get("id");
        String email = (String) row.get("email");
        var subscription = Sql.one(database, "SELECT token FROM newsletter_subscriptions WHERE email=? AND unsubscribed_at IS NULL", email);
        if (subscription == null) {
            update(row, "SKIPPED", null, 0);
            return;
        }
        int attempt = (int) row.get("attempts");
        if (attempt > 5) {
            update(row, "FAILED", "Đã vượt số lần thử gửi", 0);
            return;
        }
        var campaign = Sql.one(database, "SELECT content::text AS content FROM email_campaigns WHERE id=?", row.get("campaignId"));
        if (campaign == null) return;
        EmailCampaignResource.Content content;
        try {
            content = json.readValue((String) campaign.get("content"), EmailCampaignResource.Content.class);
        } catch (java.io.IOException error) {
            update(row, "FAILED", "Nội dung email không hợp lệ", 0);
            return;
        }
        String token = subscription.get("token").toString();
        String unsubscribe = mail.siteUrl() + "/newsletter/unsubscribe?token=" + token;
        String oneClick = mail.siteUrl() + "/api/v1/newsletter/unsubscribe/" + token;
        var result = mail.send(email, content.subject().trim(), render(content, unsubscribe),
                text(content, unsubscribe), "campaign/" + id, Map.of(
                    "List-Unsubscribe", "<" + oneClick + ">",
                    "List-Unsubscribe-Post", "List-Unsubscribe=One-Click"));
        if (result.accepted()) update(row, "ACCEPTED", null, 0);
        else if (result.retryable() && attempt < 5) {
            update(row, "QUEUED", result.error(), Math.max(15 << (attempt - 1), result.retryAfter()));
        } else update(row, "FAILED", result.error(), 0);
    }

    private void update(Map<String, Object> row, String status, String error, int delay) {
        Sql.update(database, "UPDATE email_campaign_recipients SET status=?,last_error=?,"
                + "next_attempt_at=now()+make_interval(secs=>?) WHERE id=? AND status='SENDING' AND attempts=?",
                status, error, delay, row.get("id"), row.get("attempts"));
    }

    private static String render(EmailCampaignResource.Content c, String unsubscribe) {
        String photo = EmailCampaignResource.blank(c.imageUrl()) ? "" :
                "<img width=\"600\" style=\"display:block;width:100%;height:auto;border:0\" src=\""
                        + escape(c.imageUrl()) + "\" alt=\"" + escape(c.imageAlt()) + "\">";
        String button = EmailCampaignResource.blank(c.buttonText()) ? "" :
                "<p style=\"margin:28px 0\"><a style=\"display:inline-block;background:#d90016;color:white;padding:14px 24px;"
                        + "font-weight:bold;text-decoration:none\" href=\"" + escape(c.buttonUrl()) + "\">"
                        + escape(c.buttonText()) + "</a></p>";
        String body = escape(c.body()).replace("\r\n", "\n").replace("\r", "\n").replaceAll("(?m)^- ", "• ");
        body = EMPHASIS.matcher(body).replaceAll(match -> Matcher.quoteReplacement(match.group(1) != null
                ? "<strong>" + match.group(1) + "</strong>" : "<em>" + match.group(2) + "</em>")).replace("\n", "<br>");
        return """
            <!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
            <body style="margin:0;background:#f3f3f3;font-family:Arial,sans-serif;color:#191919">
            <span style="display:none;max-height:0;overflow:hidden;mso-hide:all">%s</span>
            <table role="presentation" width="100%%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:24px 10px">
            <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fff">
            <tr><td style="background:#191919;color:white;padding:20px 28px;font-size:20px;font-weight:bold">FASHIONHUB</td></tr>
            <tr><td>%s</td></tr><tr><td style="padding:28px">
            <h1 style="font-size:28px;margin:0 0 16px">%s</h1>
            <p style="font-size:16px;line-height:1.7;margin:0">%s</p>%s</td></tr>
            <tr><td style="background:#eee;padding:20px 28px;font-size:12px;color:#444">Bạn nhận email này vì đã đăng ký bản tin FashionHub.
            <a href="%s" style="color:#333">Hủy đăng ký</a></td></tr>
            </table></td></tr></table></body></html>
            """.formatted(escape(c.preheader()), photo, escape(c.title()), body, button, escape(unsubscribe));
    }

    private static String text(EmailCampaignResource.Content c, String unsubscribe) {
        String body = EMPHASIS.matcher(c.body()).replaceAll("$1$2");
        return "FashionHub\n\n" + c.title() + "\n\n" + body
                + (EmailCampaignResource.blank(c.buttonText()) ? "" : "\n\n" + c.buttonText() + ": " + c.buttonUrl())
                + "\n\nHủy đăng ký bản tin: " + unsubscribe;
    }

    private static String escape(String value) {
        return value == null ? "" : value.trim().replace("&", "&amp;").replace("<", "&lt;")
                .replace(">", "&gt;").replace("\"", "&quot;").replace("'", "&#39;");
    }
}
