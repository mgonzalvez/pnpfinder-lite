// Minimal POST echo: POST /api/echo -> echoes JSON body back
export async function onRequestPost({ request }) {
  const text = await request.text();
  return new Response(text || "{}", {
    headers: { "content-type": "application/json", "cache-control": "no-store" }
  });
}
