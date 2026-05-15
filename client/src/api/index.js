import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('wb_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

api.interceptors.response.use(
  r => r.data,
  err => Promise.reject(err.response?.data || err)
);

export const authApi = {
  register: d => api.post('/auth/register', d),
  login: d => api.post('/auth/login', d),
  me: () => api.get('/auth/me'),
};

export const boardsApi = {
  list: () => api.get('/boards'),
  create: d => api.post('/boards', d),
  get: id => api.get(`/boards/${id}`),
  update: (id, d) => api.put(`/boards/${id}`, d),
  delete: id => api.delete(`/boards/${id}`),
  addMember: (id, email, role = 'member') => api.post(`/boards/${id}/members`, { email, role }),
  updateMemberRole: (boardId, userId, role) => api.put(`/boards/${boardId}/members/${userId}`, { role }),
  removeMember: (boardId, userId) => api.delete(`/boards/${boardId}/members/${userId}`),
  getPermissions: (boardId) => api.get(`/boards/${boardId}/permissions`),
  updateRolePermissions: (boardId, role, permissions) => api.put(`/boards/${boardId}/permissions/${role}`, permissions),
  createColumn: (boardId, d) => api.post(`/boards/${boardId}/columns`, d),
  reorderColumns: (boardId, columnIds) => api.post(`/boards/${boardId}/columns/reorder`, { columnIds }),
};

export const columnsApi = {
  update: (id, d) => api.put(`/columns/${id}`, d),
  delete: id => api.delete(`/columns/${id}`),
};

export const cardsApi = {
  create: (columnId, d) => api.post(`/cards/columns/${columnId}/cards`, d),
  get: id => api.get(`/cards/${id}`),
  update: (id, d) => api.put(`/cards/${id}`, d),
  delete: id => api.delete(`/cards/${id}`),
  move: d => api.post('/cards/move', d),
  getComments: cardId => api.get(`/cards/${cardId}/comments`),
  addComment: (cardId, content) => api.post(`/cards/${cardId}/comments`, { content }),
  getActivities: cardId => api.get(`/cards/${cardId}/activities`),
};

export const commentsApi = {
  delete: id => api.delete(`/comments/${id}`),
};

export const usersApi = {
  search: q => api.get(`/users/search?q=${encodeURIComponent(q)}`),
};

export const automationsApi = {
  list: boardId => api.get(`/automations/boards/${boardId}`),
  create: (boardId, rule) => api.post(`/automations/boards/${boardId}`, rule),
  update: (id, rule) => api.put(`/automations/${id}`, rule),
  delete: id => api.delete(`/automations/${id}`),
  getLogs: boardId => api.get(`/automations/boards/${boardId}/logs`),
};

export const notificationsApi = {
  list: () => api.get('/notifications'),
  markRead: id => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/read-all'),
};

export const searchApi = {
  search: q => api.get(`/search?q=${encodeURIComponent(q)}`),
};

export default api;
