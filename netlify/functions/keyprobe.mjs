const BASE = "dashscope.aliyuncs.com";

export async function handler(event, context) {
  const key = process.env.DASHSCOPE_API_KEY || "";

  // ---- 1. 收集 key 特征（绝不输出完整明文，只输出派生特征）----
  const features = {
    hasKey: key.length > 0,
    length: key.length,
    // 仅显示前 5 位中的判定用的关键信息，避免泄露完整 key
    startsWithDash: key.startsWith("-"),
    hasSkHead: /^sk-/.test(key) || key.startsWith("sk-"),
    first3: key.slice(0, 3).replace(/./g, "*"),       // 只回显前3位打码
    last4: key.slice(-4),                              // 尾部4位（简报里的 keyTail 习惯）
    hasSpace: /\s/.test(key),                          // 是否含空格/换行/制表符
    hasNewline: /[\r\n]/.test(key),
    hasQuote: /["']/.test(key),
    hasNonAscii: /[^\x20-\x7E]/.test(key),             // 是否含非 ASCII 字符（如中文/全角符号）
    onlyHex: /^[A-Fa-f0-9-]+$/.test(key.replace(/^sk-/, "")), // 主体是否纯十六进制
  };

  // ---- 2. key 明显格式异常的快速判定 ----
  const formatProblems = [];
  if (!features.hasKey) formatProblems.push("环境变量为空（未读到 DASHSCOPE_API_KEY）");
  if (!features.hasSkHead) formatProblems.push("key 不以 sk- 开头");
  if (key.length < 30) formatProblems.push(`key 长度过短（${key.length}，正常应 >30）`);
  if (features.hasSpace) formatProblems.push("key 含空白字符（空格/换行/制表符）");
  if (features.hasQuote) formatProblems.push("key 含引号");
  if (features.hasNonAscii) formatProblems.push("key 含非 ASCII 字符（粘贴中文/全角符号？）");

  // ---- 3. 若格式没问题，从服务端代发一次真实千问请求 ----
  let liveTest = null;
  if (formatProblems.length === 0) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20000);
      const resp = await fetch(`https://${BASE}/compatible-mode/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: "qwen-plus",
          messages: [{ role: "user", content: "ping" }],
          max_tokens: 4,
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);

      const bodyText = await resp.text();
      let parsed = null;
      try { parsed = JSON.parse(bodyText); } catch (_) {}

      if (resp.ok) {
        liveTest = { ok: true, status: resp.status, probe: "ok" };
      } else {
        const code = parsed && (parsed.code || (parsed.error && parsed.error.code)) || "?";
        const msg = parsed && (parsed.message || (parsed.error && parsed.error.message)) || bodyText.slice(0, 200);
        liveTest = {
          ok: false,
          probe: code && /[Kk]ey/.test(String(code)) && !/rate|limit|quota/i.test(String(msg))
            ? "error-key"       // 明确是 key 无效
            : "error-other",    // 网络通了但错误不是 key（可能是超额/模型/权限）
          status: resp.status,
          code: String(code),
          message: String(msg).slice(0, 300),
        };
      }
    } catch (e) {
      liveTest = { ok: false, probe: "network-error", error: String(e).slice(0, 300) };
    }
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      probe: "keyprobe",
      features,
      formatProblems,
      formatHealthy: formatProblems.length === 0,
      liveTest,
      conclusion:
        formatProblems.length > 0
          ? "KEY 格式有问题，见 formatProblems，请先在 Netlify 重新粘贴干净 key"
          : liveTest && liveTest.probe === "ok"
          ? "KEY 有效，请求成功"
          : liveTest && liveTest.probe === "error-key"
          ? "KEY 无效：请求已送达阿里云，但阿里云拒绝该 key（可能被禁用/过期/没有开通对应模型）"
          : liveTest && liveTest.probe === "error-other"
          ? "网络通但非 key 错误（超额/权限/模型未开通），请把 code/message 发给我"
          : "网络层异常，无法到达阿里云",
    }, null, 2),
  };
}
