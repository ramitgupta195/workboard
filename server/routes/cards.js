const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('../db/database');
const auth = require('../middleware/auth');
const { requirePermission, getPermissions } = require('../middleware/boardPermission');
const { runTrigger } = require('../engine/automations');
const { notify } = require('../utils/notify');
const { getIo } = require('../io');
const fileStorage = require('../utils/fileStorage');

// Multer writes to OS temp dir; we upload to Files.com then delete locally
const UPLOADS_DIR = require('os').tmpdir();
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});
const upload = multer({ storage });

async function enrichCard(card) {
  const labels = await db.prepare('SELECT * FROM card_labels WHERE card_id = ?').all(card.id);
  const assignees = await db.prepare(`
    SELECT u.id, u.name, u.avatar_color FROM users u
    JOIN card_assignees ca ON u.id = ca.user_id
    WHERE ca.card_id = ?
  `).all(card.id);
  return { ...card, labels, assignees };
}

function getFullCard(id) {
  return db.prepare('SELECT c.*, u.name as creator_name, u.avatar_color as creator_color FROM cards c JOIN users u ON c.created_by = u.id WHERE c.id = ?').get(id);
}

function logActivity(cardId, userId, type, data = {}) {
  db.prepare('INSERT INTO card_activities (id, card_id, user_id, type, data) VALUES (?, ?, ?, ?, ?)')
    .run(require('crypto').randomUUID(), cardId, userId, type, JSON.stringify(data))
    .catch(() => {});
}

