// Server-only OpenAI client for the Exam Generator.
//
// Mirrors the shape of gemini.server.ts (typed errors, timeouts, one retry,
// Zod-validated structured output) but talks to OpenAI via the official SDK.
// The SDK is imported dynamically *inside* the call so this module stays out of
// any client bundle that transitively imports a *.functions.ts file. Keep all
// usage server-side; the API key is read from the environment and never shipped.
import type { z } from "zod";

export type OpenAIModelRole = "generation" | "audit" | "grading" | "default";

export class OpenAIGenerationError extends Error {
  constructor(
    message: string,
    readonly code: "unconfigured" | "timeout" | "provider" | "invalid_output",
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "OpenAIGenerationError";
  }
}

/** True when an API key is present, so callers can degrade gracefully. */
export function isOpenAIConfigured(): boolean {
  return Boolean(process.env["OPENAI_API_KEY"]);
}

/**
 * Resolve the model id for a role. `OPENAI_MODEL` is the default (gpt-4o-mini);
 * each role can be overridden independently so, for example, auditing or
 * written-answer grading can use a stronger model than bulk generation.
 */
export function resolveModel(role: OpenAIModelRole = "default"): string {
  const fallback = process.env["OPENAI_MODEL"] || "gpt-4o-mini";
  const byRole: Record<OpenAIModelRole, string | undefined> = {
    generation: process.env["OPENAI_MODEL_GENERATION"],
    audit: process.env["OPENAI_MODEL_AUDIT"],
    grading: process.env["OPENAI_MODEL_GRADING"],
    default: undefined,
  };
  return byRole[role] || fallback;
}

function isTransient(status: number | undefined): boolean {
  return (
    status === 408 || status === 409 || status === 429 || (status !== undefined && status >= 500)
  );
}

export interface GenerateOptions<T> {
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  /** Short schema name sent to OpenAI (structured outputs require one). */
  schemaName: string;
  model?: string;
  role?: OpenAIModelRole;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  retry?: boolean;
  /** Optional diagnostic sink; the concrete failure reason is written here. */
  diag?: { reason?: string };
}

/**
 * Request a single JSON object from OpenAI, validated against `schema` via the
 * SDK's structured-output helper. Throws OpenAIGenerationError on failure.
 *
 * IMPORTANT for schema authors: OpenAI strict structured outputs require every
 * property to be required — use `.nullable()` (never `.optional()`) for fields
 * that may be absent, and avoid unsupported Zod constructs (`.default()`,
 * `.record()` with dynamic keys, etc.).
 */
export async function generateOpenAIJson<T>(options: GenerateOptions<T>): Promise<T> {
  const {
    system,
    prompt,
    schema,
    schemaName,
    temperature = 0.3,
    maxTokens = 8000,
    timeoutMs = 90_000,
    retry = true,
    diag,
  } = options;

  const apiKey = process.env["OPENAI_API_KEY"];
  if (!apiKey) {
    throw new OpenAIGenerationError("AI generation is not configured.", "unconfigured");
  }
  const model = options.model || resolveModel(options.role);

  const { default: OpenAI } = await import("openai");
  const { zodResponseFormat } = await import("openai/helpers/zod");
  const client = new OpenAI({ apiKey, maxRetries: 0 });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const fail = (reason: string, code: OpenAIGenerationError["code"], cause?: unknown): never => {
    if (diag) diag.reason = reason;
    console.error(`[ExamGen][OpenAI] ${reason}`);
    throw new OpenAIGenerationError(userMessage(code), code, { cause: cause ?? reason });
  };

  try {
    const completion = await client.chat.completions.parse(
      {
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
        response_format: zodResponseFormat(schema, schemaName),
        temperature,
        max_completion_tokens: maxTokens,
      },
      { signal: controller.signal },
    );

    const choice = completion.choices[0];
    if (choice?.message.refusal) {
      return fail(`model refused: ${choice.message.refusal}`, "invalid_output");
    }
    if (choice?.finish_reason === "length") {
      // Output hit the token ceiling and was truncated — treat as a provider
      // issue so the caller can retry with a smaller batch rather than persist
      // half a JSON object.
      if (retry) return generateOpenAIJson({ ...options, retry: false });
      return fail(`output truncated at max_completion_tokens (${maxTokens})`, "provider");
    }
    const parsed = choice?.message.parsed as T | null | undefined;
    if (parsed === null || parsed === undefined) {
      if (retry) return generateOpenAIJson({ ...options, retry: false });
      return fail("model returned no parseable content", "invalid_output");
    }
    return parsed;
  } catch (error) {
    if (error instanceof OpenAIGenerationError) throw error;
    const aborted = error instanceof Error && error.name === "AbortError";
    if (aborted) {
      return fail(`request timed out after ${timeoutMs}ms`, "timeout", error);
    }
    const status = (error as { status?: number })?.status;
    if (retry && isTransient(status)) {
      clearTimeout(timeout);
      return generateOpenAIJson({ ...options, retry: false });
    }
    const message = error instanceof Error ? error.message : String(error);
    return fail(`request failed (${status ?? "no status"}): ${message}`, "provider", error);
  } finally {
    clearTimeout(timeout);
  }
}

function userMessage(code: OpenAIGenerationError["code"]): string {
  switch (code) {
    case "unconfigured":
      return "AI generation is not configured.";
    case "timeout":
      return "The AI service timed out. Your progress is saved — try continuing again.";
    case "invalid_output":
      return "The AI returned an unexpected response. Your progress is saved — try again.";
    default:
      return "The AI service is temporarily unavailable. Your progress is saved — try again.";
  }
}
