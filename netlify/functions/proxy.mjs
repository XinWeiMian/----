// ============================================================
//  proxy.mjs —— 通义千问 + 通义万相 代理（POST + JSON body）
//  ⚠️ 当前为【终极探针版 v8.2-probe】：绝不崩溃，把 event 对象
//     的所有字段 + 全部请求头 + body 真实类型/内容 全量回显。
//  排查完成后替换回正式版。
// ============================================================

export default async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return new Response("ok", { status: 200, headers: cors() });
  }

  const key = process.env.DASHSCOPE_API_KEY;
  const hdrs = event.headers || {};
  const eventKeys = Object.keys(event || {});
  const ownKeys = (typeof Reflect !== "undefined" && typeof Reflect.ownKeys === "function")
    ? (event ? Reflect.ownKeys(event).map(String) : []) : [];
  let eventFullJson = null;
  try { eventFullJson = JSON.stringify(event); } catch (e) { eventFullJson = "stringify-error:" + String(e); }

  // —— body 探测：兼容 字符串 / Buffer / TypedArray / 对象 / 空 ——
  function describeBody(b) {
    if (b === null || b === undefined) return { found: false, note: "event.body 是 null/undefined" };
    if (typeof b === "string") return { found: true, type: "string", length: b.length, preview: b.slice(0, 600) };
    if (Buffer.isBuffer && Buffer.isBuffer(b)) {
      const s = b.toString("utf8");
      return { found: true, type: "Buffer", length: s.length, preview: s.slice(0, 600), hexHead: b.slice(0, 40).toString("hex") };
    }
    if (ArrayBuffer.isView && ArrayBuffer.isView(b)) {
      const s = Buffer.from(b).toString("utf8");
      return { found: true, type: "TypedArray(" + b.constructor.name + ")", length: s.length, preview: s.slice(0, 600) };
    }
    try {
      const s = JSON.stringify(b);
      return { found: true, type: "object", length: (s || "").length, preview: (s || "").slice(0, 600) };
    } catch (e) {
      return { found: true, type: "object(unserializable)", note: String(e) };
    }
  }
  const bodyInfo = describeBody(event.body);

  // rawBody / isBase64Encoded 顺带看一下
  const rawInfo = (() => {
    if (event.rawBody === undefined && event.isBase64Encoded === undefined) return null;
    return {
      hasRawBody: event.rawBody !== undefined,
      rawBodyIsString: typeof event.rawBody === "string",
      isBase64Encoded: event.isBase64Encoded,
    };
  })();

  return new Response(JSON.stringify({
    hello: true,
    probeVersion: "v8.3-probe",
    server: {
      node: (typeof process !== "undefined" && process.version) ? process.version : "unknown",
      hasKey: !!key,
      keyTail: key ? String(key).slice(-4) : "",
      hasResponseGlobal: typeof Response !== "undefined",
    },
    received: {
      method: event.httpMethod,
      eventTopLevelKeys: eventKeys,
      eventOwnKeys: ownKeys,
      eventFullJson,
      allHeaders: hdrs,
      headerKeys: Object.keys(hdrs),
      body: bodyInfo,
      rawInfo,
    },
    hint: "v8.3 终极探针。把这整段 JSON 原样贴给助手。重点看 eventFullJson / eventOwnKeys / allHeaders / body。",
  }), { status: 200, headers: { ...cors(), "Content-Type": "application/json; charset=utf-8" } });
}

function cors() {
  return { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
}
