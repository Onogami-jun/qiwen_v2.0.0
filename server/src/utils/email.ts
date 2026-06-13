import nodemailer from 'nodemailer';
import { config } from '../config';
import { logger } from './logger';

const transporter = nodemailer.createTransport({
  host: config.email.host,
  port: config.email.port,
  secure: config.email.port === 465,
  auth: { user: config.email.user, pass: config.email.pass },
});

async function sendMail(to: string, subject: string, html: string) {
  if (config.isDev && !config.email.user) {
    logger.info(`[DEV EMAIL] To: ${to}\nSubject: ${subject}\n${html.replace(/<[^>]+>/g, '')}`);
    return;
  }
  await transporter.sendMail({
    from: `"${config.email.fromName}" <${config.email.from}>`,
    to, subject, html,
  });
}

export async function sendVerificationEmail(email: string, name: string, token: string) {
  const url = `${config.server.apiUrl}/api/auth/verify-email?token=${token}`;
  await sendMail(email, '验证您的启文账户', `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:40px 20px">
      <div style="text-align:center;margin-bottom:32px">
        <div style="width:48px;height:48px;background:linear-gradient(135deg,#c8a96e,#8b7355);border-radius:12px;display:inline-flex;align-items:center;justify-content:center;font-size:24px;color:#fff;font-family:serif">文</div>
        <h1 style="margin:16px 0 4px;font-size:22px;color:#1a1a1a">欢迎加入启文</h1>
        <p style="color:#666;margin:0">Hi ${name}，请验证您的邮箱地址</p>
      </div>
      <a href="${url}" style="display:block;text-align:center;background:linear-gradient(135deg,#c8a96e,#8b7355);color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:15px;font-weight:500;margin-bottom:24px">
        验证邮箱地址
      </a>
      <p style="color:#999;font-size:13px;text-align:center">链接 24 小时内有效。如非本人操作，请忽略此邮件。</p>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
      <p style="color:#ccc;font-size:11px;text-align:center">© 2024 启文软件</p>
    </div>
  `);
}

export async function sendPasswordResetEmail(email: string, name: string, token: string) {
  const url = `${config.server.clientUrl}/reset-password?token=${token}`;
  await sendMail(email, '重置启文账户密码', `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:40px 20px">
      <div style="text-align:center;margin-bottom:32px">
        <div style="width:48px;height:48px;background:linear-gradient(135deg,#c8a96e,#8b7355);border-radius:12px;display:inline-flex;align-items:center;justify-content:center;font-size:24px;color:#fff;font-family:serif">文</div>
        <h1 style="margin:16px 0 4px;font-size:22px;color:#1a1a1a">重置密码</h1>
        <p style="color:#666;margin:0">Hi ${name}，我们收到了您的密码重置请求</p>
      </div>
      <a href="${url}" style="display:block;text-align:center;background:linear-gradient(135deg,#c8a96e,#8b7355);color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:15px;font-weight:500;margin-bottom:24px">
        重置密码
      </a>
      <p style="color:#999;font-size:13px;text-align:center">链接 1 小时内有效。如非本人操作，请立即修改密码。</p>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
      <p style="color:#ccc;font-size:11px;text-align:center">© 2024 启文软件</p>
    </div>
  `);
}
