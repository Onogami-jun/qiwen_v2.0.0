/**
 * readabilityApi.ts — 可读性分析（纯本地计算，无需 API）
 */

export interface ReadabilityResult {
  score: number;          // 0-100，越高越易读
  level: string;          // 小学 / 初中 / 高中 / 大学 / 专业
  avgSentenceLen: number; // 平均句长（字数）
  avgWordLen: number;     // 平均词长
  longSentences: number;  // 长句数量（>50字）
  complexWords: number;   // 复杂词比例（英文4音节以上）
  suggestions: string[];  // 改进建议
}

export const readabilityApi = {
  analyze(text: string): ReadabilityResult {
    if (!text.trim()) {
      return { score: 0, level: '—', avgSentenceLen: 0, avgWordLen: 0, longSentences: 0, complexWords: 0, suggestions: [] };
    }

    // 分句（中英文通用）
    const sentences = text.split(/[。！？…\.\!\?]+/).filter(s => s.trim().length > 2);
    const totalChars = text.replace(/\s/g, '').length;
    const avgSentenceLen = sentences.length ? totalChars / sentences.length : 0;
    const longSentences = sentences.filter(s => s.replace(/\s/g, '').length > 50).length;

    // 英文词复杂度
    const words = text.match(/\b[a-zA-Z]+\b/g) || [];
    const complexWords = words.filter(w => w.length >= 8).length;
    const complexRatio = words.length ? complexWords / words.length : 0;

    // 可读性打分（简化 Flesch 公式适配中文）
    let score = 100;
    score -= Math.min(30, (avgSentenceLen - 15) * 1.5); // 句子越长扣分
    score -= Math.min(20, longSentences * 3);             // 长句数量
    score -= Math.min(20, complexRatio * 60);             // 复杂词比例
    score = Math.max(0, Math.min(100, score));

    const level = score >= 85 ? '小学' : score >= 70 ? '初中' : score >= 55 ? '高中' : score >= 40 ? '大学' : '专业';

    const suggestions: string[] = [];
    if (avgSentenceLen > 30) suggestions.push('部分句子偏长，建议拆分为短句提升可读性');
    if (longSentences > 3) suggestions.push(`有 ${longSentences} 个超长句（>50字），建议简化`);
    if (complexRatio > 0.2) suggestions.push('专业词汇比例较高，可考虑添加解释或简化表达');
    if (score >= 80) suggestions.push('文章可读性良好，表达清晰流畅');

    return { score: Math.round(score), level, avgSentenceLen: Math.round(avgSentenceLen), avgWordLen: 0, longSentences, complexWords, suggestions };
  },
};
