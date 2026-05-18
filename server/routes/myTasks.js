const router = require('express').Router();
const db = require('../db/database');
const auth = require('../middleware/auth');

// GET /api/my-tasks — all non-archived cards where user is created_by or assigned
router.get('/', auth, (req, res) => {
  const userId = req.user.id;

  const cards = db.prepare(`
    SELECT DISTINCT c.*,
      u.name as creator_name, u.avatar_color as creator_color,
      b.title as board_title,
      col.title as column_title
    FROM cards c
    JOIN users u ON c.created_by = u.id
    JOIN boards b ON c.board_id = b.id
    JOIN columns col ON c.column_id = col.id
    LEFT JOIN card_assignees ca ON c.id = ca.card_id
    WHERE c.archived_at IS NULL
      AND (c.created_by = ? OR ca.user_id = ?)
    ORDER BY c.due_date ASC, c.created_at DESC
  `).all(userId, userId);

  const result = cards.map(card => {
    const labels = db.prepare('SELECT * FROM card_labels WHERE card_id = ?').all(card.id);
    const assignees = db.prepare(`
      SELECT u.id, u.name, u.avatar_color FROM users u
      JOIN card_assignees ca ON u.id = ca.user_id WHERE ca.card_id = ?
    `).all(card.id);
    return { ...card, labels, assignees };
  });

  res.json(result);
});

module.exports = router;
