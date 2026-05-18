const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const auth = require('../middleware/auth');
const { requirePermission } = require('../middleware/boardPermission');

router.get('/cards/:cardId/checklists', auth, async (req, res) => {
  try {
    const card = await db.prepare('SELECT id FROM cards WHERE id = ?').get(req.params.cardId);
    if (!card) return res.status(404).json({ error: 'Card not found' });

    const checklists = await db.prepare(
      'SELECT * FROM card_checklists WHERE card_id = ? ORDER BY position, created_at'
    ).all(req.params.cardId);

    const result = await Promise.all(checklists.map(async cl => {
      const items = await db.prepare(
        'SELECT * FROM checklist_items WHERE checklist_id = ? ORDER BY position, created_at'
      ).all(cl.id);
      return { ...cl, items };
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/cards/:cardId/checklists', auth, requirePermission('edit_card'), async (req, res) => {
  try {
    const { title } = req.body;
    const card = await db.prepare('SELECT id FROM cards WHERE id = ?').get(req.params.cardId);
    if (!card) return res.status(404).json({ error: 'Card not found' });

    const maxPos = await db.prepare('SELECT MAX(position) as max FROM card_checklists WHERE card_id = ?').get(req.params.cardId);
    const position = (maxPos?.max ?? -1) + 1;
    const id = uuidv4();

    await db.prepare('INSERT INTO card_checklists (id, card_id, title, position) VALUES (?, ?, ?, ?)')
      .run(id, req.params.cardId, title || 'Checklist', position);

    const checklist = await db.prepare('SELECT * FROM card_checklists WHERE id = ?').get(id);
    res.json({ ...checklist, items: [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', auth, requirePermission('edit_card'), async (req, res) => {
  try {
    const { title } = req.body;
    const checklist = await db.prepare('SELECT * FROM card_checklists WHERE id = ?').get(req.params.id);
    if (!checklist) return res.status(404).json({ error: 'Checklist not found' });

    await db.prepare('UPDATE card_checklists SET title = ? WHERE id = ?').run(title || checklist.title, req.params.id);
    const updated = await db.prepare('SELECT * FROM card_checklists WHERE id = ?').get(req.params.id);
    const items = await db.prepare('SELECT * FROM checklist_items WHERE checklist_id = ? ORDER BY position, created_at').all(req.params.id);
    res.json({ ...updated, items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', auth, requirePermission('edit_card'), async (req, res) => {
  try {
    const checklist = await db.prepare('SELECT * FROM card_checklists WHERE id = ?').get(req.params.id);
    if (!checklist) return res.status(404).json({ error: 'Checklist not found' });

    await db.prepare('DELETE FROM card_checklists WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:checklistId/items', auth, requirePermission('edit_card'), async (req, res) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: 'Text is required' });

    const checklist = await db.prepare('SELECT * FROM card_checklists WHERE id = ?').get(req.params.checklistId);
    if (!checklist) return res.status(404).json({ error: 'Checklist not found' });

    const maxPos = await db.prepare('SELECT MAX(position) as max FROM checklist_items WHERE checklist_id = ?').get(req.params.checklistId);
    const position = (maxPos?.max ?? -1) + 1;
    const id = uuidv4();

    await db.prepare('INSERT INTO checklist_items (id, checklist_id, text, position) VALUES (?, ?, ?, ?)')
      .run(id, req.params.checklistId, text.trim(), position);

    const item = await db.prepare('SELECT * FROM checklist_items WHERE id = ?').get(id);
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/items/:id', auth, requirePermission('edit_card'), async (req, res) => {
  try {
    const { text, done } = req.body;
    const item = await db.prepare('SELECT * FROM checklist_items WHERE id = ?').get(req.params.id);
    if (!item) return res.status(404).json({ error: 'Item not found' });

    await db.prepare('UPDATE checklist_items SET text = COALESCE(?, text), done = COALESCE(?, done) WHERE id = ?')
      .run(text ?? null, done !== undefined ? (done ? 1 : 0) : null, req.params.id);

    const updated = await db.prepare('SELECT * FROM checklist_items WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/items/:id', auth, requirePermission('edit_card'), async (req, res) => {
  try {
    const item = await db.prepare('SELECT * FROM checklist_items WHERE id = ?').get(req.params.id);
    if (!item) return res.status(404).json({ error: 'Item not found' });

    await db.prepare('DELETE FROM checklist_items WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
