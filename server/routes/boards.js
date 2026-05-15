const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const auth = require('../middleware/auth');
const { DEFAULT_PERMISSIONS, ROLES, requirePermission } = require('../middleware/boardPermission');

function notify(userId, type, message, cardId, boardId) {
  try {
    db.prepare('INSERT INTO notifications (id, user_id, type, message, card_id, board_id) VALUES (?, ?, ?, ?, ?, ?)')
      .run(uuidv4(), userId, type, message, cardId || null, boardId || null);
  } catch {}
}

const BACKGROUNDS = ['gradient-1','gradient-2','gradient-3','gradient-4','gradient-5','gradient-6'];

router.get('/', auth, (req, res) => {
  const boards = db.prepare(`
    SELECT b.*, u.name as creator_name
    FROM boards b
    JOIN board_members bm ON b.id = bm.board_id
    JOIN users u ON b.created_by = u.id
    WHERE bm.user_id = ?
    ORDER BY b.created_at DESC
  `).all(req.user.id);

  const result = boards.map(b => {
    const memberCount = db.prepare('SELECT COUNT(*) as c FROM board_members WHERE board_id = ?').get(b.id).c;
    const cardCount = db.prepare('SELECT COUNT(*) as c FROM cards WHERE board_id = ?').get(b.id).c;
    return { ...b, memberCount, cardCount };
  });

  res.json(result);
});

router.post('/', auth, (req, res) => {
  const { title, description, background } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required' });

  const id = uuidv4();
  const bg = background || BACKGROUNDS[Math.floor(Math.random() * BACKGROUNDS.length)];

  db.prepare('INSERT INTO boards (id, title, description, background, created_by) VALUES (?, ?, ?, ?, ?)')
    .run(id, title, description || '', bg, req.user.id);

  db.prepare('INSERT INTO board_members (board_id, user_id, role) VALUES (?, ?, ?)').run(id, req.user.id, 'owner');

  const defaultCols = [
    { title: 'To Do', color: '#94a3b8' },
    { title: 'In Progress', color: '#3b82f6' },
    { title: 'In Review', color: '#f97316' },
    { title: 'Done', color: '#22c55e' },
  ];
  defaultCols.forEach((col, i) => {
    db.prepare('INSERT INTO columns (id, board_id, title, color, position) VALUES (?, ?, ?, ?, ?)')
      .run(uuidv4(), id, col.title, col.color, i);
  });

  res.json(db.prepare('SELECT * FROM boards WHERE id = ?').get(id));
});

router.get('/:id', auth, (req, res) => {
  const board = db.prepare(`
    SELECT b.* FROM boards b
    JOIN board_members bm ON b.id = bm.board_id
    WHERE b.id = ? AND bm.user_id = ?
  `).get(req.params.id, req.user.id);

  if (!board) return res.status(404).json({ error: 'Board not found' });

  const columns = db.prepare('SELECT * FROM columns WHERE board_id = ? ORDER BY position').all(req.params.id);

  const rawCards = db.prepare(`
    SELECT c.*, u.name as creator_name, u.avatar_color as creator_color
    FROM cards c
    JOIN users u ON c.created_by = u.id
    WHERE c.board_id = ?
    ORDER BY c.position
  `).all(req.params.id);

  const cards = rawCards.map(card => {
    const labels = db.prepare('SELECT * FROM card_labels WHERE card_id = ?').all(card.id);
    const assignees = db.prepare(`
      SELECT u.id, u.name, u.avatar_color FROM users u
      JOIN card_assignees ca ON u.id = ca.user_id
      WHERE ca.card_id = ?
    `).all(card.id);
    return { ...card, labels, assignees };
  });

  const members = db.prepare(`
    SELECT u.id, u.name, u.email, u.avatar_color, bm.role
    FROM users u
    JOIN board_members bm ON u.id = bm.user_id
    WHERE bm.board_id = ?
  `).all(req.params.id);

  const rolePermsRows = db.prepare('SELECT role, permissions FROM role_permissions WHERE board_id = ?').all(req.params.id);
  const rolePermissions = {};
  rolePermsRows.forEach(r => { rolePermissions[r.role] = JSON.parse(r.permissions); });

  res.json({ ...board, columns, cards, members, rolePermissions });
});

router.put('/:id', auth, (req, res) => {
  const { title, description, background } = req.body;
  db.prepare('UPDATE boards SET title = ?, description = ?, background = ? WHERE id = ? AND created_by = ?')
    .run(title, description, background, req.params.id, req.user.id);
  res.json(db.prepare('SELECT * FROM boards WHERE id = ?').get(req.params.id));
});

router.delete('/:id', auth, (req, res) => {
  db.prepare('DELETE FROM boards WHERE id = ? AND created_by = ?').run(req.params.id, req.user.id);
  res.json({ success: true });
});

