const { google } = require('googleapis');
const db = require('../db/database');

const ICONS = {
  assigned: '📋',
  mention: '💬',
  card_moved: '🔀',
  role_changed: '🛡️',
};

function getGmailClient() {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_REFRESH_TOKEN) return null;
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  auth.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
  return google.gmail({ version: 'v1', auth });
}

function makeMime(to, from, subject, html) {
  const boundary = 'workboard_boundary';
  const htmlB64 = Buffer.from(html).toString('base64');
  const mime = [
    `From: "Workboard" <${from}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    htmlB64,
    `--${boundary}--`,
  ].join('\r\n');
  return Buffer.from(mime).toString('base64url');
}

async function sendEmail(to, subject, html) {
  const gmail = getGmailClient();
  if (!gmail) return;
  try {
    await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: makeMime(to, process.env.GMAIL_USER, subject, html) },
    });
  } catch (err) {
    console.error('[email] send failed:', err.message);
  }
}

async function sendNotificationEmail(userId, type, message, cardId, boardId) {
  const gmail = getGmailClient();
  if (!gmail) return;
  try {
    const user = await db.prepare('SELECT email, name FROM users WHERE id = ?').get(userId);
    if (!user?.email) return;

    const icon = ICONS[type] || '🔔';
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const boardLink = boardId ? `${clientUrl}/boards/${boardId}` : clientUrl;

    const html = `
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
      </div>`;

    await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: makeMime(user.email, process.env.GMAIL_USER, `${icon} ${message}`, html) },
    });
  } catch (err) {
    console.error('[email] notification failed:', err.message);
  }
}

module.exports = { sendNotificationEmail, sendEmail };
