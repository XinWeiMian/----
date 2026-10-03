// ============================================================
//  getmodel.mjs —— 从 Netlify Blobs 取回 GLB 模型（GET，返回二进制）
//  GET /.netlify/functions/getmodel?key=xxx
//  ✅ 命名导出 + Lambda 返回格式（二进制用 Base64 + isBase64Encoded）
// ============================================================
import { getStore } from "@netlify/blobs";

export async function handler(event, context) {
  if (event.httpMethod === "OPTIONS") return ok("ok");
  try {
    const q = event.queryStringParameters || {};
    const key = Array.isArray(q.key) ? q.key[0] : (q.key || "");
    if (!key) return json(400, { error: "缺少 key" });
    const store = getStore("tripo3d");
    const buf = await store.get(`${key}.glb`);
    if (!buf) return json(404, { error: "模型不存在" });
    const arrayBuf = await buf.arrayBuffer();
    const base64 = Buffer.from(arrayBuf).toString("base64");
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "model/gltf-binary",
        "Content-Disposition": `inline; filename="${encodeURIComponent(key)}.glb"`,
      },
      isBase64Encoded: true,
      body: base64,
    };
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
