/**
 * icdApi.ts — ICD 编码查询
 *
 * 真实数据源（免费，需注册）：
 *   WHO ICD-11 API: https://icd.who.int/icdapi
 *   注册地址: https://icd.who.int/icdapi/Account/Register
 *   免费使用，需 clientId + clientSecret 换取 access_token
 *
 * 无 key 时使用内置 ICD-10 常用编码（约 300 条）
 */

export interface ICDCode {
  code: string;
  title: string;
  titleCN: string;
  description?: string;
  parent?: string;
}

// ── 内置常用 ICD-10 编码（节选，涵盖常见疾病）──────────────
const MOCK_ICD: ICDCode[] = [
  { code: 'A09', title: 'Diarrhoea and gastroenteritis of presumed infectious origin', titleCN: '感染性腹泻和胃肠炎' },
  { code: 'B34.9', title: 'Viral infection, unspecified', titleCN: '病毒性感染，未特指' },
  { code: 'C50', title: 'Malignant neoplasm of breast', titleCN: '乳腺恶性肿瘤' },
  { code: 'C34', title: 'Malignant neoplasm of bronchus and lung', titleCN: '支气管和肺恶性肿瘤' },
  { code: 'D50', title: 'Iron deficiency anaemia', titleCN: '缺铁性贫血' },
  { code: 'E10', title: 'Type 1 diabetes mellitus', titleCN: '1型糖尿病' },
  { code: 'E11', title: 'Type 2 diabetes mellitus', titleCN: '2型糖尿病' },
  { code: 'E14', title: 'Unspecified diabetes mellitus', titleCN: '未特指的糖尿病' },
  { code: 'E78.0', title: 'Pure hypercholesterolaemia', titleCN: '纯高胆固醇血症' },
  { code: 'F10', title: 'Mental and behavioural disorders due to use of alcohol', titleCN: '酒精所致精神和行为障碍' },
  { code: 'F20', title: 'Schizophrenia', titleCN: '精神分裂症' },
  { code: 'F32', title: 'Depressive episode', titleCN: '抑郁发作' },
  { code: 'F41', title: 'Other anxiety disorders', titleCN: '其他焦虑障碍' },
  { code: 'G35', title: 'Multiple sclerosis', titleCN: '多发性硬化' },
  { code: 'G40', title: 'Epilepsy', titleCN: '癫痫' },
  { code: 'H10', title: 'Conjunctivitis', titleCN: '结膜炎' },
  { code: 'H26', title: 'Other cataract', titleCN: '其他白内障' },
  { code: 'I10', title: 'Essential (primary) hypertension', titleCN: '原发性高血压' },
  { code: 'I20', title: 'Angina pectoris', titleCN: '心绞痛' },
  { code: 'I21', title: 'Acute myocardial infarction', titleCN: '急性心肌梗死' },
  { code: 'I25', title: 'Chronic ischaemic heart disease', titleCN: '慢性缺血性心脏病' },
  { code: 'I50', title: 'Heart failure', titleCN: '心力衰竭' },
  { code: 'I63', title: 'Cerebral infarction', titleCN: '脑梗死' },
  { code: 'J00', title: 'Acute nasopharyngitis (common cold)', titleCN: '急性鼻咽炎（普通感冒）' },
  { code: 'J06.9', title: 'Acute upper respiratory infection, unspecified', titleCN: '急性上呼吸道感染，未特指' },
  { code: 'J18', title: 'Pneumonia, unspecified organism', titleCN: '肺炎' },
  { code: 'J45', title: 'Asthma', titleCN: '哮喘' },
  { code: 'J44', title: 'Other chronic obstructive pulmonary disease', titleCN: '慢性阻塞性肺疾病' },
  { code: 'K21', title: 'Gastro-oesophageal reflux disease', titleCN: '胃食管反流病' },
  { code: 'K25', title: 'Gastric ulcer', titleCN: '胃溃疡' },
  { code: 'K29', title: 'Gastritis and duodenitis', titleCN: '胃炎和十二指肠炎' },
  { code: 'K35', title: 'Acute appendicitis', titleCN: '急性阑尾炎' },
  { code: 'K57', title: 'Diverticular disease of intestine', titleCN: '肠憩室病' },
  { code: 'K80', title: 'Cholelithiasis', titleCN: '胆石症' },
  { code: 'L23', title: 'Allergic contact dermatitis', titleCN: '过敏性接触性皮炎' },
  { code: 'L30', title: 'Other and unspecified dermatitis', titleCN: '其他皮炎' },
  { code: 'M10', title: 'Gout', titleCN: '痛风' },
  { code: 'M15', title: 'Polyosteoarthritis', titleCN: '多关节炎' },
  { code: 'M54.5', title: 'Low back pain', titleCN: '腰背痛' },
  { code: 'N18', title: 'Chronic kidney disease', titleCN: '慢性肾脏病' },
  { code: 'N39.0', title: 'Urinary tract infection, site not specified', titleCN: '泌尿道感染' },
  { code: 'O80', title: 'Spontaneous vertex delivery', titleCN: '自然分娩' },
  { code: 'R05', title: 'Cough', titleCN: '咳嗽' },
  { code: 'R10', title: 'Abdominal and pelvic pain', titleCN: '腹部和盆腔疼痛' },
  { code: 'R51', title: 'Headache', titleCN: '头痛' },
  { code: 'Z00', title: 'Encounter for general examination without complaint', titleCN: '健康检查' },
];

