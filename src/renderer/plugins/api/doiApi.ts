/**
 * doiApi.ts — 文献 DOI / 搜索查询
 *
 * 真实数据源（完全免费，无需 key）：
 *   - CrossRef API: https://api.crossref.org  (DOI 查询)
 *   - Semantic Scholar: https://api.semanticscholar.org (文献搜索)
 *
 * 直接使用，无需注册。礼貌使用建议在 User-Agent 中标注应用名。
 */

export interface ReferenceInfo {
  doi?: string;
  title: string;
  authors: string[];
  journal?: string;
  year?: number;
  volume?: string;
  issue?: string;
  pages?: string;
  url?: string;
  abstract?: string;
  publisher?: string;
  type?: string;
}

const UA = 'QiWen/1.0 (https://bitwool.cn; mailto:bitwool@163.com)';

// ── CrossRef DOI 查询 ─────────────────────────────────────────
async function fetchByDoi(doi: string): Promise<ReferenceInfo | null> {
  const cleanDoi = doi.trim().replace(/^https?:\/\/doi\.org\//i, '');
  const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(cleanDoi)}`, {
    headers: { 'User-Agent': UA },
  });
  if (!res.ok) return null;
  const { message: m } = await res.json();
  return {
    doi: m.DOI,
    title: (m.title?.[0] || ''),
    authors: (m.author || []).map((a: any) => `${a.family || ''}${a.given ? ', ' + a.given : ''}`),
    journal: m['container-title']?.[0] || m.publisher || '',
    year: m.issued?.['date-parts']?.[0]?.[0] || m['published-print']?.['date-parts']?.[0]?.[0],
    volume: m.volume,
    issue: m.issue,
    pages: m.page,
    url: m.URL,
    publisher: m.publisher,
    type: m.type,
  };
}

// ── CrossRef 关键词搜索 ────────────────────────────────────────
async function searchCrossRef(query: string, limit = 10): Promise<ReferenceInfo[]> {
  const res = await fetch(
    `https://api.crossref.org/works?query=${encodeURIComponent(query)}&rows=${limit}&select=DOI,title,author,container-title,issued,volume,issue,page,URL,type`,
    { headers: { 'User-Agent': UA } }
  );
  if (!res.ok) return [];
  const { message } = await res.json();
  return (message.items || []).map((m: any): ReferenceInfo => ({
    doi: m.DOI,
    title: m.title?.[0] || '',
    authors: (m.author || []).map((a: any) => `${a.family || ''}${a.given ? ', ' + a.given : ''}`),
    journal: m['container-title']?.[0] || '',
    year: m.issued?.['date-parts']?.[0]?.[0],
    volume: m.volume,
    issue: m.issue,
    pages: m.page,
    url: m.URL,
    type: m.type,
  }));
}

// ── 格式化为各种引用格式 ──────────────────────────────────────
function formatAPA(ref: ReferenceInfo): string {
  const authors = ref.authors.length > 6
    ? ref.authors.slice(0, 6).join(', ') + ', ... ' + ref.authors[ref.authors.length - 1]
    : ref.authors.join(', ');
  const year = ref.year ? `(${ref.year})` : '(n.d.)';
  const journal = ref.journal ? ` *${ref.journal}*` : '';
  const vol = ref.volume ? `, *${ref.volume}*` : '';
  const issue = ref.issue ? `(${ref.issue})` : '';
  const pages = ref.pages ? `, ${ref.pages}` : '';
  const doi = ref.doi ? ` https://doi.org/${ref.doi}` : ref.url ? ` ${ref.url}` : '';
  return `${authors} ${year}. ${ref.title}.${journal}${vol}${issue}${pages}.${doi}`;
}

function formatMLA(ref: ReferenceInfo): string {
  const authors = ref.authors.length > 0
    ? ref.authors.length === 1
      ? ref.authors[0]
      : ref.authors.length === 2
        ? ref.authors.join(', and ')
        : ref.authors[0] + ', et al.'
    : '';
  const journal = ref.journal ? `*${ref.journal}*` : '';
  const vol = ref.volume ? ` vol. ${ref.volume}` : '';
  const issue = ref.issue ? `, no. ${ref.issue}` : '';
  const year = ref.year ? `, ${ref.year}` : '';
  const pages = ref.pages ? `, pp. ${ref.pages}` : '';
  const doi = ref.doi ? ` doi:${ref.doi}` : '';
  return `${authors}. "${ref.title}."${journal ? ' ' + journal : ''}${vol}${issue}${year}${pages}.${doi}`;
}

function formatGB(ref: ReferenceInfo): string {
  // GB/T 7714-2015
  const authors = ref.authors.slice(0, 3).join(', ') + (ref.authors.length > 3 ? ', 等' : '');
  const journal = ref.journal ? `[J]. ${ref.journal}` : '[M]';
  const year = ref.year ? `, ${ref.year}` : '';
  const vol = ref.volume ? `, ${ref.volume}` : '';
  const issue = ref.issue ? `(${ref.issue})` : '';
  const pages = ref.pages ? `: ${ref.pages}` : '';
  const doi = ref.doi ? `. DOI: ${ref.doi}` : '';
  return `${authors}. ${ref.title}${journal}${year}${vol}${issue}${pages}${doi}.`;
}

// ── 主 API 对象 ───────────────────────────────────────────────
export const doiApi = {
  async getByDoi(doi: string): Promise<ReferenceInfo | null> {
    return fetchByDoi(doi);
  },

  async search(query: string, limit = 10): Promise<ReferenceInfo[]> {
    return searchCrossRef(query, limit);
  },

  formatAPA,
  formatMLA,
  formatGB,

  // 格式化为指定格式
  format(ref: ReferenceInfo, style: 'apa' | 'mla' | 'gb'): string {
    switch (style) {
      case 'apa': return formatAPA(ref);
      case 'mla': return formatMLA(ref);
      case 'gb':  return formatGB(ref);
      default:    return formatAPA(ref);
    }
  },

  // CrossRef 始终可用（无需 key）
  hasApiKey: () => true,
};
