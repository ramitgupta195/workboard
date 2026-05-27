const db = require('../db/database');

const ROLES = ['member', 'manager', 'admin', 'owner'];

const DEFAULT_PERMISSIONS = {
  admin: {
    create_card: true, edit_card: true, delete_card: true, move_card: true, move_any_card: true,
    comment: true, manage_columns: true, manage_members: true, manage_automations: true,
    view_files: true, delete_files: true,
  },
  manager: {
    create_card: true, edit_card: true, delete_card: true, move_card: true, move_any_card: true,
    comment: true, manage_columns: true, manage_members: false, manage_automations: false,
    view_files: true, delete_files: false,
  },
  member: {
    create_card: true, edit_card: true, delete_card: false, move_card: true, move_any_card: false,
    comment: true, manage_columns: false, manage_members: false, manage_automations: false,
    view_files: false, delete_files: false,
  },
};

async function getPermissions(boardId, role) {
  if (role === 'owner') return null;
  const row = await db.prepare('SELECT permissions FROM role_permissions WHERE board_id = ? AND role = ?').get(boardId, role);
  return row ? JSON.parse(row.permissions) : (DEFAULT_PERMISSIONS[role] || {});
}

async function resolveBoardId(req) {
  if (req.path === '/move' && req.body?.cardId) {
    const c = await db.prepare('SELECT board_id FROM cards WHERE id = ?').get(req.body.cardId);
    return c?.board_id;
  }
  if (req.params.columnId) {
    const col = await db.prepare('SELECT board_id FROM columns WHERE id = ?').get(req.params.columnId);
    return col?.board_id;
  }
  if (req.params.cardId) {
    const c = await db.prepare('SELECT board_id FROM cards WHERE id = ?').get(req.params.cardId);
    return c?.board_id;
  }
  if (req.params.id && req.baseUrl.includes('cards')) {
    const c = await db.prepare('SELECT board_id FROM cards WHERE id = ?').get(req.params.id);
    if (c) return c.board_id;
    const att = await db.prepare('SELECT card_id FROM card_attachments WHERE id = ?').get(req.params.id);
    if (att) {
      const c2 = await db.prepare('SELECT board_id FROM cards WHERE id = ?').get(att.card_id);
      return c2?.board_id;
    }
  }
  if (req.params.id && req.baseUrl.includes('columns')) {
    const col = await db.prepare('SELECT board_id FROM columns WHERE id = ?').get(req.params.id);
    return col?.board_id;
  }
  if (req.params.boardId) return req.params.boardId;
  if (req.params.id && req.baseUrl.includes('automations')) {
    const rule = await db.prepare('SELECT board_id FROM automation_rules WHERE id = ?').get(req.params.id);
    return rule?.board_id;
  }
  if (req.params.checklistId) {
    const cl = await db.prepare('SELECT card_id FROM card_checklists WHERE id = ?').get(req.params.checklistId);
    if (cl) {
      const c = await db.prepare('SELECT board_id FROM cards WHERE id = ?').get(cl.card_id);
      return c?.board_id;
    }
  }
  if (req.params.id && req.baseUrl.includes('checklists')) {
    const cl = await db.prepare('SELECT card_id FROM card_checklists WHERE id = ?').get(req.params.id);
    if (cl) {
      const c = await db.prepare('SELECT board_id FROM cards WHERE id = ?').get(cl.card_id);
      return c?.board_id;
    }
    const item = await db.prepare('SELECT checklist_id FROM checklist_items WHERE id = ?').get(req.params.id);
    if (item) {
      const cl2 = await db.prepare('SELECT card_id FROM card_checklists WHERE id = ?').get(item.checklist_id);
      if (cl2) {
        const c = await db.prepare('SELECT board_id FROM cards WHERE id = ?').get(cl2.card_id);
        return c?.board_id;
      }
    }
  }
  if (req.params.id) return req.params.id;
  return null;
}

function requirePermission(permission) {
  return async (req, res, next) => {
    try {
      const boardId = await resolveBoardId(req);
      if (!boardId) return res.status(400).json({ error: 'Cannot determine board' });

      let member = await db.prepare('SELECT role FROM board_members WHERE board_id = ? AND user_id = ?').get(boardId, req.user.id);

      // Workspace admins have full access to all boards even without a board_members row
      if (!member) {
        const wsAdmin = await db.prepare(`SELECT 1 FROM workspace_members WHERE user_id = ? AND role = 'admin'`).get(req.user.id);
        if (wsAdmin) member = { role: 'owner' };
      }

      if (!member) return res.status(403).json({ error: 'Not a board member' });

      req.boardRole = member.role;
      req.boardId = boardId;

      if (member.role === 'owner') return next();

      const perms = await getPermissions(boardId, member.role);
      if (!perms[permission]) return res.status(403).json({ error: 'Insufficient permissions' });
      next();
    } catch (err) {
      next(err);
    }
  };
}

function requireOwner() {
  return async (req, res, next) => {
    try {
      const boardId = await resolveBoardId(req);
      if (!boardId) return res.status(400).json({ error: 'Cannot determine board' });
      const member = await db.prepare('SELECT role FROM board_members WHERE board_id = ? AND user_id = ?').get(boardId, req.user.id);
      if (!member || member.role !== 'owner') return res.status(403).json({ error: 'Owner only' });
      req.boardRole = 'owner';
      req.boardId = boardId;
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { requirePermission, requireOwner, getPermissions, DEFAULT_PERMISSIONS, ROLES };
