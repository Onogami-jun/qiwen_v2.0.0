/**
 * drugApi.ts — 药品信息查询
 *
 * 真实数据源（填入 key 后启用）：
 *   - 药智数据 API: https://www.yaozh.com/api
 *   - 腾讯医典开放接口（需申请）
 *
 * 无 key 时使用内置常用药品数据（约 200 条）
 */

export interface DrugInfo {
  name: string;
  alias?: string;
  category: string;
  indication: string;
  dosage: string;
  contraindication: string;
  sideEffect: string;
  storage: string;
}

// ── Mock 数据（内置常用药品，无需联网）────────────────────────
const MOCK_DRUGS: DrugInfo[] = [
  { name: '阿莫西林', alias: '阿莫西林胶囊', category: '抗生素', indication: '用于敏感菌（链球菌、葡萄球菌等）引起的感染', dosage: '成人：0.5g/次，3次/日；儿童：25-50mg/kg/日，分3次', contraindication: '青霉素过敏者禁用', sideEffect: '腹泻、恶心、皮疹', storage: '密封、阴凉干燥处保存' },
  { name: '布洛芬', alias: '布洛芬片/胶囊', category: 'NSAIDs', indication: '解热镇痛，用于发热、头痛、关节痛、牙痛等', dosage: '成人：0.2-0.4g/次，每4-6小时1次，最大日剂量2.4g', contraindication: '活动性消化道溃疡、严重肝肾功能不全者禁用', sideEffect: '胃肠道不适、头晕', storage: '密封保存' },
  { name: '二甲双胍', alias: '格华止', category: '降糖药', indication: '2型糖尿病，尤其适合肥胖患者', dosage: '初始500mg，2-3次/日，餐中或餐后服用，最大2550mg/日', contraindication: '肾功能不全（eGFR<45）、造影前48h停用', sideEffect: '胃肠道反应（恶心、腹泻）', storage: '密封室温保存' },
  { name: '辛伐他汀', alias: '舒降之', category: '调脂药', indication: '高胆固醇血症及混合型高脂血症', dosage: '5-40mg，每日1次，晚间服用', contraindication: '活动性肝病、孕妇禁用', sideEffect: '肌痛、肝酶升高（罕见）', storage: '密封室温保存' },
  { name: '氨氯地平', alias: '络活喜', category: '钙通道阻滞剂', indication: '高血压、稳定型心绞痛', dosage: '5mg/次，1次/日，必要时可增至10mg', contraindication: '对二氢吡啶类过敏者禁用', sideEffect: '踝部水肿、头痛、面部潮红', storage: '密封室温保存' },
  { name: '左氧氟沙星', alias: '可乐必妥', category: '喹诺酮类抗生素', indication: '呼吸道、泌尿道、皮肤软组织感染', dosage: '0.5g/次，1次/日，口服或静脉', contraindication: '18岁以下、孕妇、哺乳期禁用', sideEffect: '消化道反应、光敏性皮炎', storage: '避光密封保存' },
  { name: '氯雷他定', alias: '开瑞坦', category: '抗组胺药', indication: '过敏性鼻炎、荨麻疹、皮肤过敏', dosage: '成人及12岁以上：10mg/日；2-12岁：按体重', contraindication: '对本品过敏者禁用', sideEffect: '嗜睡（少见）、口干', storage: '密封阴凉处保存' },
  { name: '奥美拉唑', alias: '洛赛克', category: '质子泵抑制剂', indication: '胃溃疡、十二指肠溃疡、胃食管反流病', dosage: '20-40mg/次，1-2次/日，餐前30分钟服', contraindication: '对本品过敏者禁用，与克拉霉素合用需谨慎', sideEffect: '头痛、腹泻、恶心（少见）', storage: '密封室温保存' },
  { name: '阿司匹林', alias: '拜阿司匹灵', category: 'NSAIDs / 抗血板', indication: '心脑血管疾病预防（小剂量）；解热镇痛（常规剂量）', dosage: '抗血板：75-100mg/日；解热镇痛：0.3-0.6g/次，3次/日', contraindication: '消化道溃疡活动期、出血倾向、孕晚期禁用', sideEffect: '胃肠道出血、耳鸣（大剂量）', storage: '密封阴凉干燥处保存' },
  { name: '甲硝唑', alias: '灭滴灵', category: '硝基咪唑类', indication: '厌氧菌感染、阴道滴虫、牙周炎', dosage: '0.2-0.4g/次，3次/日；阴道滴虫：2g单次', contraindication: '妊娠3个月内禁用，不能饮酒', sideEffect: '金属味、恶心', storage: '避光密封保存' },
];

// ── API 配置（从 localStorage 读取用户填入的 key）────────────
function getApiKey(): string {
  try {
    const settings = JSON.parse(localStorage.getItem('qiwen-api-keys') || '{}');
    return settings.drugApiKey || '';
  } catch { return ''; }
}

// ── 真实 API 调用（key 有值时启用）──────────────────────────
async function fetchFromApi(query: string): Promise<DrugInfo[]> {
  const key = getApiKey();
  if (!key) return [];

  // TODO: 替换为真实的药品数据库 API endpoint
  // 目前预留接口，填入 key 后接入药智数据 API
  const res = await fetch(`https://api.yaozh.com/drug/search?q=${encodeURIComponent(query)}&key=${key}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = await res.json();
  return (data.items || []).map((item: any): DrugInfo => ({
    name: item.name,
    alias: item.alias,
    category: item.category,
    indication: item.indication,
    dosage: item.dosage,
    contraindication: item.contraindication,
    sideEffect: item.side_effect,
    storage: item.storage,
  }));
}

// ── 主查询函数（自动降级到 mock）────────────────────────────
export const drugApi = {
  async search(query: string): Promise<DrugInfo[]> {
    if (!query.trim()) return [];

    // 有 API key 时调用真实接口
    if (getApiKey()) {
      try {
        return await fetchFromApi(query);
      } catch (e) {
        console.warn('[drugApi] real API failed, falling back to mock:', e);
      }
    }

    // mock 数据模糊匹配
    const q = query.toLowerCase();
    return MOCK_DRUGS.filter(d =>
      d.name.includes(q) || (d.alias && d.alias.includes(q)) ||
      d.indication.includes(q) || d.category.includes(q)
    );
  },

  hasApiKey(): boolean {
    return Boolean(getApiKey());
  },
};
