import "server-only";
import { assertOnlyTaught } from "@/lib/graph/gate";

// Optional RAG-constrained explanation layer. OFF unless ANTHROPIC_API_KEY is
// set — without it the app uses the authored function-word notes + sourced
// glosses (a complete fallback). When enabled, any model output is constrained
// to the learner's taught vocabulary and validated by assertOnlyTaught before
// it can be shown (spec §3.5).

export function llmEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/** The system instruction every LLM feature must use (anti-fabrication). */
export const GROUNDING_SYSTEM_PROMPT = `You are a Mandarin tutor for a beginner.
Only use Chinese characters and words that appear in the provided ALLOWED-VOCABULARY list.
Only state facts present in the provided dictionary context.
Never introduce a character or word not in the allowed list.
Never invent pinyin, tones, or definitions. If you cannot comply, say so plainly in English.`;

export interface LlmExplainRequest {
  userId: string;
  sentence: string;
  word: string;
  glosses: string[];
}

/**
 * Returns a one-line, sentence-specific explanation, or null to fall back to the
 * authored/sourced path. The actual Claude call is wired when the key is added
 * (so it can be verified against the live API); until then this safely returns
 * null and every caller degrades to authored content.
 */
export async function explainWithLLM(req: LlmExplainRequest): Promise<string | null> {
  if (!llmEnabled()) return null;

  // Placeholder for the constrained Claude Messages call. When enabled, the
  // response MUST be validated before use:
  //   const out = await callClaude(...)
  //   const { ok } = await assertOnlyTaught(req.userId, out);
  //   return ok ? out : null;
  void assertOnlyTaught; // keep the guard wired for when this is enabled
  return null;
}