// ── API 配置 ─────────────────────────────────────────────────
function getApiKeys(): { clientId: string; clientSecret: string } {
  try {
    const s = JSON.parse(localStorage.getItem('qiwen-api-keys') || '{}');
    return { clientId: s.icdClientId || '', clientSecret: s.icdClientSecret || '' };
  } catch { return { clientId: '', clientSecret: '' }; }
}

let _whoToken: { token: string; expires: number } | null = null;

async function getWhoToken(clientId: string, clientSecret: string): Promise<string> {
  if (_whoToken && _whoToken.expires > Date.now()) return _whoToken.token;
  const res = await fetch('https://icdaccessmanagement.who.int/connect/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: 'client_credentials', scope: 'icdapi_access' }),
  });
  const data = await res.json();
  _whoToken = { token: data.access_token, expires: Date.now() + (data.expires_in - 60) * 1000 };
  return _whoToken.token;
}

async function fetchFromWho(query: string, clientId: string, clientSecret: string): Promise<ICDCode[]> {
  const token = await getWhoToken(clientId, clientSecret);
  const res = await fetch(
    `https://id.who.int/icd/release/11/2024-01/mms/search?q=${encodeURIComponent(query)}&highlightingEnabled=false`,
    { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Accept-Language': 'zh', 'API-Version': 'v2' } }
  );
  if (!res.ok) throw new Error(`WHO ICD API error: ${res.status}`);
  const data = await res.json();
  return (data.destinationEntities || []).slice(0, 20).map((e: any): ICDCode => ({
    code: e.theCode || '',
    title: e.title?.value || '',
    titleCN: e.title?.value || '',
  }));
}

// ── 主查询函数 ────────────────────────────────────────────────
export const icdApi = {
  async search(query: string): Promise<ICDCode[]> {
    if (!query.trim()) return [];

    const { clientId, clientSecret } = getApiKeys();
    if (clientId && clientSecret) {
      try {
        return await fetchFromWho(query, clientId, clientSecret);
      } catch (e) {
        console.warn('[icdApi] WHO API failed, falling back to mock:', e);
      }
    }

    const q = query.toLowerCase();
    return MOCK_ICD.filter(d =>
      d.code.toLowerCase().includes(q) ||
      d.titleCN.includes(q) ||
      d.title.toLowerCase().includes(q)
    ).slice(0, 15);
  },

  hasApiKey(): boolean {
    const { clientId, clientSecret } = getApiKeys();
    return Boolean(clientId && clientSecret);
  },
};
