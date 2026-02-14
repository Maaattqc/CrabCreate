import nodemailer from 'nodemailer';
import config from '../config';

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (!transporter && config.smtpHost && config.smtpUser) {
    transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpPort === 465,
      auth: {
        user: config.smtpUser,
        pass: config.smtpPass,
      },
    });
  }
  return transporter;
}

const templates = {
  fr: {
    subject: 'Votre code de connexion CrabCreate',
    title: 'Votre code de connexion :',
    expiry: 'Ce code expire dans 10 minutes.',
    ignore: 'Si vous n\'avez pas demandé ce code, ignorez cet email.',
  },
  en: {
    subject: 'Your CrabCreate login code',
    title: 'Your login code:',
    expiry: 'This code expires in 10 minutes.',
    ignore: 'If you didn\'t request this code, ignore this email.',
  },
};

export async function sendAuthCode(email: string, code: string, lang: 'fr' | 'en' = 'fr'): Promise<void> {
  const smtp = getTransporter();
  if (!smtp) {
    // Only log code in dev when no SMTP is configured
    console.log(`[Auth] No SMTP configured — code for ${email}: ${code}`);
    return;
  }

  const t = templates[lang];

  try {
    await smtp.sendMail({
      from: config.emailFrom || config.smtpUser,
      to: email,
      subject: t.subject,
      html: `
        <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 40px 20px;">
          <h2 style="color: #f97316; margin-bottom: 8px;">🦀 CrabCreate</h2>
          <p style="color: #888; margin-bottom: 24px;">${t.title}</p>
          <div style="background: #1a1a2e; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #fff; font-family: monospace;">${code}</span>
          </div>
          <p style="color: #888; font-size: 14px;">${t.expiry}</p>
          <p style="color: #666; font-size: 12px; margin-top: 24px;">${t.ignore}</p>
        </div>
      `,
    });
    console.log(`[Auth] Email sent to ${email}`);
  } catch (err) {
    console.error('[Auth] Failed to send email:', err);
  }
}
