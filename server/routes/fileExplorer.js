const router = require('express').Router();
const db = require('../db/database');
const auth = require('../middleware/auth');
const { getPermissions } = require('../middleware/boardPermission');
const fileStorage = require('../utils/fileStorage');

async function getBoardAccess(boardId, userId) {
  const member = await db.prepare('SELECT role FROM board_members WHERE board_id = ? AND user_id = ?').get(boardId, userId);
  if (!member) return { canView: false, canDelete: false };
  if (member.role === 'owner') return { canView: true, canDelete: true };
  const perms = await getPermissions(boardId, member.role);
  return {
    canView: !!perms?.view_files,
    canDelete: !!perms?.delete_files,
  };
}

// GET /api/file-explorer — full tree: boards -> cards -> files
router.get('/', auth, async (req, res) => {
  try {
    const memberships = await db.prepare('SELECT board_id, role FROM board_members WHERE user_id = ?').all(req.user.id);

    const result = [];
    for (const { board_id, role } of memberships) {
      let canView = role === 'owner';
      let canDelete = role === 'owner';
      if (!canView) {
        const perms = await getPermissions(board_id, role);
        canView = !!perms?.view_files;
        canDelete = !!perms?.delete_files;
      }
      if (!canView) continue;

      const board = await db.prepare('SELECT id, title, background FROM boards WHERE id = ?').get(board_id);
      if (!board) continue;

      const attachments = await db.prepare(`
        SELECT ca.id, ca.card_id, ca.filename, ca.original_name, ca.mimetype, ca.size, ca.created_at,
               u.name as uploaded_by,
               c.title as card_title
        FROM card_attachments ca
        JOIN cards c ON ca.card_id = c.id
        JOIN users u ON ca.user_id = u.id
        WHERE c.board_id = ? AND c.archived_at IS NULL
        ORDER BY c.title, ca.created_at DESC
      `).all(board_id);

      const cardMap = {};
      for (const att of attachments) {
        if (!cardMap[att.card_id]) {
          cardMap[att.card_id] = { id: att.card_id, title: att.card_title, files: [] };
        }
        cardMap[att.card_id].files.push({
          id: att.id,
          name: att.original_name,
          filename: att.filename,
          mimetype: att.mimetype,
          size: att.size,
          uploadedBy: att.uploaded_by,
          uploadedAt: att.created_at,
        });
      }

      result.push({
        id: board.id,
        title: board.title,
        background: board.background,
        canDelete,
        fileCount: attachments.length,
        cards: Object.values(cardMap),
      });
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/file-explorer/download/:id
router.get('/download/:id', auth, async (req, res) => {
  try {
    const att = await db.prepare(`
      SELECT ca.*, c.board_id FROM card_attachments ca JOIN cards c ON ca.card_id = c.id WHERE ca.id = ?
    `).get(req.params.id);
    if (!att) return res.status(404).end();

    const { canView } = await getBoardAccess(att.board_id, req.user.id);
    if (!canView) return res.status(403).end();

    if (fileStorage.isConfigured()) {
      const url = await fileStorage.getDownloadUrl(att.filename);
      if (!url) return res.status(404).end();
      return res.redirect(url);
    }
    res.redirect(`/uploads/${att.filename}`);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/file-explorer/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const att = await db.prepare(`
      SELECT ca.*, c.board_id FROM card_attachments ca JOIN cards c ON ca.card_id = c.id WHERE ca.id = ?
    `).get(req.params.id);
    if (!att) return res.status(404).json({ error: 'Not found' });

    const { canDelete } = await getBoardAccess(att.board_id, req.user.id);
    if (!canDelete) return res.status(403).json({ error: 'Insufficient permissions' });

    if (fileStorage.isConfigured()) await fileStorage.deleteFile(att.filename);
    await db.prepare('DELETE FROM card_attachments WHERE id = ?').run(att.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
