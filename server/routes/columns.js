const router = require('express').Router();
const db = require('../db/database');
const auth = require('../middleware/auth');
const { requirePermission } = require('../middleware/boardPermission');

router.put('/:id', auth, requirePermission('manage_columns'), (req, res) => {
  const { title, color, wip_limit } = req.body;
  db.prepare('UPDATE columns SET title = ?, color = ?, wip_limit = ? WHERE id = ?')
    .run(title, color, wip_limit ?? 0, req.params.id);
  res.json(db.prepare('SELECT * FROM columns WHERE id = ?').get(req.params.id));
});

router.delete('/:id', auth, requirePermission('manage_columns'), (req, res) => {
  db.prepare('DELETE FROM columns WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
