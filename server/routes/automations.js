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

// List rules for board
router.get('/boards/:boardId', auth, (req, res) => {
  const rules = db.prepare('SELECT * FROM automation_rules WHERE board_id = ? ORDER BY created_at').all(req.params.boardId);
  res.json(rules.map(parseRule));
});

// Create rule
router.post('/boards/:boardId', auth, (req, res) => {
  const { name, trigger_type, trigger_config, action_type, action_config } = req.body;
  if (!name || !trigger_type || !action_type) return res.status(400).json({ error: 'Missing fields' });

  const id = uuidv4();
  db.prepare(`INSERT INTO automation_rules (id, board_id, name, trigger_type, trigger_config, action_type, action_config, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, req.params.boardId, name, trigger_type, JSON.stringify(trigger_config || {}), action_type, JSON.stringify(action_config || {}), req.user.id);

  res.json(parseRule(db.prepare('SELECT * FROM automation_rules WHERE id = ?').get(id)));
});

// Update rule (includes toggling active)
router.put('/:id', auth, (req, res) => {
  const { name, trigger_type, trigger_config, action_type, action_config, is_active } = req.body;
  db.prepare(`UPDATE automation_rules SET name = ?, trigger_type = ?, trigger_config = ?, action_type = ?, action_config = ?, is_active = ? WHERE id = ?`)
    .run(name, trigger_type, JSON.stringify(trigger_config || {}), action_type, JSON.stringify(action_config || {}), is_active ? 1 : 0, req.params.id);

  res.json(parseRule(db.prepare('SELECT * FROM automation_rules WHERE id = ?').get(req.params.id)));
});

// Delete rule
router.delete('/:id', auth, (req, res) => {
  db.prepare('DELETE FROM automation_rules WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Recent log for a board
router.get('/boards/:boardId/logs', auth, (req, res) => {
  const logs = db.prepare(`
    SELECT al.id, al.executed_at, ar.name as rule_name, ar.trigger_type, ar.action_type, c.title as card_title
    FROM automation_logs al
    JOIN automation_rules ar ON al.rule_id = ar.id
    JOIN cards c ON al.card_id = c.id
    WHERE ar.board_id = ?
    ORDER BY al.executed_at DESC
    LIMIT 50
  `).all(req.params.boardId);
  res.json(logs);
});

module.exports = router;
