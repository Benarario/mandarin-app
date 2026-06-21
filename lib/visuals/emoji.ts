// Dual-coded picture-words using Unicode emoji — public-domain pictographs, no
// licensing or storage needed, render everywhere (spec §12A lists emoji as an
// allowed open image source). Reserved for CONCRETE nouns / vivid items; abstract
// and function words are intentionally left without a picture (taught in context).
// The emoji is a memory aid, never a Chinese-language fact.

export const EMOJI: Record<string, string> = {
  // elements / nature (also common components)
  人: "🧑", 女: "👩", 男: "👨", 子: "👶", 口: "👄", 手: "✋", 目: "👁️", 耳: "👂",
  心: "❤️", 足: "🦶", 头: "🗣️", 牙: "🦷", 血: "🩸", 骨: "🦴", 肉: "🥩",
  日: "☀️", 月: "🌙", 木: "🌳", 水: "💧", 火: "🔥", 山: "⛰️", 土: "🟫", 田: "🌾",
  雨: "🌧️", 雪: "❄️", 云: "☁️", 风: "💨", 电: "⚡", 星: "⭐", 天: "🌤️", 花: "🌸",
  草: "🌿", 树: "🌳", 石: "🪨", 金: "🥇", 米: "🍚", 茶: "🍵", 饭: "🍚",
  // animals
  马: "🐴", 牛: "🐂", 羊: "🐑", 鸟: "🐦", 鱼: "🐟", 虫: "🐛", 猫: "🐱", 狗: "🐶",
  鸡: "🐔", 猪: "🐷", 兔: "🐰", 龙: "🐉", 蛇: "🐍", 虎: "🐯", 熊: "🐻", 象: "🐘",
  猴: "🐵", 鼠: "🐭",
  // things
  门: "🚪", 车: "🚗", 刀: "🔪", 书: "📖", 笔: "✏️", 钱: "💰", 灯: "💡", 床: "🛏️",
  椅: "🪑", 桌: "🪑", 衣: "👕", 鞋: "👟", 帽: "🎩", 伞: "☂️", 钟: "🕐", 表: "⌚",
  // food
  蛋: "🥚", 奶: "🥛", 面: "🍜", 包: "🥖", 糖: "🍬", 盐: "🧂", 酒: "🍶", 水果: "🍎",
  苹果: "🍎", 香蕉: "🍌", 西瓜: "🍉", 葡萄: "🍇", 橙子: "🍊", 草莓: "🍓", 蔬菜: "🥬",
  // common words
  电话: "☎️", 手机: "📱", 电脑: "💻", 电视: "📺", 火车: "🚆", 飞机: "✈️", 汽车: "🚗",
  自行车: "🚲", 公共汽车: "🚌", 出租车: "🚕", 船: "🚢",
  学校: "🏫", 医院: "🏥", 商店: "🏪", 餐厅: "🍴", 银行: "🏦", 家: "🏠", 房子: "🏠",
  医生: "🧑‍⚕️", 老师: "🧑‍🏫", 学生: "🧑‍🎓", 朋友: "🧑‍🤝‍🧑", 妈妈: "👩", 爸爸: "👨",
  哥哥: "👦", 姐姐: "👧", 弟弟: "👦", 妹妹: "👧", 孩子: "🧒", 狗狗: "🐶",
  太阳: "☀️", 月亮: "🌙", 星星: "⭐", 天气: "🌦️", 时间: "⏰", 早上: "🌅", 晚上: "🌃",
  中午: "🌞", 生日: "🎂", 礼物: "🎁", 音乐: "🎵", 电影: "🎬", 雨伞: "☂️",
};

/** Returns a picture-emoji for a character or word, or null if none. */
export function visualFor(text: string): string | null {
  return EMOJI[text] ?? null;
}
