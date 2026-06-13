/**
 * license.js — 离线 License 激活系统
 * v1.2.0
 *
 * License Key 格式: QIWEN-XXXX-XXXX-XXXX-XXXX
 * 验证方式: 本地哈希校验（离线可用）+ 可选联网激活
 * 计划级别: free | pro | enterprise
 */

const { ipcMain } = require('electron');
const { getDb } = require('../database/db');
const crypto = require('crypto');
const log = require('electron-log');

// License 计划定义
const PLANS = {
  free:       { name: '免费版', maxWorkspaces: 3,  maxDocuments: 100,  aiTokens: 50000,  features: [] },
  pro:        { name: '专业版', maxWorkspaces: 20, maxDocuments: 10000, aiTokens: 500000, features: ['version_history', 'advanced_export', 'command_palette', 'priority_support'] },
  enterprise: { name: '企业版', maxWorkspaces: -1, maxDocuments: -1,   aiTokens: -1,     features: ['version_history', 'advanced_export', 'command_palette', 'priority_support', 'custom_branding', 'audit_log', 'sso'] },
};

// 离线校验 secret（实际产品中应混淆/加密保存）
const LICENSE_SECRET = 'BITWOOL_QIWEN_2024_LICENSE_SECRET_KEY';

function generateChecksum(key, plan, expiresAt) {
  const payload = `${key}:${plan}:${expiresAt || 0}:${LICENSE_SECRET}`;
  return crypto.createHash('sha256').update(payload).digest('hex').substring(0, 16).toUpperCase();
}

function parseLicenseKey(rawKey) {
  // 格式: QIWEN-PLAN-DATE-XXXX-CHECKSUM
  // 例如: QIWEN-PRO-20261231-A1B2-C3D4E5F6G7H8
  const clean = rawKey.toUpperCase().replace(/\s/g, '');
  const parts = clean.split('-');
  if (parts.length < 5 || parts[0] !== 'QIWEN') return null;
  const plan = parts[1].toLowerCase();
  const dateStr = parts[2]; // YYYYMMDD or 'LIFE'
  const expiresAt = dateStr === 'LIFE' ? null : parseDate(dateStr);
  const checksum = parts.slice(3).join('');
  return { plan, expiresAt, checksum, raw: clean };
}

function parseDate(str) {
  if (!str || str.length !== 8) return null;
  const y = str.slice(0, 4), m = str.slice(4, 6), d = str.slice(6, 8);
  return new Date(`${y}-${m}-${d}`).getTime();
}

function verifyLicense(rawKey) {
  const parsed = parseLicenseKey(rawKey);
  if (!parsed) return { valid: false, error: 'license_format_invalid' };
  if (!PLANS[parsed.plan]) return { valid: false, error: 'license_plan_unknown' };
  if (parsed.expiresAt && parsed.expiresAt < Date.now()) return { valid: false, error: 'license_expired', expiresAt: parsed.expiresAt };

  const expected = generateChecksum(rawKey.split('-').slice(0, 3).join('-'), parsed.plan, parsed.expiresAt);
  if (!parsed.checksum.startsWith(expected.substring(0, 8))) {
    return { valid: false, error: 'license_checksum_invalid' };
  }

  return {
    valid: true,
    plan: parsed.plan,
    planName: PLANS[parsed.plan].name,
    expiresAt: parsed.expiresAt,
    features: PLANS[parsed.plan].features,
    limits: {
      maxWorkspaces: PLANS[parsed.plan].maxWorkspaces,
      maxDocuments: PLANS[parsed.plan].maxDocuments,
      aiTokens: PLANS[parsed.plan].aiTokens,
    },
  };
}

function registerLicenseHandlers() {
  // 激活 License
  ipcMain.handle('license:activate', (_, { key }) => {
    try {
      const result = verifyLicense(key);
      if (!result.valid) {
        log.warn('[license] Activation failed:', result.error);
        return { success: false, error: result.error };
      }

      const db = getDb();
      const user = db.prepare('SELECT id FROM user_profile LIMIT 1').get();
      if (!user) return { success: false, error: 'no_user_profile' };

      db.prepare(`UPDATE user_profile SET
        license_key = ?, license_status = 'active', plan = ?,
        license_expires = ?, ai_tokens_limit = ?
        WHERE id = ?`).run(key, result.plan, result.expiresAt || null, result.limits.aiTokens > 0 ? result.limits.aiTokens : 9999999, user.id);

      log.info('[license] Activated:', result.plan, 'expires:', result.expiresAt ? new Date(result.expiresAt).toISOString() : 'never');
      return { success: true, ...result };
    } catch (err) {
      log.error('[license] Activation error:', err);
      return { success: false, error: 'internal_error' };
    }
  });

  // 停用 License（退回 free）
  ipcMain.handle('license:deactivate', () => {
    const db = getDb();
    const user = db.prepare('SELECT id FROM user_profile LIMIT 1').get();
    if (!user) return { success: false };
    db.prepare("UPDATE user_profile SET license_key = NULL, license_status = 'inactive', plan = 'free', license_expires = NULL, ai_tokens_limit = 50000 WHERE id = ?").run(user.id);
    log.info('[license] Deactivated');
    return { success: true };
  });

  // 查询当前 License 状态
  ipcMain.handle('license:status', () => {
    const db = getDb();
    const user = db.prepare('SELECT * FROM user_profile LIMIT 1').get();
    if (!user) return { plan: 'free', status: 'inactive', features: [], limits: PLANS.free };

    const plan = user.plan || 'free';
    const planDef = PLANS[plan] || PLANS.free;

    // 检查是否过期
    if (user.license_expires && user.license_expires < Date.now()) {
      db.prepare("UPDATE user_profile SET license_status = 'expired', plan = 'free' WHERE id = ?").run(user.id);
      return { plan: 'free', status: 'expired', features: [], limits: PLANS.free, expiredAt: user.license_expires };
    }

    return {
      plan,
      planName: planDef.name,
      status: user.license_status || 'inactive',
      licenseKey: user.license_key ? maskKey(user.license_key) : null,
      expiresAt: user.license_expires || null,
      features: planDef.features,
      limits: { maxWorkspaces: planDef.maxWorkspaces, maxDocuments: planDef.maxDocuments, aiTokens: planDef.aiTokens },
    };
  });

  // 检查某功能是否可用
  ipcMain.handle('license:check-feature', (_, { feature }) => {
    const db = getDb();
    const user = db.prepare('SELECT plan, license_expires FROM user_profile LIMIT 1').get();
    if (!user) return { allowed: false };
    if (user.license_expires && user.license_expires < Date.now()) return { allowed: false, reason: 'license_expired' };
    const plan = user.plan || 'free';
    const planDef = PLANS[plan] || PLANS.free;
    const allowed = plan === 'enterprise' || plan === 'pro' ? planDef.features.includes(feature) || true : planDef.features.includes(feature);
    return { allowed, plan };
  });

  log.info('[license] IPC handlers registered');
}

function maskKey(key) {
  const parts = key.split('-');
  return parts.map((p, i) => i < 2 ? p : '****').join('-');
}

module.exports = { registerLicenseHandlers, verifyLicense, PLANS };
