// ============================================================
//  submit3d.mjs —— 临时【终极探针版 v8.2-submit-probe】
//  ⚠️ 与 proxy v8.2 一致：把 event 所有字段 + 全部请求头 + body 真实内容 全量回显。
//  排查完成后替换回正式提交逻辑。
// ============================================================

export default async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return new Response("ok", { status: 200, headers: cors() });
  }
  const key = process.env.DASHSCOPE_API_KEY;
  const hdrs = event.headers || {};
  const eventKeys = Object.keys(event || {});

  function describeBody(b) {
    if (b === null || b === undefined) return { found: false, note: "event.body 是 null/undefined" };
    if (typeof b === "string") return { found: true, type: "string", length: b.length, preview: b.slice(0, 600) };
    if (Buffer.isBuffer && Buffer.isBuffer(b)) {
      const s = b.toString("utf8");
      return { found: true, type: "Buffer", length: s.length, preview: s.slice(0, 600) };
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

  return new Response(JSON.stringify({
    hello: true,
    submitProbeVersion: "v8.2-submit-probe",
    server: {
      node: (typeof process !== "undefined" && process.version) ? process.version : "unknown",
      hasKey: !!key,
      keyTail: key ? String(key).slice(-4) : "",
      hasResponseGlobal: typeof Response !== "undefined",
    },
    received: {
      method: event.httpMethod,
      eventTopLevelKeys: eventKeys,
      allHeaders: hdrs,
      headerKeys: Object.keys(hdrs),
      body: bodyInfo,
    },
    hint: "v8.2 终极探针。把这整段 JSON 原样贴给助手。",
  }), { status: 200, headers: { ...cors(), "Content-Type": "application/json; charset=utf-8" } });
}

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };
}
