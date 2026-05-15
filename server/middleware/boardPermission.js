const db = require('../db/database');

const ROLES = ['member', 'manager', 'admin', 'owner'];

const DEFAULT_PERMISSIONS = {
  admin: {
    create_card: true, edit_card: true, delete_card: true, move_card: true, move_any_card: true,
    comment: true, manage_columns: true, manage_members: true, manage_automations: true,
  },
  manager: {
    create_card: true, edit_card: true, delete_card: true, move_card: true, move_any_card: true,
    comment: true, manage_columns: true, manage_members: false, manage_automations: false,
  },
  member: {
    create_card: true, edit_card: true, delete_card: false, move_card: true, move_any_card: false,
    comment: true, manage_columns: false, manage_members: false, manage_automations: false,
  },
};

function getPermissions(boardId, role) {
  if (role === 'owner') return null; // owner skips all checks
  const row = db.prepare('SELECT permissions FROM role_permissions WHERE board_id = ? AND role = ?').get(boardId, role);
  return row ? JSON.parse(row.permissions) : (DEFAULT_PERMISSIONS[role] || {});
}

function resolveBoardId(req) {
  if (req.path === '/move' && req.body?.cardId) {
    const c = db.prepare('SELECT board_id FROM cards WHERE id = ?').get(req.body.cardId);
    return c?.board_id;
  }
  if (req.params.columnId) {
    const col = db.prepare('SELECT board_id FROM columns WHERE id = ?').get(req.params.columnId);
    return col?.board_id;
  }
  if (req.params.cardId) {
    const c = db.prepare('SELECT board_id FROM cards WHERE id = ?').get(req.params.cardId);
    return c?.board_id;
  }
  if (req.params.id && req.baseUrl.includes('cards')) {
    const c = db.prepare('SELECT board_id FROM cards WHERE id = ?').get(req.params.id);
    return c?.board_id;
  }
  if (req.params.id && req.baseUrl.includes('columns')) {
    const col = db.prepare('SELECT board_id FROM columns WHERE id = ?').get(req.params.id);
    return col?.board_id;
  }
  if (req.params.boardId) return req.params.boardId;
  if (req.params.id && req.baseUrl.includes('automations')) {
    const rule = db.prepare('SELECT board_id FROM automation_rules WHERE id = ?').get(req.params.id);
    return rule?.board_id;
  }
  if (req.params.id) return req.params.id;
  return null;
}

function requirePermission(permission) {
  return (req, res, next) => {
    const boardId = resolveBoardId(req);
    if (!boardId) return res.status(400).json({ error: 'Cannot determine board' });

    const member = db.prepare('SELECT role FROM board_members WHERE board_id = ? AND user_id = ?').get(boardId, req.user.id);
    if (!member) return res.status(403).json({ error: 'Not a board member' });

    req.boardRole = member.role;
    req.boardId = boardId;

    if (member.role === 'owner') return next();

    const perms = getPermissions(boardId, member.role);
    if (!perms[permission]) return res.status(403).json({ error: 'Insufficient permissions' });
    next();
  };
}

// Legacy: keeps role-rank based checks for owner-only routes
function requireOwner() {
  return (req, res, next) => {
    const boardId = resolveBoardId(req);
    if (!boardId) return res.status(400).json({ error: 'Cannot determine board' });
    const member = db.prepare('SELECT role FROM board_members WHERE board_id = ? AND user_id = ?').get(boardId, req.user.id);
    if (!member || member.role !== 'owner') return res.status(403).json({ error: 'Owner only' });
    req.boardRole = 'owner';
    req.boardId = boardId;
    next();
  };
}

module.exports = { requirePermission, requireOwner, getPermissions, DEFAULT_PERMISSIONS, ROLES };
