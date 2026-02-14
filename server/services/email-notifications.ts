import nodemailer from 'nodemailer';
import config from '../config';
import logger from './logger';
import * as repo from '../db/repositories';

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (!transporter && config.smtpHost && config.smtpUser) {
    transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpPort === 465,
      auth: { user: config.smtpUser, pass: config.smtpPass },
    });
  }
  return transporter;
}

function isEnabled(): boolean {
  const val = repo.getConfig('email_notifications_enabled');
  return val === '1' || val === 'true';
}

export async function notifyMention(mentionedUserId: number, commentContent: string, ticketId: number, mentionerEmail: string): Promise<void> {
  if (!isEnabled()) return;
  const smtp = getTransporter();
  if (!smtp) return;

  // Get the mentioned user's email
  const user = repo.findUserById(mentionedUserId);
  if (!user) return;

  try {
    await smtp.sendMail({
      from: config.emailFrom || config.smtpUser,
      to: user.email,
      subject: `[CrabCreate] You were mentioned in ticket #${ticketId}`,
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 30px 20px;">
          <h2 style="color: #f97316;">🦀 CrabCreate</h2>
          <p style="color: #888;">${mentionerEmail} mentioned you in ticket <strong>#${ticketId}</strong>:</p>
          <blockquote style="border-left: 3px solid #f97316; padding: 10px 15px; margin: 20px 0; background: #1a1a2e; border-radius: 0 8px 8px 0;">
            <p style="color: #ccc; margin: 0;">${commentContent.substring(0, 500)}</p>
          </blockquote>
        </div>
      `,
    });
    logger.info(`Email notification sent to ${user.email} for mention in ticket #${ticketId}`);
  } catch (err) {
    logger.error('Failed to send mention email:', err);
  }
}

export async function notifyStatusChange(ticketId: number, oldStatus: string, newStatus: string, projectId: number): Promise<void> {
  if (!isEnabled()) return;
  const smtp = getTransporter();
  if (!smtp) return;

  // Get watchers for this ticket
  const watchers = repo.findWatchersByTicketId(ticketId);
  if (watchers.length === 0) return;

  const ticket = repo.findTicketById(ticketId);
  if (!ticket) return;

  for (const watcher of watchers) {
    try {
      await smtp.sendMail({
        from: config.emailFrom || config.smtpUser,
        to: watcher.email,
        subject: `[CrabCreate] Ticket #${ticketId} status changed: ${oldStatus} → ${newStatus}`,
        html: `
          <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 30px 20px;">
            <h2 style="color: #f97316;">🦀 CrabCreate</h2>
            <p style="color: #888;">Ticket <strong>#${ticketId}: ${ticket.title}</strong> status changed:</p>
            <div style="display: flex; align-items: center; gap: 10px; margin: 20px 0;">
              <span style="padding: 5px 12px; border-radius: 20px; background: #333; color: #aaa; font-size: 14px;">${oldStatus}</span>
              <span style="color: #888;">&rarr;</span>
              <span style="padding: 5px 12px; border-radius: 20px; background: #f97316; color: white; font-size: 14px;">${newStatus}</span>
            </div>
          </div>
        `,
      });
    } catch (err) {
      logger.error(`Failed to send status change email to ${watcher.email}:`, err);
    }
  }
  logger.info(`Status change emails sent for ticket #${ticketId} (${watchers.length} watchers)`);
}
