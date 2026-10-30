import { getStore } from "@netlify/blobs";

const store = () =>
  getStore({ name: "fahrten", region: "eu-central-1", consistency: "strong" });

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const SLOTS = new Set(["hin", "rueck"]);

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

export default async (req) => {
  const url = new URL(req.url);
  const s = store();

  // GET /api/week?days=2026-11-02,2026-11-03,...
  if (req.method === "GET") {
    const days = (url.searchParams.get("days") || "").split(",").filter((d) => DATE.test(d)).slice(0, 14);
    const out = {};
    await Promise.all(
      days.flatMap((d) =>
        [...SLOTS].map(async (slot) => {
          const v = await s.get(`${d}/${slot}`, { type: "json" });
          if (v) out[`${d}/${slot}`] = v;
        })
      )
    );
    return json({ entries: out });
  }

  // POST /api/entry  {day, slot, name, note}
  if (req.method === "POST") {
    let body;
    try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }
    const { day, slot } = body || {};
    if (!DATE.test(day || "") || !SLOTS.has(slot)) return json({ error: "bad slot" }, 400);
    const name = String(body.name || "").trim().slice(0, 40);
    const note = String(body.note || "").trim().slice(0, 80);
    const key = `${day}/${slot}`;
    if (!name && !note) {
      await s.delete(key);
      return json({ ok: true, entry: null });
    }
    const entry = { name, note, at: Date.now() };
    await s.setJSON(key, entry);
    return json({ ok: true, entry });
  }

  return json({ error: "method" }, 405);
};

export const config = { path: ["/api/week", "/api/entry"] };
