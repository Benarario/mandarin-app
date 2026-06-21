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
  topic: string;
  license: string;
  source_url: string;
  lines: SeedLine[];
}

export const SEED_TEXTS: SeedText[] = [
  {
    id: "first-day",
    title: "First Day · 第一天",
    level: "HSK 1",
    topic: "Greetings",
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
  {
    id: "my-family",
    title: "My Family · 我的家",
    level: "HSK 1",
    topic: "Family",
    license: "Illustrative sentences in the style of CC BY 2.0 FR (Tatoeba.org)",
    source_url: "https://tatoeba.org/",
    lines: [
      { zh: "我家有四个人。", en: "There are four people in my family." },
      { zh: "爸爸、妈妈、姐姐和我。", en: "Dad, Mom, older sister, and me." },
      { zh: "我爸爸是老师。", en: "My dad is a teacher." },
      { zh: "我妈妈是医生。", en: "My mom is a doctor." },
      { zh: "我们都喜欢狗。", en: "We all like dogs." },
      { zh: "我家有一只小狗。", en: "We have a little dog." },
      { zh: "我爱我的家。", en: "I love my family." },
    ],
  },
  {
    id: "at-the-market",
    title: "At the Market · 在市场",
    level: "HSK 2",
    topic: "Food & Shopping",
    license: "Illustrative sentences in the style of CC BY 2.0 FR (Tatoeba.org)",
    source_url: "https://tatoeba.org/",
    lines: [
      { zh: "我想买一些水果。", en: "I want to buy some fruit." },
      { zh: "苹果多少钱？", en: "How much are the apples?" },
      { zh: "五块钱一斤。", en: "Five yuan per jin (500g)." },
      { zh: "我要两斤苹果。", en: "I'll take two jin of apples." },
      { zh: "还要一些香蕉。", en: "And some bananas too." },
      { zh: "一共多少钱？", en: "How much altogether?" },
      { zh: "谢谢你！", en: "Thank you!" },
    ],
  },
];

export function getSeedText(id: string): SeedText | undefined {
  return SEED_TEXTS.find((t) => t.id === id);
}
