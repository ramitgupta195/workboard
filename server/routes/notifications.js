const router = require('express').Router();
const db = require('../db/database');
const auth = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  try {
    const rows = await db.prepare(`
      SELECT * FROM notifications
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 50
    `).all(req.user.id);
    res.json(rows.map(r => ({ ...r, is_read: !!r.is_read })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/read-all', auth, async (req, res) => {
  try {
    await db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id/read', auth, async (req, res) => {
  try {
    await db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?')
      .run(req.params.id, req.user.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
