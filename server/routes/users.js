const router = require('express').Router();
const db = require('../db/database');
const auth = require('../middleware/auth');

router.get('/search', auth, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 1) return res.json([]);

    const users = await db.prepare(
      'SELECT id, name, email, avatar_color FROM users WHERE (name ILIKE ? OR email ILIKE ?) AND id != ? LIMIT 8'
    ).all(`%${q}%`, `%${q}%`, req.user.id);

    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
