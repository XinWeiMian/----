// ============================================================
//  proxy.mjs —— 通义千问 + 通义万相 代理（POST + JSON body）
//  ⚠️ 当前为【强化探针版 v8-probe】：无论入参是什么都不会崩溃，
//     直接回显服务器收到的原始请求体，用于一锤定音排查线上版本/入参问题。
//  排查完成后需替换回正式版（v6 正式逻辑 + new Response + messages 字段）。
// ============================================================

export default async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return new Response("ok", { status: 200, headers: cors() });
  }

  const key = process.env.DASHSCOPE_API_KEY;

  // —— 读取原始请求体（绝不 parse 崩溃）——
  let bodyText = typeof event.body === "string" ? event.body : JSON.stringify(event.body || {});
  // 若 body 是 "[object ...]" 这类被字符串化的对象，原样保留，便于看清
  let parsed = null;
  let parseFailed = false;
  try { parsed = JSON.parse(bodyText); } catch (e) { parseFailed = true; }

  // 服务端所见（探针回显，绝不抛错）
  return new Response(JSON.stringify({
    hello: true,
    probeVersion: "v8-probe",
    server: {
      node: (typeof process !== "undefined" && process.version) ? process.version : "unknown",
      hasKey: !!key,
      keyTail: key ? String(key).slice(-4) : "",
      hasResponseGlobal: typeof Response !== "undefined",
    },
    received: {
      method: event.httpMethod,
      headers: event.headers ? {
        "content-type": event.headers["content-type"] || event.headers["Content-Type"] || null,
        "user-agent": event.headers["user-agent"] || event.headers["User-Agent"] || null,
        "x-forwarded-for": event.headers["x-forwarded-for"] || null,
      } : null,
      bodyIsString: typeof event.body === "string",
      bodyPreview: bodyText.slice(0, 300),
      bodyLength: bodyText.length,
      parseFailed,
      parsedKind: parsed ? parsed.kind : null,
    },
    hint: "这是探针回显。若 bodyPreview 是 [object ...]，说明前端/网关把对象字符串化当成 body 发出；请把本 JSON 原样贴给助手。",
  }), { status: 200, headers: { ...cors(), "Content-Type": "application/json; charset=utf-8" } });
}

function cors() {
  return { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
}
