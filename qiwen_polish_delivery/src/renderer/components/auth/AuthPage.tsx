import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../../store';
import { loginUser, registerUser, setLocalMode } from '../../store/slices/authSlice';

type Mode = 'login' | 'register';

// 密码强度检测（与后端一致）
function getPasswordStrength(pwd: string): { score: number; label: string; color: string } {
  if (!pwd) return { score: 0, label: '', color: 'transparent' };
  let score = 0;
  if (pwd.length >= 8) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[a-z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  if (score <= 1) return { score, label: '太弱', color: '#ff6b6b' };
  if (score === 2) return { score, label: '弱', color: '#ffa94d' };
  if (score === 3) return { score, label: '中', color: '#ffd43b' };
  if (score === 4) return { score, label: '强', color: '#69db7c' };
  return { score, label: '非常强', color: '#40c057' };
}

export const AuthPage: React.FC<{ onOffline?: () => void }> = ({ onOffline }) => {
  const dispatch = useDispatch<AppDispatch>();
  const [mode, setMode] = useState<Mode>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [form, setForm] = useState({
    email: '', username: '', password: '', confirmPassword: '', displayName: '',
  });
  // 忘记密码
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotCode, setForgotCode] = useState('');
  const [forgotNewPwd, setForgotNewPwd] = useState('');
  const [forgotConfirmPwd, setForgotConfirmPwd] = useState('');
  const [forgotStep, setForgotStep] = useState<'email'|'code'|'newpwd'|'done'>('email');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  // 修复 Electron 自动填充不触发 onChange 的问题
  // 用 ref 定时轮询实际 DOM 值，同步到 React state
  const emailRef = React.useRef<HTMLInputElement>(null);
  const passwordRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    // 轮询修复 Electron 自动填充不触发 onChange 的问题
    let mounted = true;
    const timer = setInterval(() => {
      if (!mounted) return;
      setForm(f => {
        const emailVal = emailRef.current?.value ?? f.email;
        const pwdVal = passwordRef.current?.value ?? f.password;
        if (emailVal !== f.email || pwdVal !== f.password) {
          return { ...f, email: emailVal, password: pwdVal };
        }
        return f;
      });
    }, 200);
    return () => { mounted = false; clearInterval(timer); };
  }, []);

  const pwdStrength = getPasswordStrength(form.password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess('');

    // 直接读 ref DOM 值，彻底解决 Electron 自动填充不触发 onChange 的问题
    const emailVal = (emailRef.current?.value || form.email || '').trim();
    const pwdVal = passwordRef.current?.value || form.password || '';

    if (mode === 'register') {
      if (!emailVal) return setError('请输入邮箱');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) return setError('邮箱格式不正确');
      if (!form.username.trim() || form.username.trim().length < 2) return setError('用户名至少2位');
      if (form.username.trim().length > 20) return setError('用户名不超过20位');
      if (pwdVal.length < 8) return setError('密码至少8位');
      if (!/[A-Z]/.test(pwdVal)) return setError('密码需包含至少一个大写字母');
      if (!/[a-z]/.test(pwdVal)) return setError('密码需包含至少一个小写字母');
      if (!/[0-9]/.test(pwdVal)) return setError('密码需包含至少一个数字');
      if (pwdVal !== form.confirmPassword) return setError('两次密码不一致');
    } else {
      if (!emailVal) return setError('请输入邮箱或用户名');
      if (!pwdVal) return setError('请输入密码');
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        await dispatch(loginUser({
          emailOrUsername: emailVal,
          password: pwdVal,
          rememberMe: true,
        })).unwrap();
      } else {
        await dispatch(registerUser({
          email: emailVal,
          username: form.username.trim(),
          password: pwdVal,
          displayName: form.displayName.trim() || form.username.trim(),
        })).unwrap();
        setSuccess('注册成功！正在进入...');
      }
    } catch (err: any) {
      setError(err.message || '操作失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSend = async () => {
    if (!forgotEmail.trim()) { setForgotError('请输入注册邮箱'); return; }
    setForgotLoading(true); setForgotError('');
    try {
      const res = await fetch('https://api.bitwool.cn/api/auth/forgot-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail.trim() }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message || '发送失败'); }
      setForgotStep('code');
    } catch (e: any) { setForgotError(e.message || '发送失败，请稍后重试'); }
    finally { setForgotLoading(false); }
  };

  const handleForgotVerify = async () => {
    if (forgotCode.length !== 6) { setForgotError('请输入6位验证码'); return; }
    setForgotLoading(true); setForgotError('');
    try {
      const res = await fetch('https://api.bitwool.cn/api/auth/verify-reset-code', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail.trim(), code: forgotCode }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message || '验证码错误'); }
      setForgotStep('newpwd');
    } catch (e: any) { setForgotError(e.message || '验证码错误或已过期'); }
    finally { setForgotLoading(false); }
  };

  const handleForgotReset = async () => {
    if (!forgotNewPwd || forgotNewPwd.length < 8) { setForgotError('密码至少8位'); return; }
    if (!/[A-Z]/.test(forgotNewPwd)) { setForgotError('密码需包含大写字母'); return; }
    if (!/[a-z]/.test(forgotNewPwd)) { setForgotError('密码需包含小写字母'); return; }
    if (!/[0-9]/.test(forgotNewPwd)) { setForgotError('密码需包含数字'); return; }
    if (forgotNewPwd !== forgotConfirmPwd) { setForgotError('两次密码不一致'); return; }
    setForgotLoading(true); setForgotError('');
    try {
      const res = await fetch('https://api.bitwool.cn/api/auth/reset-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail.trim(), code: forgotCode, newPassword: forgotNewPwd }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message || '重置失败'); }
      setForgotStep('done');
    } catch (e: any) { setForgotError(e.message || '重置失败，请重试'); }
    finally { setForgotLoading(false); }
  };

  const inp: React.CSSProperties = {
    width: '100%', padding: '11px 14px', borderRadius: 'var(--radius-lg)',
    background: 'var(--bg-surface3)', border: '0.5px solid var(--border)',
    color: 'var(--text-primary)', fontSize: 14, outline: 'none',
    fontFamily: 'inherit', boxSizing: 'border-box',
    transition: 'border-color .2s, box-shadow .2s',
  };

  const Label: React.FC<{ text: string; hint?: string }> = ({ text, hint }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
      <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-secondary)' }}>{text}</span>
      {hint && <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{hint}</span>}
    </div>
  );

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-base)', padding: 20,
    }}>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        style={{
          width: '100%', maxWidth: 420,
          background: 'var(--bg-surface)',
          border: '0.5px solid var(--border)',
          borderRadius: 22,
          padding: '40px 36px 32px',
          boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 30 }}>
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            style={{
              width: 56, height: 56, borderRadius: 16, margin: '0 auto 14px',
              background: 'linear-gradient(145deg, #d4b47a, #7a4e20)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 26, color: '#fff',
              boxShadow: '0 4px 16px rgba(154,112,64,0.35)',
              fontFamily: 'var(--font-serif)',
            }}
          >文</motion.div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, letterSpacing: 5, color: 'var(--text-primary)', marginBottom: 5 }}>启文</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)', letterSpacing: 1 }}>启于思，行于文</div>
        </div>

        {/* 忘记密码界面 */}
        {forgotMode ? (
          <div>
            {/* 步骤条 */}
            {forgotStep !== 'done' && (
              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:20 }}>
                {(['email','code','newpwd'] as const).map((step, i) => (
                  <React.Fragment key={step}>
                    <div style={{ width:24, height:24, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11.5, fontWeight:600, flexShrink:0,
                      background: forgotStep === step ? 'linear-gradient(135deg,var(--accent),#9a7040)' : (['email','code','newpwd'].indexOf(forgotStep) > i ? 'rgba(var(--accent-rgb), .25)' : 'var(--bg-surface3)'),
                      color: forgotStep === step ? '#fff' : (['email','code','newpwd'].indexOf(forgotStep) > i ? 'var(--accent)' : 'var(--text-tertiary)'),
                    }}>{i+1}</div>
                    {i < 2 && <div style={{ flex:1, height:1, background: ['email','code','newpwd'].indexOf(forgotStep) > i ? 'var(--accent)' : 'var(--border)' }} />}
                  </React.Fragment>
                ))}
              </div>
            )}

            {forgotStep === 'email' && (<>
              <div style={{ fontSize:13, color:'var(--text-secondary)', marginBottom:16, lineHeight:1.6 }}>输入注册邮箱，我们将发送一个 <strong>6位验证码</strong>，有效期15分钟。</div>
              <Label text="注册邮箱" />
              <input value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} placeholder="your@email.com" type="email" autoFocus style={{ ...inp, marginBottom:16 }} onKeyDown={e => e.key==='Enter' && handleForgotSend()} />
            </>)}

            {forgotStep === 'code' && (<>
              <div style={{ fontSize:13, color:'var(--text-secondary)', marginBottom:16, lineHeight:1.6 }}>验证码已发送到 <strong style={{ color:'var(--accent)' }}>{forgotEmail}</strong></div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                <Label text="验证码" />
                <button onClick={() => { setForgotCode(''); handleForgotSend(); }} style={{ border:'none', background:'none', cursor:'pointer', color:'var(--accent)', fontSize:12, fontFamily:'inherit', padding:0 }}>重新发送</button>
              </div>
              <input value={forgotCode} onChange={e => setForgotCode(e.target.value.replace(/[^\d]/g, '').slice(0,6))} placeholder="请输入6位验证码" maxLength={6} autoFocus
                style={{ ...inp, letterSpacing:8, fontSize:22, textAlign:'center', fontFamily:'monospace', marginBottom:16 }} onKeyDown={e => e.key==='Enter' && handleForgotVerify()} />
            </>)}

            {forgotStep === 'newpwd' && (<>
              <div style={{ fontSize:13, color:'#40c057', background:'rgba(105,219,124,.08)', border:'0.5px solid rgba(105,219,124,.3)', borderRadius: 'var(--radius-md)', padding:'9px 13px', marginBottom:16 }}>✓ 验证成功，请设置新密码</div>
              <Label text="新密码" hint="至少8位，含大小写和数字" />
              <input value={forgotNewPwd} onChange={e => setForgotNewPwd(e.target.value)} placeholder="至少8位，含大小写和数字" type="password" style={{ ...inp, marginBottom:12 }} />
              <Label text="确认新密码" />
              <input value={forgotConfirmPwd} onChange={e => setForgotConfirmPwd(e.target.value)} placeholder="再输入一次" type="password" style={{ ...inp, marginBottom:16 }} onKeyDown={e => e.key==='Enter' && handleForgotReset()} />
            </>)}

            {forgotStep === 'done' && (
              <div style={{ textAlign:'center', padding:'16px 0 8px' }}>
                <div style={{ fontSize:44, marginBottom:12 }}>✅</div>
                <div style={{ fontSize:16, fontWeight:600, color:'var(--text-primary)', marginBottom:8 }}>密码重置成功</div>
                <div style={{ fontSize:13, color:'var(--text-tertiary)', marginBottom:20 }}>请用新密码重新登录</div>
                <button onClick={() => { setForgotMode(false); setForgotStep('email'); setForgotCode(''); setForgotNewPwd(''); setForgotConfirmPwd(''); setForgotError(''); }}
                  style={{ padding:'10px 32px', borderRadius: 'var(--radius-lg)', border:'none', background:'linear-gradient(135deg,var(--accent),#9a7040)', color:'#fff', fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                  去登录
                </button>
              </div>
            )}

            {forgotError && (
              <div style={{ fontSize:13, color:'#ff6b6b', background:'rgba(255,107,107,.08)', border:'0.5px solid rgba(255,107,107,.25)', borderRadius: 'var(--radius-md)', padding:'9px 13px', marginBottom:14 }}>⚠ {forgotError}</div>
            )}

            {forgotStep === 'email' && (
              <button onClick={handleForgotSend} disabled={forgotLoading} style={{ width:'100%', padding:'12px', borderRadius: 'var(--radius-lg)', border:'none', background:'linear-gradient(135deg,var(--accent),#9a7040)', color:'#fff', fontSize:14.5, fontWeight:600, cursor: forgotLoading ? 'not-allowed' : 'pointer', opacity: forgotLoading ? .7 : 1, fontFamily:'inherit', marginBottom:14 }}>
                {forgotLoading ? '发送中...' : '发送验证码'}
              </button>
            )}
            {forgotStep === 'code' && (
              <button onClick={handleForgotVerify} disabled={forgotLoading || forgotCode.length !== 6} style={{ width:'100%', padding:'12px', borderRadius: 'var(--radius-lg)', border:'none', background:'linear-gradient(135deg,var(--accent),#9a7040)', color:'#fff', fontSize:14.5, fontWeight:600, cursor: (forgotLoading || forgotCode.length !== 6) ? 'not-allowed' : 'pointer', opacity: (forgotLoading || forgotCode.length !== 6) ? .7 : 1, fontFamily:'inherit', marginBottom:14 }}>
                {forgotLoading ? '验证中...' : '验证'}
              </button>
            )}
            {forgotStep === 'newpwd' && (
              <button onClick={handleForgotReset} disabled={forgotLoading} style={{ width:'100%', padding:'12px', borderRadius: 'var(--radius-lg)', border:'none', background:'linear-gradient(135deg,var(--accent),#9a7040)', color:'#fff', fontSize:14.5, fontWeight:600, cursor: forgotLoading ? 'not-allowed' : 'pointer', opacity: forgotLoading ? .7 : 1, fontFamily:'inherit', marginBottom:14 }}>
                {forgotLoading ? '重置中...' : '确认重置密码'}
              </button>
            )}

            {forgotStep !== 'done' && (
              <div style={{ textAlign:'center', paddingTop:4 }}>
                <button onClick={() => { setForgotMode(false); setForgotStep('email'); setForgotError(''); setForgotCode(''); }}
                  style={{ border:'none', background:'none', cursor:'pointer', fontSize:13, color:'var(--text-tertiary)', fontFamily:'inherit' }}>← 返回登录</button>
              </div>
            )}
          </div>
        ) : (<>

        {/* 模式切换 */}
        <div style={{
          display: 'flex', background: 'var(--bg-surface2)',
          borderRadius: 'var(--radius-lg)', padding: 4, marginBottom: 28,
          border: '0.5px solid var(--border)',
        }}>
          {(['login', 'register'] as Mode[]).map(m => (
            <button key={m} onClick={() => { setMode(m); setError(''); setSuccess(''); }}
              style={{
                flex: 1, padding: '8px', border: 'none', cursor: 'pointer',
                borderRadius: 'var(--radius-md)', fontSize: 13.5, fontFamily: 'inherit', fontWeight: 500,
                background: mode === m ? 'linear-gradient(135deg, var(--accent), #9a7040)' : 'transparent',
                color: mode === m ? '#fff' : 'var(--text-tertiary)',
                boxShadow: mode === m ? '0 2px 8px rgba(154,112,64,0.3)' : 'none',
                transition: 'all .2s',
              }}
            >{m === 'login' ? '登录' : '注册'}</button>
          ))}
        </div>

        <AnimatePresence>
          <motion.form
            key={mode}
            initial={{ opacity: 0, x: mode === 'register' ? 20 : -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: mode === 'register' ? -20 : 20 }}
            transition={{ duration: 0.2 }}
            onSubmit={handleSubmit}
          >
            {/* 邮箱 / 用户名 */}
            <div style={{ marginBottom: 14 }}>
              <Label text="邮箱" hint={mode === 'login' ? '或用户名' : undefined} />
              <input ref={emailRef} style={inp} type={mode === 'login' ? 'text' : 'email'}
                placeholder={mode === 'login' ? '邮箱或用户名' : 'your@email.com'}
                value={form.email} onChange={set('email')}
                onBlur={e => setForm(f => ({ ...f, email: e.target.value }))}
                autoComplete={mode === 'login' ? 'username' : 'email'} />
            </div>

            {/* 用户名（注册专用） */}
            {mode === 'register' && (
              <div style={{ marginBottom: 14 }}>
                <Label text="用户名" hint="2-20位" />
                <input style={inp} type="text"
                  placeholder="字母、数字或中文"
                  value={form.username} onChange={set('username')}
                  autoComplete="username" />
              </div>
            )}

            {/* 昵称（注册专用，可选） */}
            {mode === 'register' && (
              <div style={{ marginBottom: 14 }}>
                <Label text="昵称" hint="可选，留空使用用户名" />
                <input style={inp} type="text"
                  placeholder="你的显示名称"
                  value={form.displayName} onChange={set('displayName')} />
              </div>
            )}

            {/* 密码 */}
            <div style={{ marginBottom: mode === 'register' ? 8 : 20 }}>
              {mode === 'login' ? (
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
                  <span style={{ fontSize:12.5, fontWeight:500, color:'var(--text-secondary)' }}>密码</span>
                  <button type="button" onClick={() => { setForgotMode(true); setForgotEmail(form.email); setForgotError(''); }}
                    style={{ border:'none', background:'none', cursor:'pointer', color:'var(--accent)', fontSize:12, fontFamily:'inherit', padding:0 }}>
                    忘记密码？
                  </button>
                </div>
              ) : (
                <Label text="密码" hint="至少8位，含大小写和数字" />
              )}
              <div style={{ position: 'relative' }}>
                <input
                  ref={mode === 'login' ? passwordRef : undefined}
                  style={{ ...inp, paddingRight: 52 }}
                  type={showPwd ? 'text' : 'password'}
                  placeholder={mode === 'register' ? '至少8位，含大小写和数字' : '请输入密码'}
                  value={form.password} onChange={set('password')}
                  onBlur={e => setForm(f => ({ ...f, password: e.target.value }))}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                />
                <button type="button" onClick={() => setShowPwd(v => !v)}
                  style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    border: 'none', background: 'none', cursor: 'pointer',
                    color: 'var(--text-tertiary)', fontSize: 12, padding: 0, fontFamily: 'inherit',
                  }}>
                  {showPwd ? '隐藏' : '显示'}
                </button>
              </div>
            </div>

            {/* 密码强度条（注册专用） */}
            {mode === 'register' && form.password && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} style={{
                      flex: 1, height: 3, borderRadius: 2,
                      background: i <= pwdStrength.score ? pwdStrength.color : 'var(--bg-surface3)',
                      transition: 'background .3s',
                    }} />
                  ))}
                </div>
                <div style={{ fontSize: 11.5, color: pwdStrength.color, textAlign: 'right' }}>
                  {pwdStrength.label}
                </div>
              </div>
            )}

            {/* 确认密码（注册专用） */}
            {mode === 'register' && (
              <div style={{ marginBottom: 20 }}>
                <Label text="确认密码" />
                <div style={{ position: 'relative' }}>
                  <input
                    style={{
                      ...inp, paddingRight: 52,
                      borderColor: form.confirmPassword && form.password !== form.confirmPassword
                        ? 'rgba(var(--color-danger-rgb), 0.6)' : undefined,
                    }}
                    type={showConfirmPwd ? 'text' : 'password'}
                    placeholder="再输入一次密码"
                    value={form.confirmPassword} onChange={set('confirmPassword')}
                    autoComplete="new-password"
                  />
                  <button type="button" onClick={() => setShowConfirmPwd(v => !v)}
                    style={{
                      position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                      border: 'none', background: 'none', cursor: 'pointer',
                      color: 'var(--text-tertiary)', fontSize: 12, padding: 0, fontFamily: 'inherit',
                    }}>
                    {showConfirmPwd ? '隐藏' : '显示'}
                  </button>
                </div>
                {form.confirmPassword && form.password !== form.confirmPassword && (
                  <div style={{ fontSize: 11.5, color: '#ff6b6b', marginTop: 4 }}>两次密码不一致</div>
                )}
              </div>
            )}

            {/* 错误提示 */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  style={{
                    fontSize: 13, color: 'var(--color-danger)',
                    background: 'rgba(var(--color-danger-rgb), 0.08)',
                    border: '0.5px solid rgba(var(--color-danger-rgb), 0.25)',
                    borderRadius: 'var(--radius-md)', padding: '9px 13px', marginBottom: 14,
                    display: 'flex', alignItems: 'center', gap: 7,
                  }}
                >
                  <span style={{ fontSize: 15 }}>⚠</span> {error}
                </motion.div>
              )}
            </AnimatePresence>

            {/* 成功提示 */}
            <AnimatePresence>
              {success && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  style={{
                    fontSize: 13, color: '#69db7c',
                    background: 'rgba(105,219,124,0.08)',
                    border: '0.5px solid rgba(105,219,124,0.25)',
                    borderRadius: 'var(--radius-md)', padding: '9px 13px', marginBottom: 14,
                    display: 'flex', alignItems: 'center', gap: 7,
                  }}
                >
                  <span style={{ fontSize: 15 }}>✓</span> {success}
                </motion.div>
              )}
            </AnimatePresence>

            {/* 提交按钮 */}
            <button type="submit" disabled={loading}
              style={{
                width: '100%', padding: '12px', borderRadius: 'var(--radius-lg)', border: 'none',
                background: loading
                  ? 'var(--bg-surface3)'
                  : 'linear-gradient(135deg, var(--accent), #9a7040)',
                color: loading ? 'var(--text-tertiary)' : '#fff',
                fontSize: 14.5, fontWeight: 600, fontFamily: 'inherit',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all var(--dur-base) var(--ease-smooth)', marginBottom: 16,
                boxShadow: loading ? 'none' : '0 4px 14px rgba(154,112,64,0.3)',
                letterSpacing: 0.5,
              }}>
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  请稍等...
                </span>
              ) : mode === 'login' ? '登录' : '注册并开始使用'}
            </button>

            {/* 密码要求说明（注册专用） */}
            {mode === 'register' && (
              <div style={{
                fontSize: 11.5, color: 'var(--text-tertiary)',
                background: 'var(--bg-surface2)', borderRadius: 'var(--radius-md)',
                padding: '8px 12px', marginBottom: 14, lineHeight: 1.8,
              }}>
                密码要求：至少 <strong style={{ color: 'var(--text-secondary)' }}>8位</strong>，
                包含 <strong style={{ color: 'var(--text-secondary)' }}>大写字母</strong>、
                <strong style={{ color: 'var(--text-secondary)' }}>小写字母</strong> 和
                <strong style={{ color: 'var(--text-secondary)' }}>数字</strong>
              </div>
            )}
          </motion.form>
        </AnimatePresence>

        {/* 本地模式 */}
        </>)}
        <div style={{ textAlign: 'center', paddingTop: 14, borderTop: '0.5px solid var(--border)' }}>
          <button onClick={onOffline}
            style={{
              border: 'none', background: 'none', cursor: 'pointer',
              fontSize: 13, color: 'var(--text-tertiary)', fontFamily: 'inherit',
              padding: '4px 8px', borderRadius: 'var(--radius-md)', transition: 'color .15s',
            }}>
            不登录，使用本地模式 →
          </button>
        </div>
      </motion.div>
    </div>
  );
};
