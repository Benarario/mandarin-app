import "server-only";
import type { TtsProvider } from "./types";
import { EdgeTtsProvider } from "./edge";

let provider: TtsProvider | null = null;

/**
 * Returns the active TTS provider. Phase 1 uses edge-tts. When Azure keys are
 * present (Phase 2) an AzureTtsProvider can be returned here with no other
 * code changes — callers only depend on the TtsProvider interface.
 */
export function getTtsProvider(): TtsProvider {
  if (provider) return provider;
  // if (process.env.AZURE_SPEECH_KEY) provider = new AzureTtsProvider();
  provider = new EdgeTtsProvider();
  return provider;
}

export type { TtsProvider, VoiceGender } from "./types";
