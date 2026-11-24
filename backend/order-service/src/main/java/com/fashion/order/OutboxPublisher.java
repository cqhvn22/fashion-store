package com.fashion.order;

import com.fashion.common.Sql;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import io.quarkus.scheduler.Scheduled;
import jakarta.annotation.PreDestroy;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import javax.sql.DataSource;
import org.apache.kafka.clients.producer.KafkaProducer;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.common.serialization.StringSerializer;
import org.eclipse.microprofile.config.inject.ConfigProperty;

@ApplicationScoped
public class OutboxPublisher {
    @Inject DataSource database;
    @Inject ObjectMapper json;
    @ConfigProperty(name = "kafka.bootstrap.servers") String brokers;
    private KafkaProducer<String, String> producer;

    @Scheduled(every = "5s", concurrentExecution = Scheduled.ConcurrentExecution.SKIP)
    void publish() {
        List<Map<String, Object>> pending = Sql.list(database,
                "SELECT id,aggregate_id,event_type,payload::text AS payload FROM outbox_events WHERE published_at IS NULL ORDER BY created_at LIMIT 50");
        for (Map<String, Object> event : pending) {
            try {
                ObjectNode payload = (ObjectNode) json.readTree((String) event.get("payload"));
                payload.put("eventId", event.get("id").toString());
                producer().send(new ProducerRecord<>((String) event.get("eventType"),
                        event.get("aggregateId").toString(), json.writeValueAsString(payload)))
                        .get(5, TimeUnit.SECONDS);
                Sql.update(database,
                        "UPDATE outbox_events SET published_at=now(),publish_attempts=publish_attempts+1 WHERE id=? AND published_at IS NULL",
                        event.get("id"));
            } catch (Exception error) {
                Sql.update(database,
                        "UPDATE outbox_events SET publish_attempts=publish_attempts+1 WHERE id=?",
                        event.get("id"));
                break;
            }
        }
    }

    private synchronized KafkaProducer<String, String> producer() {
        if (producer == null) {
            Properties properties = new Properties();
            properties.put("bootstrap.servers", brokers);
            properties.put("key.serializer", StringSerializer.class.getName());
            properties.put("value.serializer", StringSerializer.class.getName());
            properties.put("acks", "all");
            properties.put("enable.idempotence", "true");
            producer = new KafkaProducer<>(properties);
        }
        return producer;
    }

    @PreDestroy
    void close() {
        if (producer != null) producer.close(Duration.ofSeconds(3));
    }
}
