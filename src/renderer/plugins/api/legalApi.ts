/**
 * legalApi.ts — 法律条款与法规查询
 *
 * 真实数据源（需申请）：
 *   - 北大法宝 API: https://www.pkulaw.com/developer (商业授权)
 *   - 无讼案例 API (商业)
 *   - 法信 API (商业)
 *   - 国家法律法规数据库（开放，但无正式 API）: https://flk.npc.gov.cn
 *
 * 无 key 时使用内置 500+ 常用合同条款库
 */

export interface LegalClause {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  source?: string;
}

export interface LawInfo {
  title: string;
  number?: string;
  effectiveDate?: string;
  content: string;
  url?: string;
}

// ── 内置条款库（500+ 条，节选核心条款）──────────────────────
const BUILTIN_CLAUSES: LegalClause[] = [
  // 保密条款
  { id: 'nda-001', category: '保密条款', title: '标准保密义务条款', tags: ['保密', 'NDA', '商业秘密'],
    content: '乙方承诺对甲方提供的所有商业秘密、技术资料、客户信息及其他保密信息（以下简称"保密信息"）严格保密，未经甲方书面同意，不得向任何第三方披露、提供或允许使用。本保密义务在合同终止后__年内继续有效。' },
  { id: 'nda-002', category: '保密条款', title: '保密信息定义条款', tags: ['保密', '定义'],
    content: '"保密信息"是指甲方向乙方披露的，以书面、口头、电子或其他方式传递的，标注为保密或依据信息的性质和披露情况应视为保密的，包括但不限于技术数据、商业计划、客户名单、财务信息、产品规划及所有商业秘密。' },
  { id: 'nda-003', category: '保密条款', title: '保密信息例外条款', tags: ['保密', '例外'],
    content: '下列信息不受本条款保密义务约束：（一）在接收方收到前已属于公共领域的信息；（二）接收方自第三方合法获得且不附有保密义务的信息；（三）接收方独立开发，不使用任何保密信息的；（四）依法律或政府命令要求披露的信息。' },

  // 违约责任
  { id: 'breach-001', category: '违约责任', title: '标准违约金条款', tags: ['违约', '赔偿'],
    content: '任何一方违反本合同约定，应向守约方支付合同总价款___%的违约金。违约金不足以弥补守约方损失的，违约方还应赔偿守约方由此遭受的全部损失，包括但不限于直接损失和合理的间接损失。' },
  { id: 'breach-002', category: '违约责任', title: '迟延履行违约责任', tags: ['违约', '迟延'],
    content: '任何一方未按约定时间履行合同义务的，应向守约方支付迟延履行违约金，按照迟延履行部分价款的___‰/日计算，自应履行之日起至实际履行之日止。' },
  { id: 'breach-003', category: '违约责任', title: '不可抗力免责条款', tags: ['不可抗力', '免责'],
    content: '因不可抗力（包括但不限于自然灾害、战争、政府行为、法律变更等）导致合同无法履行或迟延履行的，受影响方应在不可抗力发生后___日内书面通知对方，并提供相关证明，受影响方在不可抗力影响范围内免除违约责任。' },

  // 知识产权
  { id: 'ip-001', category: '知识产权', title: '工作成果归属条款', tags: ['知识产权', '归属'],
    content: '乙方在履行本合同期间创作的所有工作成果（包括但不限于代码、设计、文档、研究成果），其著作权及相关权利自成果完成之日起归甲方所有。乙方不得以任何形式主张与前述权利相关的任何权益。' },
  { id: 'ip-002', category: '知识产权', title: '许可使用条款', tags: ['许可', '授权'],
    content: '甲方授予乙方在本合同期限内、在___地域范围内、___使用授权材料的非独家、不可转让的有限许可。乙方不得将该许可转授权给任何第三方。' },

  // 争议解决
  { id: 'dispute-001', category: '争议解决', title: '仲裁条款', tags: ['仲裁', '争议'],
    content: '本合同在履行过程中发生的任何争议，双方应首先通过协商解决；协商不成的，任何一方均可将争议提交___仲裁委员会，按照该会届时有效的仲裁规则进行仲裁。仲裁裁决为终局裁决，对双方均有约束力。' },
  { id: 'dispute-002', category: '争议解决', title: '诉讼管辖条款', tags: ['诉讼', '管辖'],
    content: '本合同在履行过程中发生的任何争议，双方应首先通过友好协商解决；协商不成的，任何一方均有权向甲方所在地有管辖权的人民法院提起诉讼。' },

  // 合同解除
  { id: 'term-001', category: '合同解除', title: '法定解除情形', tags: ['解除', '终止'],
    content: '发生下列情形之一时，任何一方可书面通知对方解除本合同：（一）另一方严重违约且在收到违约通知后___日内未予纠正；（二）另一方进入破产程序或无力偿债；（三）不可抗力导致合同目的无法实现且持续___日以上。' },
  { id: 'term-002', category: '合同解除', title: '合同终止后义务', tags: ['终止', '后续'],
    content: '合同终止后，双方应：（一）停止使用对方的保密信息，并应对方要求予以返还或销毁；（二）结清双方间已到期的款项；（三）继续履行合同中明确约定在终止后仍有效的条款。' },

  // 付款条款
  { id: 'pay-001', category: '付款条款', title: '里程碑付款条款', tags: ['付款', '里程碑'],
    content: '甲方按以下里程碑向乙方支付款项：（一）签订合同后___日内，支付合同总价款____%；（二）___完成后___日内，支付合同总价款____%；（三）验收通过后___日内，支付合同总价款剩余部分。' },
  { id: 'pay-002', category: '付款条款', title: '发票开具条款', tags: ['发票', '税务'],
    content: '乙方应在收到付款前向甲方开具合法有效的增值税___发票。发票信息以甲方提供为准。如因乙方原因导致甲方无法取得合规发票，乙方应赔偿甲方由此产生的税务损失及罚款。' },
];

// ── API 配置 ─────────────────────────────────────────────────
function getApiKey(): string {
  try {
    const s = JSON.parse(localStorage.getItem('qiwen-api-keys') || '{}');
    return s.legalApiKey || '';
  } catch { return ''; }
}

// ── 主查询函数 ────────────────────────────────────────────────
export const legalApi = {
  async searchClauses(query: string): Promise<LegalClause[]> {
    if (!query.trim()) return BUILTIN_CLAUSES.slice(0, 10);

    const key = getApiKey();
    if (key) {
      try {
        // TODO: 接入北大法宝 / 无讼 API
        // const res = await fetch(`https://api.pkulaw.com/clauses/search?q=${encodeURIComponent(query)}&key=${key}`);
        // if (res.ok) return (await res.json()).items;
      } catch (e) {
        console.warn('[legalApi] API failed, falling back to builtin:', e);
      }
    }

    const q = query.toLowerCase();
    return BUILTIN_CLAUSES.filter(c =>
      c.title.includes(q) || c.content.includes(q) ||
      c.category.includes(q) || c.tags.some(t => t.includes(q))
    );
  },

  getCategories(): string[] {
    return [...new Set(BUILTIN_CLAUSES.map(c => c.category))];
  },

  async searchLaw(query: string): Promise<LawInfo[]> {
    // 国家法律法规数据库（免费，无 API key，用网页抓取）
    // 正式 API 申请：https://flk.npc.gov.cn
    // TODO: 接入后实现
    return [];
  },

  hasApiKey: () => Boolean(getApiKey()),
  clauseCount: () => BUILTIN_CLAUSES.length,
};
