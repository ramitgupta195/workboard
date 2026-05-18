const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const auth = require('../middleware/auth');

function parseRule(r) {
  return {
    ...r,
    is_active: r.is_active === 1,
    trigger_config: JSON.parse(r.trigger_config || '{}'),
    action_config: JSON.parse(r.action_config || '{}'),
  };
}

router.get('/boards/:boardId', auth, async (req, res) => {
  try {
    const rules = await db.prepare('SELECT * FROM automation_rules WHERE board_id = ? ORDER BY created_at').all(req.params.boardId);
    res.json(rules.map(parseRule));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/boards/:boardId', auth, async (req, res) => {
  try {
    const { name, trigger_type, trigger_config, action_type, action_config } = req.body;
    if (!name || !trigger_type || !action_type) return res.status(400).json({ error: 'Missing fields' });

    const id = uuidv4();
    await db.prepare('INSERT INTO automation_rules (id, board_id, name, trigger_type, trigger_config, action_type, action_config, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, req.params.boardId, name, trigger_type, JSON.stringify(trigger_config || {}), action_type, JSON.stringify(action_config || {}), req.user.id);

    const rule = await db.prepare('SELECT * FROM automation_rules WHERE id = ?').get(id);
    res.json(parseRule(rule));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const { name, trigger_type, trigger_config, action_type, action_config, is_active } = req.body;
    await db.prepare('UPDATE automation_rules SET name = ?, trigger_type = ?, trigger_config = ?, action_type = ?, action_config = ?, is_active = ? WHERE id = ?')
      .run(name, trigger_type, JSON.stringify(trigger_config || {}), action_type, JSON.stringify(action_config || {}), is_active ? 1 : 0, req.params.id);

    const rule = await db.prepare('SELECT * FROM automation_rules WHERE id = ?').get(req.params.id);
    res.json(parseRule(rule));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await db.prepare('DELETE FROM automation_rules WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/boards/:boardId/logs', auth, async (req, res) => {
  try {
    const logs = await db.prepare(`
      SELECT al.id, al.executed_at, ar.name as rule_name, ar.trigger_type, ar.action_type, c.title as card_title
      FROM automation_logs al
      JOIN automation_rules ar ON al.rule_id = ar.id
      JOIN cards c ON al.card_id = c.id
      WHERE ar.board_id = ?
      ORDER BY al.executed_at DESC
      LIMIT 50
    `).all(req.params.boardId);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
