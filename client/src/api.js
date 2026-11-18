const jsonHeaders = { 'Content-Type': 'application/json' };

async function request(path, { method = 'GET', body, ...rest } = {}) {
  const res = await fetch(path, {
    method,
    credentials: 'include',
    headers: body ? jsonHeaders : undefined,
    body: body ? JSON.stringify(body) : undefined,
    ...rest,
  });
  const isJson = (res.headers.get('content-type') || '').includes('application/json');
  const payload = isJson ? await res.json() : null;
  if (!res.ok) {
    const error = new Error(payload?.error || `Erreur ${res.status}`);
    error.status = res.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

export const api = {
  site: () => request('/api/site'),
  books: () => request('/api/books'),
  book: (slug) => request(`/api/books/${encodeURIComponent(slug)}`),
  chapter: (slug, number) => request(`/api/books/${encodeURIComponent(slug)}/chapters/${number}`),
  contact: (body) => request('/api/contact', { method: 'POST', body }),

  me: () => request('/api/auth/me'),
  login: (body) => request('/api/auth/login', { method: 'POST', body }),
  register: (body) => request('/api/auth/register', { method: 'POST', body }),
  logout: () => request('/api/auth/logout', { method: 'POST' }),
  changePassword: (body) => request('/api/auth/password', { method: 'POST', body }),

  purchases: () => request('/api/me/purchases'),
  buy: (body) => request('/api/me/purchases', { method: 'POST', body }),
  progress: () => request('/api/me/progress'),
  saveProgress: (body) => request('/api/me/progress', { method: 'POST', body }),
  overview: () => request('/api/me/overview'),
  audience: () => request('/api/me/audience'),
  viewBook: (slug, chapterNumber) =>
    request(`/api/books/${slug}/view`, { method: 'POST', body: { chapterNumber } }),
  reactBook: (slug, emoji) => request(`/api/books/${slug}/react`, { method: 'POST', body: { emoji } }),
  unreaction: (slug) => request(`/api/books/${slug}/react`, { method: 'DELETE' }),
  followAuthor: (name) => request(`/api/authors/${encodeURIComponent(name)}/follow`, { method: 'POST' }),
  unfollowAuthor: (name) => request(`/api/authors/${encodeURIComponent(name)}/follow`, { method: 'DELETE' }),
  subscription: () => request('/api/me/subscription'),
  subscribe: (body) => request('/api/me/subscription', { method: 'POST', body }),
  authorStatus: () => request('/api/me/author'),
  applyAuthor: (body) => request('/api/me/author', { method: 'POST', body }),
  drafts: () => request('/api/me/drafts'),
  createDraft: (body) => request('/api/me/drafts', { method: 'POST', body }),
  draft: (slug) => request(`/api/me/drafts/${slug}`),
  saveChapter: (slug, body) => request(`/api/me/drafts/${slug}/chapters`, { method: 'POST', body }),
  favorites: () => request('/api/me/favorites'),
  addFavorite: (bookSlug) => request('/api/me/favorites', { method: 'POST', body: { bookSlug } }),
  removeFavorite: (slug) => request(`/api/me/favorites/${encodeURIComponent(slug)}`, { method: 'DELETE' }),

  admin: {
    stats: () => request('/api/admin/stats'),
    books: () => request('/api/admin/books'),
    createBook: (body) => request('/api/admin/books', { method: 'POST', body }),
    updateBook: (id, body) => request(`/api/admin/books/${id}`, { method: 'PATCH', body }),
    archiveBook: (id) => request(`/api/admin/books/${id}`, { method: 'DELETE' }),
    chapters: (id) => request(`/api/admin/books/${id}/chapters`),
    chapter: (id) => request(`/api/admin/chapters/${id}`),
    createChapter: (bookId, body) => request(`/api/admin/books/${bookId}/chapters`, { method: 'POST', body }),
    updateChapter: (id, body) => request(`/api/admin/chapters/${id}`, { method: 'PATCH', body }),
    deleteChapter: (id) => request(`/api/admin/chapters/${id}`, { method: 'DELETE' }),
    import: (bookId, body) => request(`/api/admin/books/${bookId}/import`, { method: 'POST', body }),
    messages: () => request('/api/admin/messages'),
    updateMessage: (id, body) => request(`/api/admin/messages/${id}`, { method: 'PATCH', body }),
    orders: (status) => request(`/api/admin/orders${status ? `?status=${status}` : ''}`),
    validateOrder: (id, note) => request(`/api/admin/orders/${id}/validate`, { method: 'POST', body: { note } }),
    rejectOrder: (id, note) => request(`/api/admin/orders/${id}/reject`, { method: 'POST', body: { note } }),
    refundOrder: (id, note) => request(`/api/admin/orders/${id}/refund`, { method: 'POST', body: { note } }),
    settings: () => request('/api/admin/settings'),
    saveSettings: (body) => request('/api/admin/settings', { method: 'PATCH', body }),
    users: () => request('/api/admin/users'),
    uploadCover: (body) => request('/api/admin/covers', { method: 'POST', body }),
  },
};

export function formatXof(value) {
  return `${Number(value || 0).toLocaleString('fr-FR')} FCFA`;
}

export function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value.includes('T') ? value : value.replace(' ', 'T') + 'Z');
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export const METHOD_LABELS = {
  wave_link: 'Wave',
  orange_money_direct: 'Orange Money',
  wave_api: 'Wave API',
  orange_api: 'Orange Money API',
  mtn_momo: 'MTN MoMo',
  moov: 'Moov Money',
  cinetpay: 'CinetPay',
  card: 'Carte bancaire',
};

export const STATUS_LABELS = {
  pending: 'En attente',
  paid: 'Payé',
  rejected: 'Refusé',
  refunded: 'Remboursé',
};
