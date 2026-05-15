const router = require('express').Router();
const db = require('../db/database');
const auth = require('../middleware/auth');

router.get('/search', auth, (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 1) return res.json([]);

  const users = db.prepare(
    'SELECT id, name, email, avatar_color FROM users WHERE (name LIKE ? OR email LIKE ?) AND id != ? LIMIT 8'
  ).all(`%${q}%`, `%${q}%`, req.user.id);

  res.json(users);
});

module.exports = router;
