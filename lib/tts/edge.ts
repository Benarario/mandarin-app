import "server-only";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import type { TtsProvider, VoiceGender } from "./types";

// The same Microsoft neural voices the spec names; edge-tts uses an unofficial
// endpoint, so this is the DEVELOPMENT provider only (Azure is the prod path).
const VOICES: Record<VoiceGender, string> = {
  female: "zh-CN-XiaoxiaoNeural",
  male: "zh-CN-YunyangNeural",
};

export class EdgeTtsProvider implements TtsProvider {
  readonly name = "edge-tts (dev)";

  async synthesize(text: string, gender: VoiceGender): Promise<Buffer> {
    const tts = new MsEdgeTTS();
    await tts.setMetadata(VOICES[gender], OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    const result = tts.toStream(text);
    // Library versions differ: some return { audioStream }, others a Readable.
    const stream = (result as { audioStream?: NodeJS.ReadableStream }).audioStream
      ?? (result as unknown as NodeJS.ReadableStream);

    return await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on("data", (c: Buffer) => chunks.push(c));
      stream.on("end", () => resolve(Buffer.concat(chunks)));
      stream.on("error", reject);
    });
  }
}
