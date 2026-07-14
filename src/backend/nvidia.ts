/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * NVIDIA client
 * -------------
 * Thin wrapper around NVIDIA's OpenAI-compatible Chat Completions API
 * (build.nvidia.com / NIM). NVIDIA serves open models such as
 * meta/llama-3.3-70b-instruct and needs no SDK — we talk to it over plain
 * `fetch`, so there is no extra dependency to install.
 *
 * The API key, model, and base URL are read from the environment
 * (NVIDIA_API_KEY / NVIDIA_MODEL / NVIDIA_BASE_URL). When the key is missing,
 * callers get `null` back and fall back to their existing heuristics, so the
 * app keeps working without a key.
 *
 * NOTE: these models are text-only — there is no image generation endpoint.
 * Image generation therefore always uses the Pollinations fallback.
 */

const DEFAULT_BASE_URL = "https://integrate.api.nvidia.com/v1";
const DEFAULT_MODEL = "meta/llama-3.3-70b-instruct";

/** Returns the configured NVIDIA API key + model + base URL, or null if not configured. */
export function getNvidiaConfig(): { apiKey: string; model: string; baseUrl: string } | null {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey || apiKey === "YOUR_API_KEY_HERE" || apiKey === "") {
    console.warn(
      "NVIDIA_API_KEY environment variable is not defined or is a placeholder. AI generation will use smart heuristic fallbacks."
    );
    return null;
  }
  return {
    apiKey,
    model: process.env.NVIDIA_MODEL || DEFAULT_MODEL,
    baseUrl: (process.env.NVIDIA_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, ""),
  };
}

/** True when a usable NVIDIA API key is configured. */
export function isNvidiaConfigured(): boolean {
  return getNvidiaConfig() !== null;
}

/**
 * Pulls a JSON object out of a model response. NVIDIA-hosted models don't all
 * honour a strict JSON response format, so the reply may be wrapped in
 * ```json fences or surrounded by prose. This strips fences and, failing that,
 * extracts the substring spanning the first `{` to the last `}`.
 */
function extractJson(content: string): string {
  let text = content.trim();

  // Strip a leading/trailing markdown code fence (```json ... ``` or ``` ... ```).
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced) {
    text = fenced[1].trim();
  }

  // If there's still surrounding prose, grab the outermost {...} block.
  if (!text.startsWith("{")) {
    const first = text.indexOf("{");
    const last = text.lastIndexOf("}");
    if (first !== -1 && last > first) {
      text = text.slice(first, last + 1);
    }
  }

  return text;
}

/**
 * Sends a prompt to NVIDIA and returns the model's response content as a
 * string, or null if NVIDIA is not configured.
 *
 * When `json` is true (the default) the model is asked to reply with a single
 * valid JSON object and the response is cleaned (fences/prose stripped) so the
 * caller can `JSON.parse` the result directly.
 *
 * Throws on network/API errors so callers can catch and fall back — matching
 * the previous call sites, which wrapped calls in try/catch.
 */
export async function nvidiaGenerateContent(
  prompt: string,
  opts: { json?: boolean; temperature?: number } = {}
): Promise<string | null> {
  const config = getNvidiaConfig();
  if (!config) return null;

  const json = opts.json !== false;
  const messages = [
    {
      role: "system",
      content: json
        ? "You are a precise assistant. Respond ONLY with a single valid JSON object that matches the structure the user requests. Do not include markdown fences, comments, or any prose outside the JSON."
        : "You are a precise, helpful assistant.",
    },
    { role: "user", content: prompt },
  ];

  // Guard against the request hanging forever (unreachable host, network
  // stall, provider hang, etc). Without this, a single slow/unreachable call
  // here blocks the entire product-seeding Promise.all in the wizard, which
  // makes the "Deploying Store..." button spin indefinitely with no error.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: opts.temperature ?? 0.7,
        max_tokens: 4096,
      }),
      signal: controller.signal,
    });
  } catch (err: any) {
    if (err?.name === "AbortError") {
      throw new Error("NVIDIA API request timed out after 12s.");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`NVIDIA API error ${response.status} ${response.statusText}: ${detail}`);
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") return null;

  return json ? extractJson(content) : content;
}
