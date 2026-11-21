/**
 * Endpoint OTLP default — nilainya sama dengan default SettingScreen
 * (`otelExporterOtlpEndpoint` di settingStore).
 */
export const DEFAULT_TELEMETRY_ENDPOINT = 'http://localhost:4318';

/**
 * Menormalkan endpoint OTLP dari setting menjadi objek `URL`.
 *
 * Nilai dari form bisa berupa `localhost:4318`, `http://10.0.0.5:4318`,
 * atau `https://telemetry.contoh.com`. Bila skema belum ada, `http://`
 * ditambahkan agar `new URL()` tidak gagal.
 *
 * @param {string} endpoint - Endpoint dari setting aplikasi.
 * @returns {URL} URL valid (fallback ke endpoint default bila tidak valid).
 */
export function normalizeTelemetryEndpoint(endpoint) {
  const raw = String(endpoint ?? '').trim();
  if (!raw) return new URL(DEFAULT_TELEMETRY_ENDPOINT);

  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw)
    ? raw
    : `http://${raw}`;

  try {
    const url = new URL(withScheme);
    if (!url.hostname) return new URL(DEFAULT_TELEMETRY_ENDPOINT);
    return url;
  } catch {
    return new URL(DEFAULT_TELEMETRY_ENDPOINT);
  }
}

/**
 * Origin endpoint OTLP, dipakai untuk membuka UI otel-gui.
 * Contoh: `http://10.0.0.5:4318/v1/traces` → `http://10.0.0.5:4318`.
 *
 * @param {string} endpoint - Endpoint dari setting aplikasi.
 * @returns {string} Origin URL.
 */
export function resolveTelemetryUrl(endpoint) {
  return normalizeTelemetryEndpoint(endpoint).origin;
}

/**
 * Port yang harus dipakai otel-gui (`PORT`) agar sesuai endpoint OTLP.
 *
 * @param {string} endpoint - Endpoint dari setting aplikasi.
 * @returns {number} Port endpoint (default 4318).
 */
export function resolveTelemetryPort(endpoint) {
  const url = normalizeTelemetryEndpoint(endpoint);
  if (url.port) return Number(url.port);
  return url.protocol === 'https:' ? 443 : 80;
}
