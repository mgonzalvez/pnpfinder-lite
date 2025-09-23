// functions/api/games.js
export async function onRequest(context) {
  const { SHEET_CSV_URL } = context.env;
  if (!SHEET_CSV_URL) {
    return new Response("Missing SHEET_CSV_URL", { status: 500 });
  }
  const upstream = await fetch(SHEET_CSV_URL, { cf: { cacheTtl: 300 } });
  if (!upstream.ok) {
    return new Response(`Upstream error ${upstream.status}`, { status: upstream.status });
  }
  const csv = await upstream.text();
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "cache-control": "public, max-age=300"
    }
  });
}
