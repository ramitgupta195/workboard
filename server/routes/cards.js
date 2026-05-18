const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const auth = require('../middleware/auth');
const { requirePermission } = require('../middleware/boardPermission');
const { runTrigger } = require('../engine/automations');
const { notify } = require('../utils/notify');

function enrichCard(card) {
  const labels = db.prepare('SELECT * FROM card_labels WHERE card_id = ?').all(card.id);
  const assignees = db.prepare(`
    SELECT u.id, u.name, u.avatar_color FROM users u
    JOIN card_assignees ca ON u.id = ca.user_id
    WHERE ca.card_id = ?
  `).all(card.id);
  return { ...card, labels, assignees };
}

function getFullCard(id) {
  return db.prepare('SELECT c.*, u.name as creator_name, u.avatar_color as creator_color FROM cards c JOIN users u ON c.created_by = u.id WHERE c.id = ?').get(id);
}

function logActivity(cardId, userId, type, data = {}) {
  try {
    db.prepare('INSERT INTO card_activities (id, card_id, user_id, type, data) VALUES (?, ?, ?, ?, ?)')
      .run(require('crypto').randomUUID(), cardId, userId, type, JSON.stringify(data));
  } catch {}
}

// Create card in column
router.post('/columns/:columnId/cards', auth, requirePermission('create_card'), (req, res) => {
  const { title } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required' });

  const column = db.prepare('SELECT * FROM columns WHERE id = ?').get(req.params.columnId);
  if (!column) return res.status(404).json({ error: 'Column not found' });

  const maxPos = db.prepare('SELECT MAX(position) as max FROM cards WHERE column_id = ?').get(req.params.columnId);
  const position = (maxPos.max ?? -1) + 1;
  const id = uuidv4();

  db.prepare('INSERT INTO cards (id, column_id, board_id, title, priority, position, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, req.params.columnId, column.board_id, title, 'none', position, req.user.id);

  const card = getFullCard(id);
  const result = enrichCard(card);

  try { runTrigger('card_created', card, { column_id: req.params.columnId }, db); } catch {}

  logActivity(id, req.user.id, 'created', { title });

  res.json(result);
});

// Get single card
router.get('/:id', auth, (req, res) => {
  const card = getFullCard(req.params.id);
  if (!card) return res.status(404).json({ error: 'Card not found' });
  res.json(enrichCard(card));
});

// Update card
router.put('/:id', auth, requirePermission('edit_card'), (req, res) => {
  const { title, description, priority, due_date, labels, assigneeIds } = req.body;
  const oldCard = db.prepare('SELECT * FROM cards WHERE id = ?').get(req.params.id);
  const oldAssignees = db.prepare('SELECT user_id FROM card_assignees WHERE card_id = ?').all(req.params.id).map(r => r.user_id);

  db.prepare(`UPDATE cards SET title = ?, description = ?, priority = ?, due_date = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(title, description ?? '', priority ?? 'none', due_date ?? null, req.params.id);

  if (labels !== undefined) {
    db.prepare('DELETE FROM card_labels WHERE card_id = ?').run(req.params.id);
    if (labels.length > 0) {
      const insertLabel = db.prepare('INSERT INTO card_labels (id, card_id, name, color) VALUES (?, ?, ?, ?)');
      labels.forEach(l => insertLabel.run(uuidv4(), req.params.id, l.name, l.color));
    }
  }

  if (assigneeIds !== undefined) {
    db.prepare('DELETE FROM card_assignees WHERE card_id = ?').run(req.params.id);
    if (assigneeIds.length > 0) {
      const insertAssignee = db.prepare('INSERT INTO card_assignees (card_id, user_id) VALUES (?, ?)');
      assigneeIds.forEach(uid => insertAssignee.run(req.params.id, uid));
    }
  }

  const card = getFullCard(req.params.id);
  const result = enrichCard(card);

  if (assigneeIds !== undefined) {
    const actor = db.prepare('SELECT name FROM users WHERE id = ?').get(req.user.id);
    assigneeIds.forEach(uid => {
      if (!oldAssignees.includes(uid) && uid !== req.user.id) {
        notify(uid, 'assigned', `${actor?.name || 'Someone'} assigned you to "${card.title}"`, req.params.id, card.board_id);
      }
    });
  }

  // Fire priority_changed trigger if priority changed
  if (oldCard && priority && oldCard.priority !== priority) {
    try { runTrigger('priority_changed', card, { from_priority: oldCard.priority, to_priority: priority }, db); } catch {}
  }

  if (title && title !== oldCard.title) logActivity(req.params.id, req.user.id, 'title_changed', { from: oldCard.title, to: title });
  if (priority && priority !== oldCard.priority) logActivity(req.params.id, req.user.id, 'priority_changed', { from: oldCard.priority, to: priority });
  if (due_date !== undefined && due_date !== oldCard.due_date) logActivity(req.params.id, req.user.id, 'due_date_changed', { from: oldCard.due_date, to: due_date });
  if (assigneeIds !== undefined) {
    const added = assigneeIds.filter(uid => !oldAssignees.includes(uid));
    const removed = oldAssignees.filter(uid => !assigneeIds.includes(uid));
    if (added.length || removed.length) logActivity(req.params.id, req.user.id, 'assignees_changed', { added, removed });
  }

  res.json(result);
});

// Delete card
router.delete('/:id', auth, requirePermission('delete_card'), (req, res) => {
  db.prepare('DELETE FROM cards WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Move card (drag & drop)
router.post('/move', auth, (req, res) => {
  const { cardId, destColumnId, columnOrders } = req.body;

  const oldCard = db.prepare('SELECT * FROM cards WHERE id = ?').get(cardId);
  if (!oldCard) return res.status(404).json({ error: 'Card not found' });

  const membership = db.prepare('SELECT role FROM board_members WHERE board_id = ? AND user_id = ?').get(oldCard.board_id, req.user.id);
  if (!membership) return res.status(403).json({ error: 'Not a board member' });

  if (membership.role !== 'owner') {
    const { getPermissions } = require('../middleware/boardPermission');
    const perms = getPermissions(oldCard.board_id, membership.role);
    if (!perms.move_card) return res.status(403).json({ error: 'Insufficient permissions' });
    if (!perms.move_any_card) {
      const isAssigned = db.prepare('SELECT 1 FROM card_assignees WHERE card_id = ? AND user_id = ?').get(cardId, req.user.id);
      if (oldCard.created_by !== req.user.id && !isAssigned) {
        return res.status(403).json({ error: 'You can only move cards you created or are assigned to' });
      }
    }
  }

  const sourceColumnId = oldCard?.column_id;

  const tx = db.transaction(() => {
    if (oldCard && oldCard.column_id !== destColumnId) {
      db.prepare('UPDATE cards SET column_id = ? WHERE id = ?').run(destColumnId, cardId);
    }
    for (const [colId, cardIds] of Object.entries(columnOrders)) {
      cardIds.forEach((id, position) => {
        db.prepare('UPDATE cards SET position = ? WHERE id = ?').run(position, id);
      });
    }
  });

  tx();

  // Fire card_moved trigger if column changed
  if (sourceColumnId && sourceColumnId !== destColumnId) {
    const movedCard = db.prepare('SELECT * FROM cards WHERE id = ?').get(cardId);
    try {
      runTrigger('card_moved', movedCard, { from_column_id: sourceColumnId, to_column_id: destColumnId }, db);
    } catch {}

    const destCol = db.prepare('SELECT title FROM columns WHERE id = ?').get(destColumnId);
    const assignees = db.prepare('SELECT user_id FROM card_assignees WHERE card_id = ?').all(cardId);
    assignees.forEach(a => {
      if (a.user_id !== req.user.id) {
        notify(a.user_id, 'card_moved', `"${movedCard?.title}" was moved to "${destCol?.title || 'a column'}"`, cardId, movedCard?.board_id);
      }
    });

    const srcColTitle = db.prepare('SELECT title FROM columns WHERE id = ?').get(sourceColumnId)?.title;
    logActivity(cardId, req.user.id, 'moved', { from: srcColTitle, to: destCol?.title });
  }

  res.json({ success: true });
});

// Get comments for a card
router.get('/:cardId/comments', auth, (req, res) => {
  const comments = db.prepare(`
    SELECT cm.*, u.name as user_name, u.avatar_color as user_color
    FROM comments cm
    JOIN users u ON cm.user_id = u.id
    WHERE cm.card_id = ?
    ORDER BY cm.created_at ASC
  `).all(req.params.cardId);
  res.json(comments);
});

// Add comment
router.post('/:cardId/comments', auth, requirePermission('comment'), (req, res) => {
  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: 'Content required' });

  const id = uuidv4();
  db.prepare('INSERT INTO comments (id, card_id, user_id, content) VALUES (?, ?, ?, ?)')
    .run(id, req.params.cardId, req.user.id, content.trim());

  const comment = db.prepare(`
    SELECT cm.*, u.name as user_name, u.avatar_color as user_color
    FROM comments cm JOIN users u ON cm.user_id = u.id
    WHERE cm.id = ?
  `).get(id);

  logActivity(req.params.cardId, req.user.id, 'commented', { preview: content.trim().slice(0, 60) });

  // Notify @mentioned board members
  const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(req.params.cardId);
  if (card && content.includes('@')) {
    const actor = db.prepare('SELECT name FROM users WHERE id = ?').get(req.user.id);
    const boardMembers = db.prepare(`
      SELECT u.id, lower(u.name) as lname FROM users u
      JOIN board_members bm ON u.id = bm.user_id
      WHERE bm.board_id = ?
    `).all(card.board_id);
    const notified = new Set();
    boardMembers.forEach(member => {
      if (member.id === req.user.id || notified.has(member.id)) return;
      // Escape regex special chars in name, require word boundary after
      const escaped = member.lname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp('@' + escaped + '(?:\\s|$)', 'i');
      if (re.test(content)) {
        notified.add(member.id);
        notify(member.id, 'mention', `${actor?.name || 'Someone'} mentioned you in a comment on "${card.title}"`, card.id, card.board_id);
      }
    });
  }

  res.json(comment);
});

router.get('/:cardId/activities', auth, (req, res) => {
  const activities = db.prepare(`
    SELECT ca.*, u.name as user_name, u.avatar_color as user_color
    FROM card_activities ca
    JOIN users u ON ca.user_id = u.id
    WHERE ca.card_id = ?
    ORDER BY ca.created_at ASC
  `).all(req.params.cardId);
  res.json(activities.map(a => ({ ...a, data: JSON.parse(a.data || '{}') })));
});

module.exports = router;
