/**
 * CENTURY SOLUTION — Shared store (Netlify Blobs)
 * Zero external DB keys. Works after Netlify deploy with functions.
 */
import { getStore } from "@netlify/blobs";

const STORE_NAME = "century-solution-data";
const KEYS_INDEX = "__keys__";

function cors(resBody, status = 200, extra = {}) {
  return new Response(typeof resBody === "string" ? resBody : JSON.stringify(resBody), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      ...extra,
    },
  });
}

export default async (req) => {
  if (req.method === "OPTIONS") return cors("", 204);

  let store;
  try {
    store = getStore(STORE_NAME);
  } catch (e) {
    return cors({ error: "Blobs unavailable", detail: String(e) }, 500);
  }

  try {
    if (req.method === "GET") {
      const url = new URL(req.url);
      const key = url.searchParams.get("key");
      if (key) {
        const value = await store.get(key);
        if (value == null) return cors({ key, value: null });
        return cors({ key, value });
      }
      // list all known keys
      const idx = await store.get(KEYS_INDEX);
      const keys = idx ? JSON.parse(idx) : [];
      const data = {};
      for (const k of keys) {
        const v = await store.get(k);
        if (v != null) data[k] = v;
      }
      return cors({ data });
    }

    if (req.method === "POST") {
      const body = await req.json();
      // body: { key, value } OR { data: { key: value, ... } }
      const indexRaw = await store.get(KEYS_INDEX);
      let keys = indexRaw ? JSON.parse(indexRaw) : [];

      if (body && body.data && typeof body.data === "object") {
        for (const [k, v] of Object.entries(body.data)) {
          if (k === "cs9_session") continue;
          await store.set(k, typeof v === "string" ? v : JSON.stringify(v));
          if (!keys.includes(k)) keys.push(k);
        }
        await store.set(KEYS_INDEX, JSON.stringify(keys));
        return cors({ ok: true, count: Object.keys(body.data).length });
      }

      if (body && body.key) {
        const k = body.key;
        const v = typeof body.value === "string" ? body.value : JSON.stringify(body.value ?? "");
        await store.set(k, v);
        if (!keys.includes(k)) keys.push(k);
        await store.set(KEYS_INDEX, JSON.stringify(keys));
        return cors({ ok: true, key: k });
      }

      return cors({ error: "Invalid body" }, 400);
    }

    return cors({ error: "Method not allowed" }, 405);
  } catch (e) {
    return cors({ error: String(e.message || e) }, 500);
  }
};

export const config = { path: ["/store", "/api/store"] };
