// Quick liveness check: GET /api/ping -> {"ok":true,...}
export async function onRequest() {
  return new Response(JSON.stringify({ ok: true, now: new Date().toISOString() }), {
    headers: { "content-type": "application/json", "cache-control": "no-store" }
  });
}
