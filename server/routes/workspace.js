const router = require('express').Router();
const crypto = require('crypto');
const db = require('../db/database');
const auth = require('../middleware/auth');
const { sendEmail } = require('../utils/email');

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// GET /api/workspace/members
router.get('/members', auth, async (req, res) => {
  try {
    const members = await db.prepare(`
      SELECT u.id, u.name, u.email, u.avatar_color, wm.role, wm.added_at
      FROM workspace_members wm
      JOIN users u ON u.id = wm.user_id
      ORDER BY wm.added_at DESC
    `).all();
    res.json(members);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/workspace/invite
router.post('/invite', auth, async (req, res) => {
  try {
    const { email, role: rawRole, skipEmail = false } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const role = ['admin', 'manager', 'member'].includes(rawRole) ? rawRole : 'admin';
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await db.prepare('INSERT INTO workspace_invites (token, invited_email, role, invited_by, expires_at) VALUES (?, ?, ?, ?, ?)')
      .run(token, email.toLowerCase().trim(), role, req.user.id, expiresAt);

    const inviter = await db.prepare('SELECT name FROM users WHERE id = ?').get(req.user.id);
    const inviteUrl = `${CLIENT_URL}/workspace-invite/${token}`;

    if (!skipEmail) sendEmail(email,
      `You've been invited to join Workboard`,
      `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;background:#f8fafc;padding:0">
        <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:40px 32px;border-radius:12px 12px 0 0;text-align:center">
          <div style="display:inline-flex;align-items:center;justify-content:center;width:52px;height:52px;background:rgba(255,255,255,0.15);border-radius:12px;margin-bottom:12px">
            <span style="font-size:24px">🏢</span>
          </div>
          <h1 style="color:white;margin:0;font-size:22px;font-weight:700">You're invited to Workboard</h1>
          <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px">Full workspace access</p>
        </div>
        <div style="background:white;padding:32px;border-radius:0 0 12px 12px;box-shadow:0 4px 24px rgba(0,0,0,0.06)">
          <p style="color:#475569;font-size:15px;margin:0 0 8px"><strong>${inviter?.name || 'Someone'}</strong> has invited you to join Workboard as <strong>${role}</strong>.</p>
          <div style="background:#f1f5f9;border-radius:10px;padding:16px;margin:16px 0;">
            <p style="margin:0;color:#64748b;font-size:13px;">✅ Access to <strong>all existing boards</strong></p>
            <p style="margin:6px 0 0;color:#64748b;font-size:13px;">✅ Automatically added to <strong>new boards</strong></p>
            <p style="margin:6px 0 0;color:#64748b;font-size:13px;">✅ Create and manage your own boards</p>
          </div>
          <a href="${inviteUrl}" style="display:block;text-align:center;background:#4f46e5;color:white;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;margin:24px 0">Accept Invitation →</a>
          <p style="color:#94a3b8;font-size:12px;text-align:center;margin:0">Expires in 7 days.</p>
        </div>
      </div>`
    );

    res.json({ success: true, inviteUrl, skipEmail });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/workspace/invite/:token — public, for AcceptWorkspaceInvite page
router.get('/invite/:token', async (req, res) => {
  try {
    const invite = await db.prepare('SELECT * FROM workspace_invites WHERE token = ?').get(req.params.token);
    if (!invite) return res.status(404).json({ error: 'Invite not found or expired' });
    if (invite.used) return res.status(400).json({ error: 'This invite has already been used' });
    if (new Date(invite.expires_at) < new Date()) return res.status(400).json({ error: 'This invite has expired' });
    res.json({ email: invite.invited_email, role: invite.role });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/workspace/invite/:token/accept
router.post('/invite/:token/accept', auth, async (req, res) => {
  try {
    const invite = await db.prepare('SELECT * FROM workspace_invites WHERE token = ?').get(req.params.token);
    if (!invite) return res.status(404).json({ error: 'Invite not found' });
    if (invite.used) return res.status(400).json({ error: 'Already used' });
    if (new Date(invite.expires_at) < new Date()) return res.status(400).json({ error: 'Invite expired' });

    // Add to workspace_members (upsert)
    const existing = await db.prepare('SELECT 1 FROM workspace_members WHERE user_id = ?').get(req.user.id);
    if (!existing) {
      await db.prepare('INSERT INTO workspace_members (user_id, role, added_by) VALUES (?, ?, ?)')
        .run(req.user.id, invite.role, invite.invited_by);
    }

    // Add to all existing boards they're not already on
    const boards = await db.prepare('SELECT id FROM boards').all();
    for (const board of boards) {
      const member = await db.prepare('SELECT 1 FROM board_members WHERE board_id = ? AND user_id = ?').get(board.id, req.user.id);
      if (!member) {
        await db.prepare('INSERT INTO board_members (board_id, user_id, role) VALUES (?, ?, ?)').run(board.id, req.user.id, invite.role);
      }
    }

    await db.prepare('UPDATE workspace_invites SET used = 1 WHERE token = ?').run(req.params.token);

    res.json({ success: true, boardCount: boards.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/workspace/members/:userId
router.delete('/members/:userId', auth, async (req, res) => {
  try {
    await db.prepare('DELETE FROM workspace_members WHERE user_id = ?').run(req.params.userId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
