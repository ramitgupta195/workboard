import { create } from 'zustand';
import { boardsApi } from '../api';

const TTL = 30_000; // 30 seconds

export const useBoardsStore = create((set, get) => ({
  boards: [],
  loading: false,
  fetchedAt: null,

  async fetch(force = false) {
    const { loading, fetchedAt } = get();
    if (loading) return;
    if (!force && fetchedAt && Date.now() - fetchedAt < TTL) return;
    set({ loading: true });
    try {
      const boards = await boardsApi.list();
      set({ boards, fetchedAt: Date.now() });
    } finally {
      set({ loading: false });
    }
  },

  invalidate() {
    set({ fetchedAt: null });
  },

  add(board) {
    set(s => ({ boards: [board, ...s.boards] }));
  },

  update(updated) {
    set(s => ({ boards: s.boards.map(b => b.id === updated.id ? { ...b, ...updated } : b) }));
  },

  remove(boardId) {
    set(s => ({ boards: s.boards.filter(b => b.id !== boardId) }));
  },
}));
