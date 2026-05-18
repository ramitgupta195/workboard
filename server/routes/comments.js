const router = require('express').Router();
const db = require('../db/database');
const auth = require('../middleware/auth');

router.delete('/:id', auth, async (req, res) => {
  try {
    const comment = await db.prepare('SELECT user_id FROM comments WHERE id = ?').get(req.params.id);
    if (!comment) return res.status(404).json({ error: 'Comment not found' });
    if (comment.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    await db.prepare('DELETE FROM comments WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