router.post('/:id/members', auth, (req, res) => {
  const { email } = req.body;
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const existing = db.prepare('SELECT 1 FROM board_members WHERE board_id = ? AND user_id = ?').get(req.params.id, user.id);
  if (existing) return res.status(400).json({ error: 'Already a member' });

  db.prepare('INSERT INTO board_members (board_id, user_id, role) VALUES (?, ?, ?)').run(req.params.id, user.id, req.body.role && ['viewer','csm','member','admin'].includes(req.body.role) ? req.body.role : 'member');
  const member = db.prepare('SELECT id, name, email, avatar_color FROM users WHERE id = ?').get(user.id);
  const addedRole = req.body.role && ['viewer','csm','member','admin'].includes(req.body.role) ? req.body.role : 'member';
  res.json({ ...member, role: addedRole });
});

// Change a member's role (owner only)
router.put('/:id/members/:userId', auth, (req, res) => {
  const { role } = req.body;
  const VALID = ['member', 'manager', 'admin'];
  if (!VALID.includes(role)) return res.status(400).json({ error: 'Invalid role' });

  const board = db.prepare('SELECT created_by, title FROM boards WHERE id = ?').get(req.params.id);
  if (!board) return res.status(404).json({ error: 'Board not found' });
  if (board.created_by !== req.user.id) return res.status(403).json({ error: 'Only the owner can change roles' });
  if (req.params.userId === req.user.id) return res.status(400).json({ error: 'Cannot change your own role' });

  db.prepare('UPDATE board_members SET role = ? WHERE board_id = ? AND user_id = ?')
    .run(role, req.params.id, req.params.userId);

  notify(req.params.userId, 'role_changed',
    `Your role on "${board.title}" was changed to ${role}`,
    null, req.params.id);

  res.json({ success: true });
});

// Get permissions matrix for a board (owner/admin only)
router.get('/:id/permissions', auth, (req, res) => {
  const member = db.prepare('SELECT role FROM board_members WHERE board_id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!member || !['owner', 'admin'].includes(member.role)) return res.status(403).json({ error: 'Insufficient permissions' });

  const rows = db.prepare('SELECT role, permissions FROM role_permissions WHERE board_id = ?').all(req.params.id);
  const custom = {};
  rows.forEach(r => { custom[r.role] = JSON.parse(r.permissions); });

  const result = {};
  ['admin', 'manager', 'member'].forEach(role => {
    result[role] = custom[role] || DEFAULT_PERMISSIONS[role] || {};
  });
  res.json(result);
});

// Update permissions for a role (owner only)
router.put('/:id/permissions/:role', auth, (req, res) => {
  const board = db.prepare('SELECT created_by FROM boards WHERE id = ?').get(req.params.id);
  if (!board) return res.status(404).json({ error: 'Board not found' });
  if (board.created_by !== req.user.id) return res.status(403).json({ error: 'Owner only' });

  const validRoles = ['admin', 'manager', 'member'];
  if (!validRoles.includes(req.params.role)) return res.status(400).json({ error: 'Invalid role' });

  const permissions = req.body;
  const existing = db.prepare('SELECT 1 FROM role_permissions WHERE board_id = ? AND role = ?').get(req.params.id, req.params.role);
  if (existing) {
    db.prepare('UPDATE role_permissions SET permissions = ? WHERE board_id = ? AND role = ?')
      .run(JSON.stringify(permissions), req.params.id, req.params.role);
  } else {
    db.prepare('INSERT INTO role_permissions (board_id, role, permissions) VALUES (?, ?, ?)')
      .run(req.params.id, req.params.role, JSON.stringify(permissions));
  }
  res.json({ success: true, role: req.params.role, permissions });
});

// Remove a member (admin or owner)
router.delete('/:id/members/:userId', auth, (req, res) => {
  const requester = db.prepare('SELECT role FROM board_members WHERE board_id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!requester || !['owner', 'admin'].includes(requester.role)) return res.status(403).json({ error: 'Insufficient permissions' });
  if (req.params.userId === req.user.id) return res.status(400).json({ error: 'Cannot remove yourself' });

  db.prepare('DELETE FROM board_members WHERE board_id = ? AND user_id = ?').run(req.params.id, req.params.userId);
  res.json({ success: true });
});

// Create column under a board
router.post('/:id/columns', auth, requirePermission('manage_columns'), (req, res) => {
  const { title, color } = req.body;
  const board = db.prepare('SELECT id FROM boards WHERE id = ?').get(req.params.id);
  if (!board) return res.status(404).json({ error: 'Board not found' });

  const maxPos = db.prepare('SELECT MAX(position) as max FROM columns WHERE board_id = ?').get(req.params.id);
  const position = (maxPos.max ?? -1) + 1;
  const id = uuidv4();

  db.prepare('INSERT INTO columns (id, board_id, title, color, position) VALUES (?, ?, ?, ?, ?)')
    .run(id, req.params.id, title || 'New Column', color || '#94a3b8', position);

  res.json(db.prepare('SELECT * FROM columns WHERE id = ?').get(id));
});

// Reorder columns
router.post('/:id/columns/reorder', auth, requirePermission('manage_columns'), (req, res) => {
  const { columnIds } = req.body;
  const update = db.prepare('UPDATE columns SET position = ? WHERE id = ?');
  const tx = db.transaction(ids => ids.forEach((id, i) => update.run(i, id)));
  tx(columnIds);
  res.json({ success: true });
});

module.exports = router;
