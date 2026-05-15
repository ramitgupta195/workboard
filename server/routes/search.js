const router = require('express').Router();
const db = require('../db/database');
const auth = require('../middleware/auth');

router.get('/', auth, (req, res) => {
  const q = (req.query.q || '').trim();
  if (q.length < 2) return res.json([]);

  const pattern = `%${q}%`;
  const cards = db.prepare(`
    SELECT c.id, c.title, c.board_id, c.column_id, c.priority, c.due_date,
           b.title as board_title, col.title as column_title, col.color as column_color
    FROM cards c
    JOIN boards b ON c.board_id = b.id
    JOIN columns col ON c.column_id = col.id
    JOIN board_members bm ON b.id = bm.board_id
    WHERE bm.user_id = ? AND (c.title LIKE ? OR c.description LIKE ?)
    ORDER BY c.updated_at DESC
    LIMIT 20
  `).all(req.user.id, pattern, pattern);

  res.json(cards);
});

module.exports = router;
