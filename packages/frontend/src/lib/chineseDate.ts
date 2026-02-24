/**
 * 中文日期格式化工具
 * 将数字日期转换为法律文书所需的中文格式
 */

// 将数字逐位转换为中文（用于年份：2026 → 二〇二六）
export const numberToChinese = (num: number): string => {
  const digits = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  return num.toString().split('').map(d => digits[parseInt(d)]).join('');
};

// 将月/日数字转换为中文（16 → 十六，9 → 九，20 → 二十）
export const dayMonthToChinese = (num: number): string => {
  const digits = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
  if (num <= 10) return digits[num];
  if (num < 20) return `十${digits[num - 10]}`;
  if (num === 20) return '二十';
  if (num < 30) return `二十${digits[num - 20]}`;
  if (num === 30) return '三十';
  return `三十${digits[num - 30]}`;
};

// 格式化日期为中文格式：二〇二六年二月十六日
export const formatChineseDate = (date: Date): string => {
  const year = numberToChinese(date.getFullYear());
  const month = dayMonthToChinese(date.getMonth() + 1);
  const day = dayMonthToChinese(date.getDate());
  return `${year}年${month}月${day}日`;
};
