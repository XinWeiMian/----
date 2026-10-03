// ============================================================
//  modelStore.mjs —— 3D 模型库（Netlify Blobs）查重/列表/删除（Lambda 返回格式）
//  POST {op:"get", key}    命中返回 {found, meta}
//  POST {op:"list"}        列出全部
//  POST {op:"remove", key} 删除
//  ✅ 命名导出 + Lambda 返回 {statusCode,headers,body}
// ============================================================
import { getStore } from "@netlify/blobs";

const STORE = () => getStore("tripo3d");

export async function handler(event, context) {
  if (event.httpMethod === "OPTIONS") return ok("ok");
  try {
    const input = event.body ? JSON.parse(event.body) : {};
    const op = input.op || "get";
    const store = STORE();
    if (op === "get") {
      const key = input.key || "";
      const meta = await store.getJSON(`${key}.meta`).catch(() => null);
      return json(200, { found: !!meta, key, meta });
    }
    if (op === "list") {
      const items = [];
      for await (const entry of store.list()) {
        if (!entry.key.endsWith(".meta")) continue;
        const m = await store.getJSON(entry.key).catch(() => null);
        const base = entry.key.replace(/\.meta$/, "");
        items.push({ key: base, meta: m, modelUrl: `/.netlify/functions/getmodel?key=${encodeURIComponent(base)}` });
      }
      return json(200, { items });
    }
    if (op === "remove") {
      const key = input.key || "";
      await store.delete(`${key}.glb`).catch(() => {});
      await store.delete(`${key}.meta`).catch(() => {});
      return json(200, { removed: key });
    }
    return json(400, { error: "unknown op" });
  } catch (e) {
    return json(500, { error: String(e) });
  }
}

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };
}
function json(code, obj) {
  return {
    statusCode: code,
    headers: { ...cors(), "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(obj),
  };
}
function ok(body) {
  return { statusCode: 200, headers: { ...cors(), "Content-Type": "text/plain; charset=utf-8" }, body };
}
