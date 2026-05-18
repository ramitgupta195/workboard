import axios from 'axios';

const BASE = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api';
const api = axios.create({ baseURL: BASE });

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
  forgotPassword: email => api.post('/auth/forgot-password', { email }),
  resetPassword: (token, password) => api.post('/auth/reset-password', { token, password }),
  updateProfile: d => api.put('/auth/profile', d),
  changePassword: d => api.put('/auth/change-password', d),
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
  archive: id => api.put(`/cards/${id}/archive`),
  unarchive: id => api.put(`/cards/${id}/unarchive`),
  setCover: (id, attachmentId) => api.put(`/cards/${id}/cover`, { attachmentId }),
  getAttachments: cardId => api.get(`/cards/${cardId}/attachments`),
  uploadAttachment: (cardId, file) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post(`/cards/${cardId}/attachments`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  deleteAttachment: id => api.delete(`/cards/attachments/${id}`),
  getArchived: boardId => api.get(`/boards/${boardId}/archived`),
};

export const checklistsApi = {
  list: cardId => api.get(`/checklists/cards/${cardId}/checklists`),
  create: (cardId, title) => api.post(`/checklists/cards/${cardId}/checklists`, { title }),
  update: (id, title) => api.put(`/checklists/${id}`, { title }),
  delete: id => api.delete(`/checklists/${id}`),
  addItem: (checklistId, text) => api.post(`/checklists/${checklistId}/items`, { text }),
  updateItem: (id, d) => api.put(`/checklists/items/${id}`, d),
  deleteItem: id => api.delete(`/checklists/items/${id}`),
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

export const myTasksApi = {
  list: () => api.get('/my-tasks'),
};

export const invitesApi = {
  create: (boardId, email, role = 'member') => api.post(`/boards/${boardId}/invites`, { email, role }),
  get: token => api.get(`/invites/${token}`),
  accept: token => api.post(`/invites/${token}/accept`),
};

export const exportApi = {
  csv: boardId => `/api/boards/${boardId}/export`,
};

export default api;
