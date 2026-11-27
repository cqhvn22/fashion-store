<?php
declare(strict_types=1);

/**
 * Upload this file to a PHP host and register its public HTTPS URL with PayOS.
 * Set the backend URL below, or set FASHIONHUB_PAYOS_WEBHOOK_TARGET on the host.
 * The Quarkus Order service verifies the PayOS signature and updates the order.
 */
$backendUrl = getenv('FASHIONHUB_PAYOS_WEBHOOK_TARGET')
    ?: 'https://YOUR_BACKEND_DOMAIN/api/v1/payments/payos/webhook';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function respond(int $status, bool $success): never
{
    http_response_code($status);
    echo json_encode(['success' => $success], JSON_UNESCAPED_SLASHES);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');
    respond(405, false);
}

if (!preg_match('~^application/json(?:\s*;|\s*$)~i', $_SERVER['CONTENT_TYPE'] ?? '')) {
    respond(415, false);
}

if (str_contains($backendUrl, 'YOUR_BACKEND_DOMAIN')
    || !filter_var($backendUrl, FILTER_VALIDATE_URL)
    || parse_url($backendUrl, PHP_URL_SCHEME) !== 'https'
    || parse_url($backendUrl, PHP_URL_PATH) !== '/api/v1/payments/payos/webhook') {
    error_log('FashionHub PayOS webhook target is not configured as a public HTTPS backend URL.');
    respond(503, false);
}

if (!function_exists('curl_init')) {
    error_log('FashionHub PayOS webhook requires the PHP cURL extension.');
    respond(503, false);
}

const MAX_BODY_BYTES = 1048576;
if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > MAX_BODY_BYTES) {
    respond(413, false);
}
$raw = file_get_contents('php://input', false, null, 0, MAX_BODY_BYTES + 1);
if ($raw === false || $raw === '' || strlen($raw) > MAX_BODY_BYTES) {
    respond(400, false);
}

try {
    $payload = json_decode($raw, true, 32, JSON_THROW_ON_ERROR);
} catch (JsonException) {
    respond(400, false);
}
if (!is_array($payload) || !isset($payload['data'], $payload['signature'])
    || !is_array($payload['data']) || !is_string($payload['signature'])) {
    respond(400, false);
}

$request = curl_init($backendUrl);
if ($request === false) {
    respond(503, false);
}
curl_setopt_array($request, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $raw,
    CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Accept: application/json'],
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_FOLLOWLOCATION => false,
    CURLOPT_CONNECTTIMEOUT => 5,
    CURLOPT_TIMEOUT => 15,
    CURLOPT_SSL_VERIFYPEER => true,
    CURLOPT_SSL_VERIFYHOST => 2,
]);
$response = curl_exec($request);
$status = (int) curl_getinfo($request, CURLINFO_HTTP_CODE);
if ($response === false) {
    error_log('FashionHub PayOS webhook forwarding failed: ' . curl_error($request));
}
curl_close($request);

if ($response === false || $status === 0) {
    respond(502, false);
}
if ($status >= 200 && $status < 300) {
    respond(200, true);
}

error_log('FashionHub PayOS webhook backend returned HTTP ' . $status);
respond($status >= 400 && $status <= 599 ? $status : 502, false);
