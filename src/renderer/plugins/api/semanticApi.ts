/**
 * semanticApi.ts — 学术文献搜索
 *
 * 真实数据源（免费，无需 key）：
 *   Semantic Scholar API: https://api.semanticscholar.org/graph/v1
 *   完全免费，每秒限 10 次请求，可申请 key 提升配额
 */

export interface Paper {
  paperId: string;
  title: string;
  authors: string[];
  year?: number;
  abstract?: string;
  journal?: string;
  citationCount?: number;
  doi?: string;
  url?: string;
}

function getApiKey(): string {
  try {
    const s = JSON.parse(localStorage.getItem('qiwen-api-keys') || '{}');
    return s.semanticScholarKey || '';
  } catch { return ''; }
}

export const semanticApi = {
  async search(query: string, limit = 10): Promise<Paper[]> {
    if (!query.trim()) return [];

    const key = getApiKey();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (key) headers['x-api-key'] = key;

    const fields = 'title,authors,year,abstract,externalIds,journal,citationCount';
    const res = await fetch(
      `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=${limit}&fields=${fields}`,
      { headers }
    );

    if (!res.ok) throw new Error(`Semantic Scholar API error: ${res.status}`);
    const data = await res.json();

    return (data.data || []).map((p: any): Paper => ({
      paperId: p.paperId,
      title: p.title || '',
      authors: (p.authors || []).map((a: any) => a.name || ''),
      year: p.year,
      abstract: p.abstract,
      journal: p.journal?.name,
      citationCount: p.citationCount,
      doi: p.externalIds?.DOI,
      url: p.url || (p.externalIds?.DOI ? `https://doi.org/${p.externalIds.DOI}` : undefined),
    }));
  },

  async getById(paperId: string): Promise<Paper | null> {
    const fields = 'title,authors,year,abstract,externalIds,journal,citationCount';
    const res = await fetch(
      `https://api.semanticscholar.org/graph/v1/paper/${paperId}?fields=${fields}`
    );
    if (!res.ok) return null;
    const p = await res.json();
    return {
      paperId: p.paperId,
      title: p.title || '',
      authors: (p.authors || []).map((a: any) => a.name || ''),
      year: p.year,
      abstract: p.abstract,
      journal: p.journal?.name,
      citationCount: p.citationCount,
      doi: p.externalIds?.DOI,
      url: p.url,
    };
  },

  // 始终可用（无需 key）
  hasApiKey: () => true,
};
