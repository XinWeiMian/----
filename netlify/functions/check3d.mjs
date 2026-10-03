// ============================================================
//  check3d.mjs —— Tripo 任务轮询 + 成功后存 Netlify Blobs（Lambda 返回格式）
//  POST {taskId, storageKey, meta:{...}}
//  返回: {status, modelUrl, meta}   (modelUrl 指向 getmodel 流式端点)
//  ✅ 命名导出 + Lambda 返回 {statusCode,headers,body}
// ============================================================
import { getStore } from "@netlify/blobs";

const TASK_URL = (id) => `https://maas.qianwenaiapi.com/api/v1/tasks/${id}`;

export async function handler(event, context) {
  if (event.httpMethod === "OPTIONS") return ok("ok");
  const key = process.env.DASHSCOPE_API_KEY;
  if (!key) return json(500, { error: "缺少 DASHSCOPE_API_KEY" });
  try {
    const input = event.body ? JSON.parse(event.body) : {};
    const taskId = input.taskId;
    if (!taskId) return json(400, { error: "缺少 taskId" });
    const resp = await fetch(TASK_URL(taskId), { headers: { "Authorization": `Bearer ${key}` } });
    const text = await resp.text();
    let j; try { j = JSON.parse(text); } catch (e) { j = { raw: text }; }
    const status = j.output && j.output.task_status;
    if (status === "SUCCEEDED") {
      const results = j.output.results || [];
      const pbr = results[0] && results[0].pbr_model_url;
      const preview = results[0] && results[0].rendered_image_url;
      const storageKey = input.storageKey;
      let saved = false;
      if (storageKey && pbr) {
        try {
          const dl = await fetch(pbr);
          const buf = Buffer.from(await dl.arrayBuffer());
          const store = getStore("tripo3d");
          await store.set(`${storageKey}.glb`, buf);
          await store.setJSON(`${storageKey}.meta`, {
            prompt: (input.meta || {}).prompt || "",
            name: (input.meta || {}).name || "",
            imageUrl: (input.meta || {}).imageUrl || "",
          });
          saved = true;
        } catch (e) { /* 存储失败不阻断 */ }
      }
      return json(200, { status, modelUrl: saved ? `/.netlify/functions/getmodel?key=${encodeURIComponent(storageKey)}` : pbr, preview, saved });
    }
    return json(200, { status: status || "UNKNOWN" });
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
