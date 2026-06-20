// A short, beginner-friendly seed passage for the tap-to-define reader.
// These are common everyday Mandarin sentences of the kind found in the
// CC-BY Tatoeba corpus; per-word definitions are looked up live from CC-CEDICT.

export interface SeedText {
  id: string;
  title: string;
  level: string;
  license: string;
  source_url: string;
  lines: string[];
}

export const SEED_TEXTS: SeedText[] = [
  {
    id: "first-day",
    title: "First Day · 第一天",
    level: "HSK 1",
    license: "Sentences in the style of CC BY 2.0 FR (Tatoeba.org)",
    source_url: "https://tatoeba.org/",
    lines: [
      "你好！我叫小明。",
      "我是中国人，我住在北京。",
      "今天天气很好。",
      "我喜欢学习中文。",
      "你叫什么名字？",
      "很高兴认识你。",
      "我们是好朋友。",
      "明天见！",
    ],
  },
];

export function getSeedText(id: string): SeedText | undefined {
  return SEED_TEXTS.find((t) => t.id === id);
}
