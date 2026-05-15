import { create } from 'zustand';

const stored = localStorage.getItem('wb_user');

export const useAuthStore = create(set => ({
  user: stored ? JSON.parse(stored) : null,
  token: localStorage.getItem('wb_token') || null,

  login(user, token) {
    localStorage.setItem('wb_user', JSON.stringify(user));
    localStorage.setItem('wb_token', token);
    set({ user, token });
  },

  logout() {
    localStorage.removeItem('wb_user');
    localStorage.removeItem('wb_token');
    set({ user: null, token: null });
  },
}));
