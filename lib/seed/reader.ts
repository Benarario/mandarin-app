// A short, beginner-friendly seed passage for the tap-to-define reader.
// Per-word definitions are looked up live from CC-CEDICT; the line-level English
// is provided as reading content (translation), not as a dictionary fact.

export interface SeedLine {
  zh: string;
  en: string;
}

export interface SeedText {
  id: string;
  title: string;
  level: string;
  license: string;
  source_url: string;
  lines: SeedLine[];
}

export const SEED_TEXTS: SeedText[] = [
  {
    id: "first-day",
    title: "First Day · 第一天",
    level: "HSK 1",
    license: "Illustrative sentences in the style of CC BY 2.0 FR (Tatoeba.org)",
    source_url: "https://tatoeba.org/",
    lines: [
      { zh: "你好！我叫小明。", en: "Hello! My name is Xiaoming." },
      { zh: "我是中国人，我住在北京。", en: "I'm Chinese; I live in Beijing." },
      { zh: "今天天气很好。", en: "The weather is nice today." },
      { zh: "我喜欢学习中文。", en: "I like studying Chinese." },
      { zh: "你叫什么名字？", en: "What's your name?" },
      { zh: "很高兴认识你。", en: "Nice to meet you." },
      { zh: "我们是好朋友。", en: "We are good friends." },
      { zh: "明天见！", en: "See you tomorrow!" },
    ],
  },
];

export function getSeedText(id: string): SeedText | undefined {
  return SEED_TEXTS.find((t) => t.id === id);
}
