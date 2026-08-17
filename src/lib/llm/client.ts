/** Provider-agnostic LLM client — OpenAI-compatible chat completions (server-side only). */

export interface LlmConfig {
  host: string;
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmResponse {
  content: string;
  model: string;
  usage?: { promptTokens: number; completionTokens: number };
}

export class LlmError extends Error {
  status?: number;
  code?: string;
  constructor(message: string, opts?: { status?: number; code?: string }) {
    super(message);
    this.name = "LlmError";
    this.status = opts?.status;
    this.code = opts?.code;
  }
}

function normalizeHost(host: string): string {
  return host.replace(/\/+$/, "");
}

export async function callLlm(config: LlmConfig, messages: LlmMessage[]): Promise<LlmResponse> {
  const url = `${normalizeHost(config.host)}/chat/completions`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: config.temperature,
        max_tokens: config.maxTokens,
      }),
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timeout);
    if ((e as Error).name === "AbortError") throw new LlmError("Request timed out after 30s — check host connectivity.", { code: "timeout" });
    throw new LlmError(`Network error: ${(e as Error).message}`, { code: "network" });
  }
  clearTimeout(timeout);

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let detail = text.slice(0, 600);
    try {
      const j = JSON.parse(text) as { error?: { message?: string } };
      if (j.error?.message) detail = j.error.message;
    } catch { /* use text */ }
    if (res.status === 401) throw new LlmError(`Invalid API key (401). ${detail}`, { status: 401, code: "auth" });
    if (res.status === 404) throw new LlmError(`Host or model not found (404). Check host/model. ${detail}`, { status: 404, code: "not_found" });
    if (res.status === 429) throw new LlmError(`Rate limited (429). ${detail}`, { status: 429, code: "rate_limit" });
    throw new LlmError(`LLM request failed (${res.status}). ${detail}`, { status: res.status });
  }

  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    model?: string;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const content = json.choices?.[0]?.message?.content ?? "";
  if (!content) throw new LlmError("Empty response from LLM.", { code: "empty" });
  return {
    content,
    model: json.model ?? config.model,
    usage: json.usage ? { promptTokens: json.usage.prompt_tokens ?? 0, completionTokens: json.usage.completion_tokens ?? 0 } : undefined,
  };
}
