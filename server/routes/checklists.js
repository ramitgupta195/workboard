const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const auth = require('../middleware/auth');
const { requirePermission } = require('../middleware/boardPermission');

// GET /cards/:cardId/checklists — list checklists with items
router.get('/cards/:cardId/checklists', auth, (req, res) => {
  const card = db.prepare('SELECT id FROM cards WHERE id = ?').get(req.params.cardId);
  if (!card) return res.status(404).json({ error: 'Card not found' });

  const checklists = db.prepare(
    'SELECT * FROM card_checklists WHERE card_id = ? ORDER BY position, created_at'
  ).all(req.params.cardId);

  const result = checklists.map(cl => {
    const items = db.prepare(
      'SELECT * FROM checklist_items WHERE checklist_id = ? ORDER BY position, created_at'
    ).all(cl.id);
    return { ...cl, items };
  });

  res.json(result);
});

// POST /cards/:cardId/checklists — create checklist
router.post('/cards/:cardId/checklists', auth, requirePermission('edit_card'), (req, res) => {
  const { title } = req.body;
  const card = db.prepare('SELECT id FROM cards WHERE id = ?').get(req.params.cardId);
  if (!card) return res.status(404).json({ error: 'Card not found' });

  const maxPos = db.prepare('SELECT MAX(position) as max FROM card_checklists WHERE card_id = ?').get(req.params.cardId);
  const position = (maxPos.max ?? -1) + 1;
  const id = uuidv4();

  db.prepare('INSERT INTO card_checklists (id, card_id, title, position) VALUES (?, ?, ?, ?)')
    .run(id, req.params.cardId, title || 'Checklist', position);

  const checklist = db.prepare('SELECT * FROM card_checklists WHERE id = ?').get(id);
  res.json({ ...checklist, items: [] });
});

// PUT /:id — update checklist title
router.put('/:id', auth, requirePermission('edit_card'), (req, res) => {
  const { title } = req.body;
  const checklist = db.prepare('SELECT * FROM card_checklists WHERE id = ?').get(req.params.id);
  if (!checklist) return res.status(404).json({ error: 'Checklist not found' });

  db.prepare('UPDATE card_checklists SET title = ? WHERE id = ?').run(title || checklist.title, req.params.id);
  const updated = db.prepare('SELECT * FROM card_checklists WHERE id = ?').get(req.params.id);
  const items = db.prepare('SELECT * FROM checklist_items WHERE checklist_id = ? ORDER BY position, created_at').all(req.params.id);
  res.json({ ...updated, items });
});

// DELETE /:id — delete checklist
router.delete('/:id', auth, requirePermission('edit_card'), (req, res) => {
  const checklist = db.prepare('SELECT * FROM card_checklists WHERE id = ?').get(req.params.id);
  if (!checklist) return res.status(404).json({ error: 'Checklist not found' });

  db.prepare('DELETE FROM card_checklists WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// POST /:checklistId/items — add item
router.post('/:checklistId/items', auth, requirePermission('edit_card'), (req, res) => {
  const { text } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: 'Text is required' });

  const checklist = db.prepare('SELECT * FROM card_checklists WHERE id = ?').get(req.params.checklistId);
  if (!checklist) return res.status(404).json({ error: 'Checklist not found' });

  const maxPos = db.prepare('SELECT MAX(position) as max FROM checklist_items WHERE checklist_id = ?').get(req.params.checklistId);
  const position = (maxPos.max ?? -1) + 1;
  const id = uuidv4();

  db.prepare('INSERT INTO checklist_items (id, checklist_id, text, position) VALUES (?, ?, ?, ?)')
    .run(id, req.params.checklistId, text.trim(), position);

  res.json(db.prepare('SELECT * FROM checklist_items WHERE id = ?').get(id));
});

// PUT /items/:id — update item
router.put('/items/:id', auth, requirePermission('edit_card'), (req, res) => {
  const { text, done } = req.body;
  const item = db.prepare('SELECT * FROM checklist_items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found' });

  db.prepare('UPDATE checklist_items SET text = COALESCE(?, text), done = COALESCE(?, done) WHERE id = ?')
    .run(text ?? null, done !== undefined ? (done ? 1 : 0) : null, req.params.id);

  res.json(db.prepare('SELECT * FROM checklist_items WHERE id = ?').get(req.params.id));
});

// DELETE /items/:id — delete item
router.delete('/items/:id', auth, requirePermission('edit_card'), (req, res) => {
  const item = db.prepare('SELECT * FROM checklist_items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found' });

  db.prepare('DELETE FROM checklist_items WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
