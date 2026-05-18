const nodemailer = require('nodemailer');
const db = require('../db/database');

let transporter = null;

function getTransporter() {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_REFRESH_TOKEN) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: process.env.GMAIL_USER,
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        refreshToken: process.env.GMAIL_REFRESH_TOKEN,
      },
    });
  }
  return transporter;
}

const ICONS = {
  assigned: '📋',
  mention: '💬',
  card_moved: '🔀',
  role_changed: '🛡️',
};

async function sendNotificationEmail(userId, type, message, cardId, boardId) {
  const t = getTransporter();
  if (!t) return;
  try {
    const user = await db.prepare('SELECT email, name FROM users WHERE id = ?').get(userId);
    if (!user?.email) return;

    const icon = ICONS[type] || '🔔';
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const boardLink = boardId ? `${clientUrl}/boards/${boardId}` : clientUrl;

    await t.sendMail({
      from: `"Workboard" <${process.env.GMAIL_USER}>`,
      to: user.email,
      subject: `${icon} ${message}`,
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;">
          <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:20px 24px;border-radius:12px 12px 0 0;">
            <h2 style="color:#fff;margin:0;font-size:18px;font-weight:700;">Workboard</h2>
          </div>
          <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;padding:28px 24px;border-radius:0 0 12px 12px;">
            <p style="font-size:16px;color:#111827;margin:0 0 20px;line-height:1.5;">${icon}&nbsp; ${message}</p>
            <a href="${boardLink}" style="display:inline-block;background:#4f46e5;color:#fff;padding:10px 22px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">View in Workboard →</a>
            <hr style="border:none;border-top:1px solid #f3f4f6;margin:24px 0 16px;">
            <p style="color:#9ca3af;font-size:12px;margin:0;">You're receiving this because you're a member of a Workboard project. <a href="${clientUrl}" style="color:#6366f1;">Open app</a></p>
          </div>
        </div>
      `,
    });
  } catch (_) {}
}

async function sendEmail(to, subject, html) {
  const t = getTransporter();
  if (!t) return;
  try {
    await t.sendMail({
      from: `"Workboard" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      html,
    });
  } catch (_) {}
}

module.exports = { sendNotificationEmail, sendEmail };
