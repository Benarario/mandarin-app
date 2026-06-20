export type VoiceGender = "female" | "male";

/** A text-to-speech backend. Implementations: edge-tts (dev), Azure (prod). */
export interface TtsProvider {
  readonly name: string;
  synthesize(text: string, gender: VoiceGender): Promise<Buffer>;
}
