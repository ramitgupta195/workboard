const router = require('express').Router();
const db = require('../db/database');
const auth = require('../middleware/auth');

router.get('/:token', async (req, res) => {
  try {
    const invite = await db.prepare('SELECT * FROM board_invites WHERE token = ?').get(req.params.token);
    if (!invite) return res.status(404).json({ error: 'Invite not found' });
    if (invite.used) return res.status(400).json({ error: 'Invite already used' });
    if (new Date(invite.expires_at) < new Date()) return res.status(400).json({ error: 'Invite expired' });

    const board = await db.prepare('SELECT id, title FROM boards WHERE id = ?').get(invite.board_id);
    const inviter = await db.prepare('SELECT name FROM users WHERE id = ?').get(invite.created_by);
    res.json({ board, role: invite.role, inviterName: inviter?.name || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:token/accept', auth, async (req, res) => {
  try {
    const invite = await db.prepare('SELECT * FROM board_invites WHERE token = ?').get(req.params.token);
    if (!invite) return res.status(404).json({ error: 'Invite not found' });
    if (invite.used) return res.status(400).json({ error: 'Invite already used' });
    if (new Date(invite.expires_at) < new Date()) return res.status(400).json({ error: 'Invite expired' });

    const existing = await db.prepare('SELECT 1 FROM board_members WHERE board_id = ? AND user_id = ?').get(invite.board_id, req.user.id);
    if (!existing) {
      await db.prepare('INSERT INTO board_members (board_id, user_id, role) VALUES (?, ?, ?)').run(invite.board_id, req.user.id, invite.role);
    }
    await db.prepare('UPDATE board_invites SET used = 1 WHERE token = ?').run(req.params.token);

    res.json({ success: true, boardId: invite.board_id, role: invite.role });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
