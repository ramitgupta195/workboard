import { create } from 'zustand';
import { notificationsApi } from '../api';

export const useNotificationsStore = create((set, get) => ({
  notifications: [],
  loading: false,
  fetchedAt: null,

  get unread() {
    return get().notifications.filter(n => !n.is_read).length;
  },

  async fetch() {
    if (get().loading) return;
    set({ loading: true });
    try {
      const notifications = await notificationsApi.list();
      set({ notifications, fetchedAt: Date.now() });
    } catch {}
    finally { set({ loading: false }); }
  },

  markRead(id) {
    set(s => ({
      notifications: s.notifications.map(n => n.id === id ? { ...n, is_read: true } : n),
    }));
    notificationsApi.markRead(id).catch(() => {});
  },

  markAllRead() {
    set(s => ({
      notifications: s.notifications.map(n => ({ ...n, is_read: true })),
    }));
    notificationsApi.markAllRead().catch(() => {});
  },

  add(notification) {
    set(s => ({ notifications: [notification, ...s.notifications] }));
  },
}));
