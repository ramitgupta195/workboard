const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const db = require('../db/database');
const auth = require('../middleware/auth');
const { DEFAULT_PERMISSIONS, ROLES, requirePermission } = require('../middleware/boardPermission');
const { notify } = require('../utils/notify');
const { sendEmail } = require('../utils/email');
const { getIo } = require('../io');

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

const BACKGROUNDS = ['gradient-1','gradient-2','gradient-3','gradient-4','gradient-5','gradient-6'];

router.get('/', auth, async (req, res) => {
  try {
    const boards = await db.prepare(`
      SELECT b.*, u.name as creator_name, bm.role as user_role
      FROM boards b
      JOIN board_members bm ON b.id = bm.board_id
      JOIN users u ON b.created_by = u.id
      WHERE bm.user_id = ?
      ORDER BY b.created_at DESC
    `).all(req.user.id);

    const result = await Promise.all(boards.map(async b => {
      const mc = await db.prepare('SELECT COUNT(*)::int as c FROM board_members WHERE board_id = ?').get(b.id);
      const cc = await db.prepare('SELECT COUNT(*)::int as c FROM cards WHERE board_id = ?').get(b.id);
      return { ...b, memberCount: mc?.c || 0, cardCount: cc?.c || 0 };
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const { title, description, background } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });

    const id = uuidv4();
    const bg = background || BACKGROUNDS[Math.floor(Math.random() * BACKGROUNDS.length)];

    await db.prepare('INSERT INTO boards (id, title, description, background, created_by) VALUES (?, ?, ?, ?, ?)')
      .run(id, title, description || '', bg, req.user.id);

    await db.prepare('INSERT INTO board_members (board_id, user_id, role) VALUES (?, ?, ?)').run(id, req.user.id, 'owner');

    // Auto-add workspace members (skip the creator)
    const wsMembers = await db.prepare('SELECT user_id, role FROM workspace_members WHERE user_id != ?').all(req.user.id);
    for (const wm of wsMembers) {
      await db.prepare('INSERT INTO board_members (board_id, user_id, role) VALUES (?, ?, ?)').run(id, wm.user_id, wm.role);
    }

    const defaultCols = [
      { title: 'To Do', color: '#94a3b8' },
      { title: 'In Progress', color: '#3b82f6' },
      { title: 'In Review', color: '#f97316' },
      { title: 'Done', color: '#22c55e' },
    ];
    for (let i = 0; i < defaultCols.length; i++) {
      await db.prepare('INSERT INTO columns (id, board_id, title, color, position) VALUES (?, ?, ?, ?, ?)')
        .run(uuidv4(), id, defaultCols[i].title, defaultCols[i].color, i);
    }

    const board = await db.prepare('SELECT * FROM boards WHERE id = ?').get(id);
    res.json(board);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const board = await db.prepare(`
      SELECT b.* FROM boards b
      JOIN board_members bm ON b.id = bm.board_id
      WHERE b.id = ? AND bm.user_id = ?
    `).get(req.params.id, req.user.id);

    if (!board) return res.status(404).json({ error: 'Board not found' });

    const columns = await db.prepare('SELECT * FROM columns WHERE board_id = ? ORDER BY position').all(req.params.id);

    const rawCards = await db.prepare(`
      SELECT c.*, u.name as creator_name, u.avatar_color as creator_color
      FROM cards c
      JOIN users u ON c.created_by = u.id
      WHERE c.board_id = ? AND c.archived_at IS NULL
      ORDER BY c.position
    `).all(req.params.id);

    const cards = await Promise.all(rawCards.map(async card => {
      const labels = await db.prepare('SELECT * FROM card_labels WHERE card_id = ?').all(card.id);
      const assignees = await db.prepare(`
        SELECT u.id, u.name, u.avatar_color FROM users u
        JOIN card_assignees ca ON u.id = ca.user_id
        WHERE ca.card_id = ?
      `).all(card.id);
      return { ...card, labels, assignees };
    }));

    const members = await db.prepare(`
      SELECT u.id, u.name, u.email, u.avatar_color, bm.role
      FROM users u
      JOIN board_members bm ON u.id = bm.user_id
      WHERE bm.board_id = ?
    `).all(req.params.id);

    const rolePermsRows = await db.prepare('SELECT role, permissions FROM role_permissions WHERE board_id = ?').all(req.params.id);
    const rolePermissions = {};
    rolePermsRows.forEach(r => { rolePermissions[r.role] = JSON.parse(r.permissions); });

    res.json({ ...board, columns, cards, members, rolePermissions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const { title, description, background } = req.body;
    await db.prepare('UPDATE boards SET title = ?, description = ?, background = ? WHERE id = ? AND created_by = ?')
      .run(title, description, background, req.params.id, req.user.id);
    const board = await db.prepare('SELECT * FROM boards WHERE id = ?').get(req.params.id);
    res.json(board);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await db.prepare('DELETE FROM boards WHERE id = ? AND created_by = ?').run(req.params.id, req.user.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/members', auth, async (req, res) => {
  try {
    const { email } = req.body;
    const user = await db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const existing = await db.prepare('SELECT 1 FROM board_members WHERE board_id = ? AND user_id = ?').get(req.params.id, user.id);
    if (existing) return res.status(400).json({ error: 'Already a member' });

    const role = req.body.role && ['viewer','csm','member','admin'].includes(req.body.role) ? req.body.role : 'member';
    await db.prepare('INSERT INTO board_members (board_id, user_id, role) VALUES (?, ?, ?)').run(req.params.id, user.id, role);
    const member = await db.prepare('SELECT id, name, email, avatar_color FROM users WHERE id = ?').get(user.id);
    res.json({ ...member, role });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id/members/:userId', auth, async (req, res) => {
  try {
    const { role } = req.body;
    const VALID = ['member', 'manager', 'admin'];
    if (!VALID.includes(role)) return res.status(400).json({ error: 'Invalid role' });

    const board = await db.prepare('SELECT created_by, title FROM boards WHERE id = ?').get(req.params.id);
    if (!board) return res.status(404).json({ error: 'Board not found' });
    const requester = await db.prepare('SELECT role FROM board_members WHERE board_id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!requester || !['owner', 'admin'].includes(requester.role)) return res.status(403).json({ error: 'Only owner or admin can change roles' });
    if (req.params.userId === req.user.id) return res.status(400).json({ error: 'Cannot change your own role' });
    const target = await db.prepare('SELECT role FROM board_members WHERE board_id = ? AND user_id = ?').get(req.params.id, req.params.userId);
    if (target && ['owner', 'admin'].includes(target.role) && board.created_by !== req.user.id) return res.status(403).json({ error: 'Only the owner can change admin or owner roles' });

    await db.prepare('UPDATE board_members SET role = ? WHERE board_id = ? AND user_id = ?')
      .run(role, req.params.id, req.params.userId);

    notify(req.params.userId, 'role_changed',
      `Your role on "${board.title}" was changed to ${role}`,
      null, req.params.id);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/permissions', auth, async (req, res) => {
  try {
    const member = await db.prepare('SELECT role FROM board_members WHERE board_id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!member || !['owner', 'admin'].includes(member.role)) return res.status(403).json({ error: 'Insufficient permissions' });

    const rows = await db.prepare('SELECT role, permissions FROM role_permissions WHERE board_id = ?').all(req.params.id);
    const custom = {};
    rows.forEach(r => { custom[r.role] = JSON.parse(r.permissions); });

    const result = {};
    ['admin', 'manager', 'member'].forEach(role => {
      result[role] = custom[role] || DEFAULT_PERMISSIONS[role] || {};
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id/permissions/:role', auth, async (req, res) => {
  try {
    const board = await db.prepare('SELECT created_by FROM boards WHERE id = ?').get(req.params.id);
    if (!board) return res.status(404).json({ error: 'Board not found' });
    const requesterPerm = await db.prepare('SELECT role FROM board_members WHERE board_id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!requesterPerm || !['owner', 'admin'].includes(requesterPerm.role)) return res.status(403).json({ error: 'Owner or admin only' });

    const validRoles = ['admin', 'manager', 'member'];
    if (!validRoles.includes(req.params.role)) return res.status(400).json({ error: 'Invalid role' });

    const permissions = req.body;
    const existing = await db.prepare('SELECT 1 FROM role_permissions WHERE board_id = ? AND role = ?').get(req.params.id, req.params.role);
    if (existing) {
      await db.prepare('UPDATE role_permissions SET permissions = ? WHERE board_id = ? AND role = ?')
        .run(JSON.stringify(permissions), req.params.id, req.params.role);
    } else {
      await db.prepare('INSERT INTO role_permissions (board_id, role, permissions) VALUES (?, ?, ?)')
        .run(req.params.id, req.params.role, JSON.stringify(permissions));
    }
    res.json({ success: true, role: req.params.role, permissions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id/members/:userId', auth, async (req, res) => {
  try {
    const requester = await db.prepare('SELECT role FROM board_members WHERE board_id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!requester || !['owner', 'admin'].includes(requester.role)) return res.status(403).json({ error: 'Insufficient permissions' });
    if (req.params.userId === req.user.id) return res.status(400).json({ error: 'Cannot remove yourself' });

    await db.prepare('DELETE FROM board_members WHERE board_id = ? AND user_id = ?').run(req.params.id, req.params.userId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/columns', auth, requirePermission('manage_columns'), async (req, res) => {
  try {
    const { title, color } = req.body;
    const board = await db.prepare('SELECT id FROM boards WHERE id = ?').get(req.params.id);
    if (!board) return res.status(404).json({ error: 'Board not found' });

    const maxPos = await db.prepare('SELECT MAX(position) as max FROM columns WHERE board_id = ?').get(req.params.id);
    const position = (maxPos?.max ?? -1) + 1;
    const id = uuidv4();

    await db.prepare('INSERT INTO columns (id, board_id, title, color, position) VALUES (?, ?, ?, ?, ?)')
      .run(id, req.params.id, title || 'New Column', color || '#94a3b8', position);

    const column = await db.prepare('SELECT * FROM columns WHERE id = ?').get(id);
    try { getIo()?.to(`board:${req.params.id}`).emit('column:created', column); } catch {}
    res.json(column);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/columns/reorder', auth, requirePermission('manage_columns'), async (req, res) => {
  try {
    const { columnIds } = req.body;
    await db.withTransaction(async client => {
      for (let i = 0; i < columnIds.length; i++) {
        await client.query('UPDATE columns SET position = $1 WHERE id = $2', [i, columnIds[i]]);
      }
    });
    try { getIo()?.to(`board:${req.params.id}`).emit('columns:reordered', { columnIds }); } catch {}
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/archived', auth, async (req, res) => {
  try {
    const membership = await db.prepare('SELECT role FROM board_members WHERE board_id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!membership) return res.status(403).json({ error: 'Not a board member' });

    const cards = await db.prepare(`
      SELECT c.*, u.name as creator_name, u.avatar_color as creator_color
      FROM cards c
      JOIN users u ON c.created_by = u.id
      WHERE c.board_id = ? AND c.archived_at IS NOT NULL
      ORDER BY c.archived_at DESC
    `).all(req.params.id);

    const result = await Promise.all(cards.map(async card => {
      const labels = await db.prepare('SELECT * FROM card_labels WHERE card_id = ?').all(card.id);
      const assignees = await db.prepare(`
        SELECT u.id, u.name, u.avatar_color FROM users u
        JOIN card_assignees ca ON u.id = ca.user_id WHERE ca.card_id = ?
      `).all(card.id);
      return { ...card, labels, assignees };
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/invites', auth, async (req, res) => {
  try {
    const { email, role: rawRole } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const board = await db.prepare('SELECT * FROM boards WHERE id = ?').get(req.params.id);
    if (!board) return res.status(404).json({ error: 'Board not found' });

    const membership = await db.prepare('SELECT role FROM board_members WHERE board_id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!membership || !['owner', 'admin', 'manager'].includes(membership.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const role = rawRole && ['member', 'manager', 'admin'].includes(rawRole) ? rawRole : 'member';
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const inviter = await db.prepare('SELECT name FROM users WHERE id = ?').get(req.user.id);
    const inviterName = inviter?.name || 'Someone';

    await db.prepare('INSERT INTO board_invites (token, board_id, role, created_by, invited_email, expires_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(token, req.params.id, role, req.user.id, email.toLowerCase().trim(), expiresAt);

    const inviteUrl = `${CLIENT_URL}/invite/${token}`;

    sendEmail(email,
      `You've been invited to join "${board.title}" on Workboard`,
      `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;background:#f8fafc;padding:0">
        <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:40px 32px;border-radius:12px 12px 0 0;text-align:center">
          <div style="display:inline-flex;align-items:center;justify-content:center;width:52px;height:52px;background:rgba(255,255,255,0.15);border-radius:12px;margin-bottom:12px">
            <span style="font-size:24px">📋</span>
          </div>
          <h1 style="color:white;margin:0;font-size:22px;font-weight:700">You're invited to Workboard</h1>
        </div>
        <div style="background:white;padding:32px;border-radius:0 0 12px 12px;box-shadow:0 4px 24px rgba(0,0,0,0.06)">
          <p style="color:#475569;font-size:15px;margin:0 0 8px"><strong>${inviterName}</strong> has invited you to join:</p>
          <div style="background:#f1f5f9;border-radius:10px;padding:20px;margin:16px 0;text-align:center">
            <p style="font-size:20px;font-weight:700;color:#0f172a;margin:0 0 8px">${board.title}</p>
            <span style="display:inline-block;background:#ede9fe;color:#5b21b6;font-size:12px;font-weight:600;padding:4px 12px;border-radius:999px;text-transform:capitalize">${role}</span>
          </div>
          <a href="${inviteUrl}" style="display:block;text-align:center;background:#4f46e5;color:white;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;margin:24px 0">Accept Invitation →</a>
          <p style="color:#94a3b8;font-size:12px;text-align:center;margin:0">This invite expires in 7 days. If you weren't expecting this, you can ignore it.</p>
        </div>
      </div>`
    );

    res.json({ success: true, inviteUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/invites/:token', async (req, res) => {
  try {
    const invite = await db.prepare('SELECT * FROM board_invites WHERE token = ?').get(req.params.token);
    if (!invite) return res.status(404).json({ error: 'Invite not found' });
    if (invite.used) return res.status(400).json({ error: 'Invite already used' });
    if (new Date(invite.expires_at) < new Date()) return res.status(400).json({ error: 'Invite expired' });

    const board = await db.prepare('SELECT id, title FROM boards WHERE id = ?').get(invite.board_id);
    if (!board) return res.status(404).json({ error: 'Board not found' });

    res.json({ board, role: invite.role });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/invites/:token/accept', auth, async (req, res) => {
  try {
    const invite = await db.prepare('SELECT * FROM board_invites WHERE token = ?').get(req.params.token);
    if (!invite) return res.status(404).json({ error: 'Invite not found' });
    if (invite.used) return res.status(400).json({ error: 'Invite already used' });
    if (new Date(invite.expires_at) < new Date()) return res.status(400).json({ error: 'Invite expired' });

    const existing = await db.prepare('SELECT 1 FROM board_members WHERE board_id = ? AND user_id = ?').get(invite.board_id, req.user.id);
    if (existing) return res.status(400).json({ error: 'Already a board member' });

    await db.prepare('INSERT INTO board_members (board_id, user_id, role) VALUES (?, ?, ?)').run(invite.board_id, req.user.id, invite.role);
    await db.prepare('UPDATE board_invites SET used = 1 WHERE token = ?').run(req.params.token);

    res.json({ success: true, boardId: invite.board_id, role: invite.role });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/export', auth, async (req, res) => {
  try {
    const membership = await db.prepare('SELECT role FROM board_members WHERE board_id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!membership) return res.status(403).json({ error: 'Not a board member' });

    const board = await db.prepare('SELECT * FROM boards WHERE id = ?').get(req.params.id);
    if (!board) return res.status(404).json({ error: 'Board not found' });

    const cards = await db.prepare(`
      SELECT c.*, u.name as creator_name, col.title as column_title
      FROM cards c
      JOIN users u ON c.created_by = u.id
      JOIN columns col ON c.column_id = col.id
      WHERE c.board_id = ?
      ORDER BY col.position, c.position
    `).all(req.params.id);

    function escapeCsv(val) {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes('"') || str.includes(',') || str.includes('\n')) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    }

    const rows = [['Title', 'Description', 'Priority', 'Status', 'Due Date', 'Assignees', 'Created By', 'Created At']];

    for (const card of cards) {
      const assigneeRows = await db.prepare(`
        SELECT u.name FROM users u
        JOIN card_assignees ca ON u.id = ca.user_id WHERE ca.card_id = ?
      `).all(card.id);
      const assignees = assigneeRows.map(a => a.name).join('; ');

      rows.push([
        card.title,
        card.description || '',
        card.priority || 'none',
        card.column_title,
        card.due_date || '',
        assignees,
        card.creator_name,
        card.created_at,
      ]);
    }

    const csv = rows.map(r => r.map(escapeCsv).join(',')).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="board-export.csv"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
