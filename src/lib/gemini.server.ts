import { z } from "zod";

type GeminiResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
};

export class GeminiGenerationError extends Error {
  constructor(
    message: string,
    readonly code: "unconfigured" | "timeout" | "provider" | "invalid_output",
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "GeminiGenerationError";
  }
}

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced?.[1] ?? text).trim();
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  return start >= 0 && end > start ? body.slice(start, end + 1) : body;
}

export async function generateGeminiJson<T>({
  systemInstruction,
  prompt,
  schema,
  temperature = 0.25,
  maxOutputTokens = 2048,
  timeoutMs = 20_000,
  retry = true,
}: {
  systemInstruction: string;
  prompt: string;
  schema: z.ZodType<T>;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
  retry?: boolean;
}): Promise<T> {
  const key = process.env["GEMINI_API_KEY"];
  if (!key) {
    throw new GeminiGenerationError("AI interactions are not configured.", "unconfigured");
  }
  // "gemini-flash-latest" is a served alias that tracks the current stable Flash
  // model, so a hardcoded version string can never drift to a 404 again.
  const model = process.env["GEMINI_MODEL"] || "gemini-flash-latest";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        signal: controller.signal,
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature,
            maxOutputTokens,
            responseMimeType: "application/json",
          },
        }),
      },
    );
    if (!response.ok) {
      const temporary =
        response.status === 408 ||
        response.status === 409 ||
        response.status === 429 ||
        response.status >= 500;
      if (retry && temporary) {
        return generateGeminiJson({
          systemInstruction,
          prompt,
          schema,
          temperature,
          maxOutputTokens,
          timeoutMs,
          retry: false,
        });
      }
      const body = (await response.text().catch(() => "")).slice(0, 300);
      console.error(
        `[Gemini] request failed: ${response.status} ${response.statusText} (model ${model})`,
        body,
      );
      throw new GeminiGenerationError("The AI service is temporarily unavailable.", "provider", {
        cause: `Gemini HTTP ${response.status} ${response.statusText} for model "${model}". ${body}`,
      });
    }
    const payload = (await response.json()) as GeminiResponse;
    const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new GeminiGenerationError("The AI returned an empty response.", "provider");
    let decoded: unknown;
    try {
      decoded = JSON.parse(extractJson(text));
    } catch {
      if (retry) {
        return generateGeminiJson({
          systemInstruction,
          prompt,
          schema,
          temperature,
          maxOutputTokens,
          timeoutMs,
          retry: false,
        });
      }
      throw new GeminiGenerationError("The AI response was not valid JSON.", "invalid_output");
    }
    const parsed = schema.safeParse(decoded);
    if (parsed.success) return parsed.data;
    if (retry) {
      return generateGeminiJson({
        systemInstruction,
        prompt,
        schema,
        temperature,
        maxOutputTokens,
        timeoutMs,
        retry: false,
      });
    }
    throw new GeminiGenerationError(
      "The AI response did not match the required format.",
      "invalid_output",
    );
  } catch (error) {
    if (error instanceof GeminiGenerationError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new GeminiGenerationError("The AI response timed out.", "timeout");
    }
    if (retry) {
      return generateGeminiJson({
        systemInstruction,
        prompt,
        schema,
        temperature,
        maxOutputTokens,
        timeoutMs,
        retry: false,
      });
    }
    throw new GeminiGenerationError("The AI service could not be reached.", "provider");
  } finally {
    clearTimeout(timeout);
  }
}