router.post('/columns/:columnId/cards', auth, requirePermission('create_card'), async (req, res) => {
  try {
    const { title } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });

    const column = await db.prepare('SELECT * FROM columns WHERE id = ?').get(req.params.columnId);
    if (!column) return res.status(404).json({ error: 'Column not found' });

    const maxPos = await db.prepare('SELECT MAX(position) as max FROM cards WHERE column_id = ?').get(req.params.columnId);
    const position = (maxPos?.max ?? -1) + 1;
    const id = uuidv4();

    await db.prepare('INSERT INTO cards (id, column_id, board_id, title, priority, position, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, req.params.columnId, column.board_id, title, 'none', position, req.user.id);

    const card = await getFullCard(id);
    const result = await enrichCard(card);

    runTrigger('card_created', card, { column_id: req.params.columnId }).catch(() => {});
    logActivity(id, req.user.id, 'created', { title });

    try { getIo()?.to(`board:${column.board_id}`).emit('card:created', result); } catch {}

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const card = await getFullCard(req.params.id);
    if (!card) return res.status(404).json({ error: 'Card not found' });
    res.json(await enrichCard(card));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', auth, requirePermission('edit_card'), async (req, res) => {
  try {
    const { title, description, priority, due_date, labels, assigneeIds } = req.body;
    const oldCard = await db.prepare('SELECT * FROM cards WHERE id = ?').get(req.params.id);
    const oldAssigneeRows = await db.prepare('SELECT user_id FROM card_assignees WHERE card_id = ?').all(req.params.id);
    const oldAssignees = oldAssigneeRows.map(r => r.user_id);

    await db.prepare(`UPDATE cards SET title = ?, description = ?, priority = ?, due_date = ?, updated_at = NOW() WHERE id = ?`)
      .run(title, description ?? '', priority ?? 'none', due_date ?? null, req.params.id);

    if (labels !== undefined) {
      await db.prepare('DELETE FROM card_labels WHERE card_id = ?').run(req.params.id);
      for (const l of labels) {
        await db.prepare('INSERT INTO card_labels (id, card_id, name, color) VALUES (?, ?, ?, ?)').run(uuidv4(), req.params.id, l.name, l.color);
      }
    }

    if (assigneeIds !== undefined) {
      await db.prepare('DELETE FROM card_assignees WHERE card_id = ?').run(req.params.id);
      for (const uid of assigneeIds) {
        await db.prepare('INSERT INTO card_assignees (card_id, user_id) VALUES (?, ?)').run(req.params.id, uid);
      }
    }

    const card = await getFullCard(req.params.id);
    const result = await enrichCard(card);

    if (assigneeIds !== undefined) {
      const actor = await db.prepare('SELECT name FROM users WHERE id = ?').get(req.user.id);
      assigneeIds.forEach(uid => {
        if (!oldAssignees.includes(uid) && uid !== req.user.id) {
          notify(uid, 'assigned', `${actor?.name || 'Someone'} assigned you to "${card.title}"`, req.params.id, card.board_id);
        }
      });
    }

    if (oldCard && priority && oldCard.priority !== priority) {
      runTrigger('priority_changed', card, { from_priority: oldCard.priority, to_priority: priority }).catch(() => {});
    }

    if (title && title !== oldCard.title) logActivity(req.params.id, req.user.id, 'title_changed', { from: oldCard.title, to: title });
    if (priority && priority !== oldCard.priority) logActivity(req.params.id, req.user.id, 'priority_changed', { from: oldCard.priority, to: priority });
    if (due_date !== undefined && due_date !== oldCard.due_date) logActivity(req.params.id, req.user.id, 'due_date_changed', { from: oldCard.due_date, to: due_date });
    if (assigneeIds !== undefined) {
      const added = assigneeIds.filter(uid => !oldAssignees.includes(uid));
      const removed = oldAssignees.filter(uid => !assigneeIds.includes(uid));
      if (added.length || removed.length) logActivity(req.params.id, req.user.id, 'assignees_changed', { added, removed });
    }

    try { getIo()?.to(`board:${result.board_id}`).emit('card:updated', result); } catch {}

    // Notify assignees' My Tasks pages in real time
    if (assigneeIds !== undefined) {
      const allAffected = [...new Set([...assigneeIds, ...oldAssignees])];
      allAffected.forEach(uid => {
        try { getIo()?.to(`user:${uid}`).emit('tasks:updated'); } catch {}
      });
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', auth, requirePermission('delete_card'), async (req, res) => {
  try {
    const card = await db.prepare('SELECT * FROM cards WHERE id = ?').get(req.params.id);
    await db.prepare('DELETE FROM cards WHERE id = ?').run(req.params.id);
    if (card) {
      try { getIo()?.to(`board:${card.board_id}`).emit('card:deleted', { cardId: card.id, columnId: card.column_id, boardId: card.board_id }); } catch {}
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/move', auth, async (req, res) => {
  try {
    const { cardId, destColumnId, columnOrders } = req.body;

    const oldCard = await db.prepare('SELECT * FROM cards WHERE id = ?').get(cardId);
    if (!oldCard) return res.status(404).json({ error: 'Card not found' });

    const membership = await db.prepare('SELECT role FROM board_members WHERE board_id = ? AND user_id = ?').get(oldCard.board_id, req.user.id);
    if (!membership) return res.status(403).json({ error: 'Not a board member' });

    if (membership.role !== 'owner') {
      const perms = await getPermissions(oldCard.board_id, membership.role);
      if (!perms.move_card) return res.status(403).json({ error: 'Insufficient permissions' });
      if (!perms.move_any_card) {
        const isAssigned = await db.prepare('SELECT 1 FROM card_assignees WHERE card_id = ? AND user_id = ?').get(cardId, req.user.id);
        if (oldCard.created_by !== req.user.id && !isAssigned) {
          return res.status(403).json({ error: 'You can only move cards you created or are assigned to' });
        }
      }
    }

    const sourceColumnId = oldCard.column_id;

    await db.withTransaction(async client => {
      if (oldCard.column_id !== destColumnId) {
        await client.query('UPDATE cards SET column_id = $1 WHERE id = $2', [destColumnId, cardId]);
      }
      for (const [, cardIds] of Object.entries(columnOrders)) {
        for (let i = 0; i < cardIds.length; i++) {
          await client.query('UPDATE cards SET position = $1 WHERE id = $2', [i, cardIds[i]]);
        }
      }
    });

    if (sourceColumnId && sourceColumnId !== destColumnId) {
      const movedCard = await db.prepare('SELECT * FROM cards WHERE id = ?').get(cardId);
      runTrigger('card_moved', movedCard, { from_column_id: sourceColumnId, to_column_id: destColumnId }).catch(() => {});

      const destCol = await db.prepare('SELECT title FROM columns WHERE id = ?').get(destColumnId);
      const assignees = await db.prepare('SELECT user_id FROM card_assignees WHERE card_id = ?').all(cardId);
      assignees.forEach(a => {
        if (a.user_id !== req.user.id) {
          notify(a.user_id, 'card_moved', `"${movedCard?.title}" was moved to "${destCol?.title || 'a column'}"`, cardId, movedCard?.board_id);
        }
      });

      const srcColTitle = (await db.prepare('SELECT title FROM columns WHERE id = ?').get(sourceColumnId))?.title;
      logActivity(cardId, req.user.id, 'moved', { from: srcColTitle, to: destCol?.title });

      try { getIo()?.to(`board:${oldCard.board_id}`).emit('card:moved', { cardId, destColumnId, columnOrders }); } catch {}
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:cardId/comments', auth, async (req, res) => {
  try {
    const comments = await db.prepare(`
      SELECT cm.*, u.name as user_name, u.avatar_color as user_color
      FROM comments cm
      JOIN users u ON cm.user_id = u.id
      WHERE cm.card_id = ?
      ORDER BY cm.created_at ASC
    `).all(req.params.cardId);
    res.json(comments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:cardId/comments', auth, requirePermission('comment'), async (req, res) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'Content required' });

    const id = uuidv4();
    await db.prepare('INSERT INTO comments (id, card_id, user_id, content) VALUES (?, ?, ?, ?)')
      .run(id, req.params.cardId, req.user.id, content.trim());

    const comment = await db.prepare(`
      SELECT cm.*, u.name as user_name, u.avatar_color as user_color
      FROM comments cm JOIN users u ON cm.user_id = u.id
      WHERE cm.id = ?
    `).get(id);

    logActivity(req.params.cardId, req.user.id, 'commented', { preview: content.trim().slice(0, 60) });

    const card = await db.prepare('SELECT * FROM cards WHERE id = ?').get(req.params.cardId);
    if (card && content.includes('@')) {
      const actor = await db.prepare('SELECT name FROM users WHERE id = ?').get(req.user.id);
      const boardMembers = await db.prepare(`
        SELECT u.id, lower(u.name) as lname FROM users u
        JOIN board_members bm ON u.id = bm.user_id
        WHERE bm.board_id = ?
      `).all(card.board_id);
      const notified = new Set();
      boardMembers.forEach(member => {
        if (member.id === req.user.id || notified.has(member.id)) return;
        const escaped = member.lname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp('@' + escaped + '(?:\\s|$)', 'i');
        if (re.test(content)) {
          notified.add(member.id);
          notify(member.id, 'mention', `${actor?.name || 'Someone'} mentioned you in a comment on "${card.title}"`, card.id, card.board_id);
        }
      });
    }

    res.json(comment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id/archive', auth, requirePermission('delete_card'), async (req, res) => {
  try {
    const card = await db.prepare('SELECT * FROM cards WHERE id = ?').get(req.params.id);
    if (!card) return res.status(404).json({ error: 'Card not found' });

    await db.prepare('UPDATE cards SET archived_at = NOW() WHERE id = ?').run(req.params.id);
    const updated = await enrichCard(await getFullCard(req.params.id));
    try { getIo()?.to(`board:${card.board_id}`).emit('card:updated', updated); } catch {}
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id/unarchive', auth, async (req, res) => {
  try {
    const card = await db.prepare('SELECT * FROM cards WHERE id = ?').get(req.params.id);
    if (!card) return res.status(404).json({ error: 'Card not found' });

    const membership = await db.prepare('SELECT role FROM board_members WHERE board_id = ? AND user_id = ?').get(card.board_id, req.user.id);
    if (!membership) return res.status(403).json({ error: 'Not a board member' });

    await db.prepare('UPDATE cards SET archived_at = NULL WHERE id = ?').run(req.params.id);
    const updated = await enrichCard(await getFullCard(req.params.id));
    try { getIo()?.to(`board:${card.board_id}`).emit('card:updated', updated); } catch {}
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id/cover', auth, requirePermission('edit_card'), async (req, res) => {
  try {
    const { attachmentId } = req.body;
    const card = await db.prepare('SELECT * FROM cards WHERE id = ?').get(req.params.id);
    if (!card) return res.status(404).json({ error: 'Card not found' });

    await db.prepare('UPDATE cards SET cover_image = ? WHERE id = ?').run(attachmentId || null, req.params.id);
    const updated = await enrichCard(await getFullCard(req.params.id));
    try { getIo()?.to(`board:${card.board_id}`).emit('card:updated', updated); } catch {}
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function attachmentUrl(a) {
  // If Files.com is configured, serve via proxy (which redirects to signed S3 URL)
  if (fileStorage.isConfigured()) return `/api/cards/attachments/proxy/${a.id}`;
  return '/uploads/' + a.filename;
}

router.get('/:cardId/attachments', auth, async (req, res) => {
  try {
    const card = await db.prepare('SELECT * FROM cards WHERE id = ?').get(req.params.cardId);
    if (!card) return res.status(404).json({ error: 'Card not found' });

    const attachments = await db.prepare('SELECT * FROM card_attachments WHERE card_id = ? ORDER BY created_at').all(req.params.cardId);
    res.json(attachments.map(a => ({ ...a, url: attachmentUrl(a) })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Proxy — gets a short-lived signed S3 URL from Files.com and redirects to it
router.get('/attachments/proxy/:id', auth, async (req, res) => {
  try {
    const attachment = await db.prepare('SELECT * FROM card_attachments WHERE id = ?').get(req.params.id);
    if (!attachment) return res.status(404).end();
    const signedUrl = await fileStorage.getDownloadUrl(attachment.filename);
    if (!signedUrl) return res.status(404).end();
    res.redirect(signedUrl);
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

router.post('/:cardId/attachments', auth, requirePermission('edit_card'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'File is required' });

    const card = await db.prepare('SELECT * FROM cards WHERE id = ?').get(req.params.cardId);
    if (!card) return res.status(404).json({ error: 'Card not found' });

    const id = uuidv4();
    let storedFilename = req.file.filename;

    if (fileStorage.isConfigured()) {
      const basePath = process.env.FILES_BASE_PATH || '/workboard';
      const filesPath = `${basePath}/attachments/${req.file.filename}`;

      // Two-phase upload: begin → PUT to S3 signed URI → complete
      const [part] = await fileStorage.beginUpload(filesPath);
      const fileBuffer = fs.readFileSync(req.file.path);
      const s3Res = await fetch(part.upload_uri, {
        method: 'PUT',
        body: fileBuffer,
        headers: { 'Content-Type': req.file.mimetype || 'application/octet-stream' },
      });
      const etag = s3Res.headers.get('etag');
      await fileStorage.completeUpload(filesPath, part.ref, etag);

      storedFilename = filesPath;
      fs.unlink(req.file.path, () => {});
    }

    await db.prepare('INSERT INTO card_attachments (id, card_id, user_id, filename, original_name, mimetype, size) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, req.params.cardId, req.user.id, storedFilename, req.file.originalname, req.file.mimetype, req.file.size);

    const attachment = await db.prepare('SELECT * FROM card_attachments WHERE id = ?').get(id);
    res.json({ ...attachment, url: attachmentUrl(attachment) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/attachments/:id', auth, requirePermission('edit_card'), async (req, res) => {
  try {
    const attachment = await db.prepare('SELECT * FROM card_attachments WHERE id = ?').get(req.params.id);
    if (!attachment) return res.status(404).json({ error: 'Attachment not found' });

    if (fileStorage.isConfigured()) {
      await fileStorage.deleteFile(attachment.filename);
    } else {
      try { fs.unlinkSync(path.join(UPLOADS_DIR, attachment.filename)); } catch (_) {}
    }

    await db.prepare('DELETE FROM card_attachments WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:cardId/activities', auth, async (req, res) => {
  try {
    const activities = await db.prepare(`
      SELECT ca.*, u.name as user_name, u.avatar_color as user_color
      FROM card_activities ca
      JOIN users u ON ca.user_id = u.id
      WHERE ca.card_id = ?
      ORDER BY ca.created_at ASC
    `).all(req.params.cardId);
    res.json(activities.map(a => ({ ...a, data: JSON.parse(a.data || '{}') })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
