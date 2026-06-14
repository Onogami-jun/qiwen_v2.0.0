/**
 * OrgManageView.tsx — 组织管理后台
 * src/renderer/components/org/OrgManageView.tsx
 */
import React, { useState, useEffect, useCallback } from 'react';
import { cloudSync, OrgMember, Organization } from '../../services/cloudSync';

type Tab = 'members' | 'invitations' | 'audit' | 'settings';

const ROLE_LABELS: Record<string, string> = {
  owner: '所有者', admin: '管理员', member: '成员', guest: '访客',
};
const ROLE_COLORS: Record<string, string> = {
  owner: '#c8a96e', admin: '#52c97a', member: '#5b9cf6', guest: '#8a8a84',
};

interface Props { orgId: string; }

export const OrgManageView: React.FC<Props> = ({ orgId }) => {
  const [tab, setTab] = useState<Tab>('members');
  const [org, setOrg] = useState<Organization | null>(null);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [inviteLink, setInviteLink] = useState('');
  const [inviting, setInviting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [orgs, mems] = await Promise.all([
        cloudSync.getMyOrganizations(),
        cloudSync.getOrgMembers(orgId),
      ]);
      setOrg(orgs.find(o => o.id === orgId) || null);
      setMembers(mems);
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    } finally { setLoading(false); }
  }, [orgId]);

  const loadAudit = useCallback(async () => {
    try {
      const logs = await cloudSync.getAuditLogs(orgId);
      setAuditLogs(logs);
    } catch {}
  }, [orgId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (tab === 'audit') loadAudit(); }, [tab, loadAudit]);

  const handleInvite = async () => {
    if (!inviteEmail.trim() && !inviteRole) return;
    setInviting(true);
    setMessage(null);
    try {
      const token = await cloudSync.inviteMember(orgId, inviteEmail.trim(), inviteRole);
      const link = `https://bitwool.cn/invite/${token}`;
      setInviteLink(link);
      setMessage({ type: 'success', text: '邀请链接已生成' });
      setInviteEmail('');
      await cloudSync.logAuditEvent(orgId, 'member.invite', 'invitation', token, { email: inviteEmail, role: inviteRole });
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    } finally { setInviting(false); }
  };

  const handleRemoveMember = async (userId: string, name: string) => {
    if (!window.confirm(`确认移除成员 ${name}？`)) return;
    try {
      await cloudSync.removeMember(orgId, userId);
      await cloudSync.logAuditEvent(orgId, 'member.remove', 'user', userId as any, { name });
      await load();
      setMessage({ type: 'success', text: `已移除 ${name}` });
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await cloudSync.updateMemberRole(orgId, userId, newRole);
      await cloudSync.logAuditEvent(orgId, 'member.role_change', 'user', userId as any, { newRole });
      await load();
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    }
  };

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: 'members', label: '成员管理', icon: '👥' },
    { id: 'invitations', label: '邀请成员', icon: '✉️' },
    { id: 'audit', label: '审计日志', icon: '📋' },
    { id: 'settings', label: '组织设置', icon: '⚙️' },
  ];

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: 'var(--bg-editor, #1e1e1e)', color: 'var(--text-primary)',
      overflow: 'hidden',
    }}>
      {/* ── 顶部 header ── */}
      <div style={{
        padding: '24px 32px 0', borderBottom: '1px solid var(--border)',
        flexShrink: 0, background: 'var(--bg-base)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 10,
            background: 'rgba(200,169,110,0.12)', border: '1px solid rgba(200,169,110,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0,
          }}>🏢</div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: -0.2 }}>{org?.name || '组织管理'}</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
              {members.length} 名成员 · {org?.plan === 'enterprise' ? '企业版' : org?.plan === 'pro' ? '专业版' : '免费版'}
            </div>
          </div>
        </div>
        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 0 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: '8px 18px', background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 13, color: tab === t.id ? 'var(--accent)' : 'var(--text-tertiary)',
              borderBottom: `2px solid ${tab === t.id ? 'var(--accent)' : 'transparent'}`,
              fontFamily: 'inherit', transition: 'color 0.15s', marginBottom: -1,
            }}>
              <span style={{ marginRight: 6 }}>{t.icon}</span>{t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── 消息提示 ── */}
      {message && (
        <div style={{
          margin: '14px 32px 0', padding: '9px 14px', borderRadius: 8, fontSize: 13,
          background: message.type === 'success' ? 'rgba(82,201,122,0.08)' : 'rgba(232,122,122,0.08)',
          color: message.type === 'success' ? '#52c97a' : '#e87a7a',
          border: `1px solid ${message.type === 'success' ? 'rgba(82,201,122,0.25)' : 'rgba(232,122,122,0.25)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 16, lineHeight: 1, opacity: 0.6, padding: '0 2px' }}>×</button>
        </div>
      )}

      {/* ── 内容区（居中布局）── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px 48px' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--text-tertiary)', gap: 10 }}>
            <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--accent)', animation: 'spin 0.7s linear infinite' }} />
            <span style={{ fontSize: 13 }}>加载中…</span>
          </div>
        ) : tab === 'members' ? (
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              成员列表 <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>({members.length}/{org?.maxMembers ?? '∞'})</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {members.map(m => (
                <div key={m.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px',
                  background: 'var(--bg-surface2)',
                  borderRadius: 10, border: '1px solid var(--border)',
                  transition: 'border-color 0.15s',
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 9,
                    background: m.avatarColor, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: 14, color: '#fff', fontWeight: 700, flexShrink: 0,
                  }}>
                    {m.displayName.slice(0, 1).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 500 }}>{m.displayName}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>
                      加入于 {new Date(m.joinedAt).toLocaleDateString('zh-CN')}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 11, color: ROLE_COLORS[m.role],
                    background: `${ROLE_COLORS[m.role]}15`,
                    padding: '3px 9px', borderRadius: 5,
                    border: `1px solid ${ROLE_COLORS[m.role]}30`,
                    fontWeight: 500, letterSpacing: 0.2,
                  }}>
                    {ROLE_LABELS[m.role]}
                  </span>
                  {m.role !== 'owner' && (
                    <>
                      <select
                        value={m.role}
                        onChange={e => handleRoleChange(m.userId, e.target.value)}
                        style={{
                          padding: '5px 8px', borderRadius: 7,
                          border: '1px solid var(--border)',
                          background: 'var(--bg-surface3)',
                          color: 'var(--text-secondary)', fontSize: 12,
                          cursor: 'pointer', fontFamily: 'inherit',
                        }}>
                        {Object.entries(ROLE_LABELS).filter(([k]) => k !== 'owner').map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                      <button onClick={() => handleRemoveMember(m.userId, m.displayName)}
                        style={{
                          padding: '5px 11px', borderRadius: 7,
                          border: '1px solid rgba(232,122,122,0.3)',
                          background: 'rgba(232,122,122,0.06)',
                          color: '#e87a7a', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
                          transition: 'background 0.15s',
                        }}>
                        移除
                      </button>
                    </>
                  )}
                </div>
              ))}
              {members.length === 0 && (
                <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13, opacity: 0.6 }}>
                  暂无成员
                </div>
              )}
            </div>
          </div>

        ) : tab === 'invitations' ? (
          <div style={{ maxWidth: 520, margin: '0 auto' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: 0.5 }}>邀请新成员</div>
            <div style={{ background: 'var(--bg-surface2)', borderRadius: 14, padding: 24, border: '1px solid var(--border)' }}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, color: 'var(--text-tertiary)', display: 'block', marginBottom: 7, letterSpacing: 0.2 }}>邮箱地址（可选，留空生成通用邀请链接）</label>
                <input
                  value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  style={{
                    width: '100%', padding: '10px 13px', borderRadius: 9,
                    border: '1px solid var(--border-md)', background: 'var(--bg-surface3)',
                    color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit',
                    outline: 'none', boxSizing: 'border-box',
                  }} />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 12, color: 'var(--text-tertiary)', display: 'block', marginBottom: 8, letterSpacing: 0.2 }}>角色</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['member', 'admin', 'guest'] as const).map(role => (
                    <button key={role} onClick={() => setInviteRole(role)}
                      style={{
                        flex: 1, padding: '8px 0', borderRadius: 8,
                        border: `1px solid ${inviteRole === role ? ROLE_COLORS[role] : 'var(--border)'}`,
                        background: inviteRole === role ? `${ROLE_COLORS[role]}12` : 'var(--bg-surface3)',
                        color: inviteRole === role ? ROLE_COLORS[role] : 'var(--text-secondary)',
                        cursor: 'pointer', fontSize: 12.5, fontFamily: 'inherit',
                        fontWeight: inviteRole === role ? 600 : 400,
                        transition: 'all 0.15s',
                      }}>
                      {ROLE_LABELS[role]}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={handleInvite} disabled={inviting}
                style={{
                  width: '100%', padding: '10px 0', borderRadius: 9, border: 'none',
                  background: 'var(--accent)', color: '#fff',
                  cursor: inviting ? 'wait' : 'pointer', fontSize: 13.5,
                  fontWeight: 600, fontFamily: 'inherit', opacity: inviting ? 0.7 : 1,
                  letterSpacing: 0.2, transition: 'opacity 0.15s',
                }}>
                {inviting ? '生成中…' : '生成邀请链接'}
              </button>
              {inviteLink && (
                <div style={{ marginTop: 16, padding: '12px 14px', background: 'var(--bg-surface3)', borderRadius: 9, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 7, letterSpacing: 0.2 }}>邀请链接（7天有效）</div>
                  <div style={{ fontSize: 12, fontFamily: 'monospace', color: '#52c97a', wordBreak: 'break-all', lineHeight: 1.6 }}>{inviteLink}</div>
                  <button onClick={() => navigator.clipboard.writeText(inviteLink)}
                    style={{
                      marginTop: 10, fontSize: 12, padding: '5px 12px',
                      background: 'none', border: '1px solid var(--border)',
                      borderRadius: 6, color: 'var(--text-secondary)',
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}>
                    复制链接
                  </button>
                </div>
              )}
            </div>
          </div>

        ) : tab === 'audit' ? (
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: 0.5 }}>操作审计日志</div>
            <div style={{ background: 'var(--bg-surface2)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
              {auditLogs.length === 0 ? (
                <div style={{ padding: '48px 0', color: 'var(--text-tertiary)', fontSize: 13, textAlign: 'center', opacity: 0.6 }}>暂无审计记录</div>
              ) : auditLogs.map((log, idx) => (
                <div key={log.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '11px 16px', fontSize: 13,
                  borderBottom: idx < auditLogs.length - 1 ? '1px solid var(--border)' : 'none',
                }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: 8,
                    background: log.user_profiles?.avatar_color || '#555',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, color: '#fff', fontWeight: 700, flexShrink: 0,
                  }}>
                    {(log.user_profiles?.display_name || '?').slice(0, 1).toUpperCase()}
                  </div>
                  <span style={{ color: 'var(--text-secondary)', minWidth: 90, fontSize: 12.5 }}>{log.user_profiles?.display_name || '系统'}</span>
                  <span style={{ color: 'var(--accent)', fontFamily: 'monospace', fontSize: 12, background: 'rgba(200,169,110,0.08)', padding: '2px 8px', borderRadius: 4 }}>{log.action}</span>
                  {log.resource_type && <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{log.resource_type}</span>}
                  <span style={{ color: 'var(--text-tertiary)', fontSize: 11, marginLeft: 'auto', opacity: 0.7 }}>
                    {new Date(log.created_at).toLocaleString('zh-CN')}
                  </span>
                </div>
              ))}
            </div>
          </div>

        ) : (
          <div style={{ maxWidth: 520, margin: '0 auto' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: 0.5 }}>组织设置</div>
            <div style={{
              background: 'var(--bg-surface2)', borderRadius: 14, padding: '24px',
              border: '1px solid var(--border)', color: 'var(--text-tertiary)', fontSize: 13,
              textAlign: 'center', lineHeight: 1.8,
            }}>
              组织名称、Logo、自定义域名等高级设置<br />
              <span style={{ color: 'var(--accent)', opacity: 0.7, fontSize: 12 }}>企业版功能，开发中</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
