const router = require('express').Router();
const db = require('../db/database');
const auth = require('../middleware/auth');
const { requirePermission } = require('../middleware/boardPermission');
const { getIo } = require('../io');

router.put('/:id', auth, requirePermission('manage_columns'), async (req, res) => {
  try {
    const { title, color, wip_limit } = req.body;
    await db.prepare('UPDATE columns SET title = ?, color = ?, wip_limit = ? WHERE id = ?')
      .run(title, color, wip_limit ?? 0, req.params.id);
    const column = await db.prepare('SELECT * FROM columns WHERE id = ?').get(req.params.id);
    try { getIo()?.to(`board:${column.board_id}`).emit('column:updated', column); } catch {}
    res.json(column);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', auth, requirePermission('manage_columns'), async (req, res) => {
  try {
    const column = await db.prepare('SELECT * FROM columns WHERE id = ?').get(req.params.id);
    await db.prepare('DELETE FROM columns WHERE id = ?').run(req.params.id);
    if (column) {
      try { getIo()?.to(`board:${column.board_id}`).emit('column:deleted', { columnId: column.id }); } catch {}
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
