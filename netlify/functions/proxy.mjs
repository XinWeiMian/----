// ============================================================
//  proxy.mjs —— 终极探针 v8.5（命名导出 + LAMBDA 返回格式）
//  目标：确认当前 Netlify 运行时究竟期望哪种 handler 返回格式。
//    - v8.3 export default + Web Response → 能回 hello:true 但 event 空壳
//    - v8.4 命名导出 + Web Response      → 502 "invalid status code from lambda: 0"
//  本版 v8.5：命名导出 + 返回 {statusCode, headers, body}(Lambda 格式)，
//  并完整回显 event / context，验证运行时吃不吃 Lambda 格式。
// ============================================================

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json; charset=utf-8",
  };
}

function safeStr(v) {
  try { return JSON.stringify(v); } catch (e) { return "stringify-error:" + String(e); }
}

function describeBody(v) {
  if (typeof v === "string") {
    let preview = v.slice(0, 600);
    let parsed = null, parseFailed = false;
    try { parsed = JSON.parse(v); } catch (e) { parseFailed = true; }
    return { found: true, kind: "string", length: v.length, preview, parsed, parseFailed };
  }
  if (v === undefined || v === null) return { found: false, kind: String(v), value: v };
  if (Buffer && Buffer.isBuffer(v)) {
    const s = v.toString("utf8");
    return { found: true, kind: "Buffer", byteLength: v.length, preview: s.slice(0, 600) };
  }
  if (v instanceof Uint8Array) {
    let s; try { s = new TextDecoder().decode(v); } catch (e) { s = String(v); }
    return { found: true, kind: "Uint8Array", byteLength: v.length, preview: s.slice(0, 600) };
  }
  return { found: true, kind: typeof v, preview: safeStr(v).slice(0, 600) };
}

export async function handler(event, context) {
  const key = process.env.DASHSCOPE_API_KEY || "";
  const bodyInfo = describeBody(event && event.body);
  const ownKeys = (event && typeof Reflect !== "undefined" && Reflect.ownKeys)
    ? Reflect.ownKeys(event).map(String) : [];
  const contextKeys = (context && typeof context === "object") ? Object.keys(context) : [];
  let eventJson = null, contextJson = null;
  try { eventJson = JSON.stringify(event); } catch (e) { eventJson = "stringify-error:" + String(e); }
  try { contextJson = JSON.stringify(context); } catch (e) { contextJson = "stringify-error:" + String(e); }

  const data = {
    hello: true,
    probeVersion: "v8.5-probe",
    server: {
      node: process.version,
      hasKey: !!key,
      keyTail: key ? key.slice(-4) : null,
      hasResponseGlobal: typeof Response !== "undefined",
    },
    received: {
      httpMethod: event ? event.httpMethod : undefined,
      eventTopLevelKeys: event ? Object.keys(event) : [],
      eventOwnKeys: ownKeys,
      eventJson,
      contextTopLevelKeys: contextKeys,
      contextJson,
      allHeaders: (event && event.headers) || {},
      headerKeys: event ? Object.keys(event.headers || {}) : [],
      body: bodyInfo,
    },
    format: "v8.5 lambda-object-response",
    hint: "本版返回 Lambda 格式 {statusCode,headers,body}。若 Netlify 报 unsupported value 则运行时吃 Web Response；若正常则吃 Lambda 格式。请把本 JSON 原样贴给助手。",
  };

  const body = JSON.stringify(data);
  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
    body,
  };
}
