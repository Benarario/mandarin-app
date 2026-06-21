// Topic tracks (spec §9) — themed clusters of common vocabulary so each stage
// offers varied subjects. Members are headwords that exist in the curriculum
// (word or character concepts); definitions/pinyin still come from CC-CEDICT.

export interface Topic {
  id: string;
  name: string;
  icon: string;
  members: string[];
}

export const TOPICS: Topic[] = [
  { id: "greetings", name: "Greetings", icon: "👋", members: ["你好", "谢谢", "再见", "对不起", "没关系", "请", "欢迎"] },
  { id: "numbers", name: "Numbers", icon: "🔢", members: ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "百", "千"] },
  { id: "family", name: "Family", icon: "👨‍👩‍👧", members: ["爸爸", "妈妈", "哥哥", "姐姐", "弟弟", "妹妹", "儿子", "女儿", "家"] },
  { id: "food", name: "Food & Drink", icon: "🍜", members: ["吃", "喝", "饭", "水", "茶", "米饭", "面条", "苹果", "鸡蛋", "牛奶"] },
  { id: "time", name: "Time & Dates", icon: "🕐", members: ["今天", "明天", "昨天", "现在", "早上", "晚上", "星期", "月", "年"] },
  { id: "shopping", name: "Money & Shopping", icon: "🛒", members: ["买", "卖", "钱", "块", "多少", "贵", "便宜", "商店"] },
  { id: "directions", name: "Directions", icon: "🧭", members: ["上", "下", "左", "右", "前", "后", "里", "外", "东", "西", "南", "北"] },
  { id: "weather", name: "Weather", icon: "🌦️", members: ["天气", "热", "冷", "雨", "雪", "风", "太阳", "云"] },
  { id: "feelings", name: "Feelings", icon: "😊", members: ["高兴", "喜欢", "爱", "累", "饿", "渴", "忙"] },
  { id: "work", name: "Work & Study", icon: "💼", members: ["工作", "学习", "老师", "学生", "医生", "学校", "书", "写"] },
  { id: "travel", name: "Travel", icon: "✈️", members: ["去", "来", "走", "车", "飞机", "火车", "票", "路"] },
  { id: "trade", name: "Trade & Business", icon: "📦", members: ["价格", "公司", "合同", "出口", "进口", "市场", "客户", "产品"] },
];
