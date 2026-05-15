import { useAuthStore } from '../store/authStore';

export const ROLES = ['owner', 'admin', 'manager', 'member'];

export const PERMISSION_DEFS = [
  { key: 'create_card',        label: 'Create cards',        description: 'Add new cards to any column' },
  { key: 'edit_card',          label: 'Edit cards',          description: 'Change title, description, labels, due date' },
  { key: 'delete_card',        label: 'Delete cards',        description: 'Permanently remove cards' },
  { key: 'move_card',          label: 'Move own cards',      description: 'Drag their own cards between columns' },
  { key: 'move_any_card',     label: 'Move any card',       description: "Move other members' cards, not just their own" },
  { key: 'comment',            label: 'Comment',             description: 'Add comments and @mention members' },
  { key: 'manage_columns',     label: 'Manage columns',      description: 'Add, rename, reorder, delete columns' },
  { key: 'manage_members',     label: 'Manage members',      description: 'Invite/remove members, change roles' },
  { key: 'manage_automations', label: 'Manage automations',  description: 'Create and edit automation rules' },
];

export const DEFAULT_PERMISSIONS = {
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

export function useBoardPermissions(members, rolePermissions = {}) {
  const user = useAuthStore(s => s.user);
  const me = members?.find(m => m.id === user?.id);
  const role = me?.role || 'member';

  if (role === 'owner') {
    return {
      role,
      isOwner: true,
      can: {
        viewBoard: true, createCard: true, editCard: true, deleteCard: true,
        moveCard: true, comment: true, manageColumns: true, manageMembers: true,
        manageBoard: true, manageAutos: true, deleteBoard: true,
      },
    };
  }

  const perms = rolePermissions[role] || DEFAULT_PERMISSIONS[role] || {};

  return {
    role,
    isOwner: false,
    can: {
      viewBoard:      true,
      createCard:     !!perms.create_card,
      editCard:       !!perms.edit_card,
      deleteCard:     !!perms.delete_card,
      moveCard:       !!perms.move_card,
      moveAnyCard:    !!perms.move_any_card,
      comment:        !!perms.comment,
      manageColumns:  !!perms.manage_columns,
      manageMembers:  !!perms.manage_members,
      manageBoard:    !!perms.manage_members,
      manageAutos:    !!perms.manage_automations,
      deleteBoard:    false,
    },
  };
}
