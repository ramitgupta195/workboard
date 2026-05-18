import { useState, useEffect, useRef } from 'react';
import { cardsApi, commentsApi, boardsApi, checklistsApi } from '../api';
import { useAuthStore } from '../store/authStore';
import UserAvatar from './UserAvatar';
import MentionInput from './MentionInput';

const PRIORITIES = [
  { value: 'none', label: 'None', color: '#94a3b8' },
  { value: 'low', label: 'Low', color: '#3b82f6' },
  { value: 'medium', label: 'Medium', color: '#f59e0b' },
  { value: 'high', label: 'High', color: '#f97316' },
  { value: 'urgent', label: 'Urgent', color: '#ef4444' },
];

const LABEL_COLORS = [
  '#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#8b5cf6','#ec4899','#14b8a6',
];

const ACTIVITY_ICONS = {
  created:           { bg: 'bg-emerald-100 dark:bg-emerald-950/60', icon: '✦', color: 'text-emerald-600 dark:text-emerald-400' },
  moved:             { bg: 'bg-blue-100 dark:bg-blue-950/60',    icon: '→', color: 'text-blue-600 dark:text-blue-400' },
  priority_changed:  { bg: 'bg-amber-100 dark:bg-amber-950/60',  icon: '◈', color: 'text-amber-600 dark:text-amber-400' },
  due_date_changed:  { bg: 'bg-violet-100 dark:bg-violet-950/60',icon: '◷', color: 'text-violet-600 dark:text-violet-400' },
  assignees_changed: { bg: 'bg-indigo-100 dark:bg-indigo-950/60',icon: '◉', color: 'text-indigo-600 dark:text-indigo-400' },
  title_changed:     { bg: 'bg-slate-100 dark:bg-slate-700',     icon: '✎', color: 'text-slate-600 dark:text-slate-400' },
  commented:         { bg: 'bg-slate-100 dark:bg-slate-700',     icon: '◎', color: 'text-slate-500 dark:text-slate-400' },
};

function activityText(a) {
  const d = a.data || {};
  switch (a.type) {
    case 'created':          return 'created this card';
    case 'moved':            return `moved from "${d.from}" → "${d.to}"`;
    case 'priority_changed': return `changed priority: ${d.from} → ${d.to}`;
    case 'due_date_changed': return d.to ? `set due date to ${new Date(d.to).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : 'removed due date';
    case 'assignees_changed':return 'updated assignees';
    case 'title_changed':    return `renamed to "${d.to}"`;
    case 'commented':        return d.preview ? `commented: "${d.preview}${d.preview?.length >= 60 ? '…' : ''}"` : 'added a comment';
    default:                 return a.type.replace(/_/g, ' ');
  }
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const normalized = dateStr.replace(' ', 'T');
  const iso = /[Zz]$|[+-]\d{2}:\d{2}$/.test(normalized) ? normalized : normalized + 'Z';
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function renderMentions(text) {
  const parts = [];
  let lastIndex = 0;
  const re = /@[A-Z][a-z]+(?:\s[A-Z][a-z]+)*/g;
  let match;
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    parts.push(<span key={match.index} className="mention-chip">{match[0]}</span>);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function AttachmentIcon({ mimetype }) {
  if (mimetype?.startsWith('image/')) {
    return (
      <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    );
  }
  if (mimetype === 'application/pdf') {
    return (
      <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    );
  }
  return (
    <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
    </svg>
  );
}

export default function CardModal({ card: initialCard, boardMembers, columns, can, onClose, onUpdated, onDeleted, onMoveToColumn }) {
  const [card, setCard] = useState(initialCard);
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState(initialCard.title);
  const [description, setDescription] = useState(initialCard.description || '');
  const [editingDesc, setEditingDesc] = useState(false);
  const [comments, setComments] = useState([]);
  const [activities, setActivities] = useState([]);
  const [activeTab, setActiveTab] = useState('comments');
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [showLabelPicker, setShowLabelPicker] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState(LABEL_COLORS[0]);
  const [showMemberAdd, setShowMemberAdd] = useState(false);
  const [memberEmail, setMemberEmail] = useState('');
  const [addingMember, setAddingMember] = useState(false);
  const [memberError, setMemberError] = useState('');

  // Checklists
  const [checklists, setChecklists] = useState([]);
  const [addingChecklist, setAddingChecklist] = useState(false);
  const [newChecklistTitle, setNewChecklistTitle] = useState('');
  const [addingItemTo, setAddingItemTo] = useState(null); // checklistId
  const [newItemText, setNewItemText] = useState('');

  // Attachments
  const [attachments, setAttachments] = useState([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const fileInputRef = useRef(null);

  const user = useAuthStore(s => s.user);
  const titleRef = useRef(null);

  const canEdit = can?.editCard !== false;
  const canDelete = can?.deleteCard !== false;
  const canMove = can?.moveCard !== false;
  const canComment = can?.comment !== false;

  useEffect(() => {
    cardsApi.getComments(card.id).then(setComments);
    cardsApi.getActivities(card.id).then(setActivities);
    checklistsApi.list(card.id).then(setChecklists).catch(() => {});
    cardsApi.getAttachments(card.id).then(setAttachments).catch(() => {});
  }, [card.id]);

  async function saveField(field, value) {
    const updated = await cardsApi.update(card.id, { ...card, [field]: value });
    setCard(updated);
    onUpdated(updated);
  }

  async function handleTitleSave() {
    if (title.trim() && title !== card.title) await saveField('title', title.trim());
    else setTitle(card.title);
    setEditingTitle(false);
  }

  async function handleDescSave() {
    await saveField('description', description);
    setEditingDesc(false);
  }

  async function handlePriorityChange(priority) {
    await saveField('priority', priority);
  }

  async function handleDueDateChange(e) {
    await saveField('due_date', e.target.value || null);
  }

  async function handleAddLabel() {
    if (!newLabelName.trim()) return;
    const labels = [...(card.labels || []), { name: newLabelName.trim(), color: newLabelColor }];
    const updated = await cardsApi.update(card.id, { ...card, labels });
    setCard(updated);
    onUpdated(updated);
    setNewLabelName('');
    setShowLabelPicker(false);
  }

  async function handleRemoveLabel(labelId) {
    const labels = card.labels.filter(l => l.id !== labelId);
    const updated = await cardsApi.update(card.id, { ...card, labels });
    setCard(updated);
    onUpdated(updated);
  }

  async function toggleAssignee(member) {
    const isAssigned = card.assignees?.some(a => a.id === member.id);
    const assigneeIds = isAssigned
      ? card.assignees.filter(a => a.id !== member.id).map(a => a.id)
      : [...(card.assignees || []).map(a => a.id), member.id];
    const updated = await cardsApi.update(card.id, { ...card, assigneeIds });
    setCard(updated);
    onUpdated(updated);
  }

  async function submitComment() {
    if (!commentText.trim()) return;
    setSubmittingComment(true);
    try {
      const comment = await cardsApi.addComment(card.id, commentText.trim());
      setComments(cs => [...cs, comment]);
      setCommentText('');
      // Refresh activities to show new comment entry
      cardsApi.getActivities(card.id).then(setActivities);
    } finally {
      setSubmittingComment(false);
    }
  }

  async function deleteComment(id) {
    await commentsApi.delete(id);
    setComments(cs => cs.filter(c => c.id !== id));
  }

  async function handleAddMember(e) {
    e.preventDefault();
    if (!memberEmail.trim()) return;
    setAddingMember(true);
    setMemberError('');
    try {
      await boardsApi.addMember(card.board_id, memberEmail.trim());
      setMemberEmail('');
      setShowMemberAdd(false);
    } catch (err) {
      setMemberError(err.error || 'Failed to add member');
    } finally {
      setAddingMember(false);
    }
  }

  async function handleArchiveToggle() {
    const updated = card.archived
      ? await cardsApi.unarchive(card.id)
      : await cardsApi.archive(card.id);
    setCard(updated);
    onUpdated(updated);
  }

  async function handleDelete() {
    if (!confirm('Delete this card?')) return;
    await cardsApi.delete(card.id);
    onDeleted(card.id);
    onClose();
  }

  // --- Checklists ---
  async function handleAddChecklist(e) {
    e.preventDefault();
    if (!newChecklistTitle.trim()) return;
    const cl = await checklistsApi.create(card.id, newChecklistTitle.trim());
    setChecklists(prev => [...prev, { ...cl, items: [] }]);
    setNewChecklistTitle('');
    setAddingChecklist(false);
  }

  async function handleDeleteChecklist(clId) {
    await checklistsApi.delete(clId);
    setChecklists(prev => prev.filter(c => c.id !== clId));
  }

  async function handleAddItem(e, clId) {
    e.preventDefault();
    if (!newItemText.trim()) return;
    const item = await checklistsApi.addItem(clId, newItemText.trim());
    setChecklists(prev => prev.map(cl =>
      cl.id === clId ? { ...cl, items: [...(cl.items || []), item] } : cl
    ));
    setNewItemText('');
    setAddingItemTo(null);
  }

  async function handleToggleItem(clId, itemId, done) {
    const updated = await checklistsApi.updateItem(itemId, { done });
    setChecklists(prev => prev.map(cl =>
      cl.id === clId
        ? { ...cl, items: cl.items.map(it => it.id === itemId ? updated : it) }
        : cl
    ));
  }

  async function handleDeleteItem(clId, itemId) {
    await checklistsApi.deleteItem(itemId);
    setChecklists(prev => prev.map(cl =>
      cl.id === clId ? { ...cl, items: cl.items.filter(it => it.id !== itemId) } : cl
    ));
  }

  // --- Attachments ---
  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAttachment(true);
    try {
      const att = await cardsApi.uploadAttachment(card.id, file);
      setAttachments(prev => [...prev, att]);
    } finally {
      setUploadingAttachment(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleDeleteAttachment(attId) {
    await cardsApi.deleteAttachment(attId);
    setAttachments(prev => prev.filter(a => a.id !== attId));
    // If it was the cover, clear it
    if (card.cover_image) {
      const att = attachments.find(a => a.id === attId);
      if (att && card.cover_image.includes(att.filename)) {
        const updated = await cardsApi.setCover(card.id, null);
        setCard(updated);
        onUpdated(updated);
      }
    }
  }

  async function handleSetCover(attId) {
    const isCurrent = card.cover_attachment_id === attId;
    const updated = await cardsApi.setCover(card.id, isCurrent ? null : attId);
    setCard(updated);
    onUpdated(updated);
  }

  const currentPriority = PRIORITIES.find(p => p.value === card.priority) || PRIORITIES[0];
  const isOverdue = card.due_date && new Date(card.due_date) < new Date();

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 w-full max-w-2xl animate-slide-up transition-colors duration-300" onClick={e => e.stopPropagation()}>
        {/* Cover image */}
        {card.cover_image && (
          <div className="rounded-t-xl overflow-hidden">
            <img src={card.cover_image} alt="Card cover" className="w-full h-32 object-cover" />
          </div>
        )}

        {currentPriority.value !== 'none' && !card.cover_image && (
          <div className="h-0.5 rounded-t-xl" style={{ background: currentPriority.color }} />
        )}

        {/* Archived banner */}
        {card.archived && (
          <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900 px-5 py-2 flex items-center gap-2">
            <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
            <span className="text-sm text-amber-700 dark:text-amber-400 font-medium">This card is archived</span>
          </div>
        )}

        <div className="flex">
          {/* Main content */}
          <div className="flex-1 p-5 min-w-0">
            {/* Title row */}
            <div className="flex items-start gap-2 mb-3">
              {editingTitle && canEdit ? (
                <input
                  ref={titleRef}
                  autoFocus
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  onBlur={handleTitleSave}
                  onKeyDown={e => { if (e.key === 'Enter') handleTitleSave(); if (e.key === 'Escape') { setTitle(card.title); setEditingTitle(false); } }}
                  className="flex-1 text-base font-semibold text-slate-900 dark:text-slate-100 border-b border-indigo-400 focus:outline-none bg-transparent pb-0.5"
                />
              ) : (
                <h2
                  className={`flex-1 text-base font-semibold text-slate-900 dark:text-slate-100 leading-snug ${canEdit ? 'cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors' : ''}`}
                  onClick={() => canEdit && setEditingTitle(true)}
                >
                  {card.title}
                </h2>
              )}
              <button onClick={onClose} className="text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-400 transition-colors flex-shrink-0 mt-0.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Labels */}
            {card.labels?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {card.labels.map(label => (
                  <span
                    key={label.id}
                    className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full"
                    style={{ background: label.color + '18', color: label.color, border: `1px solid ${label.color}30` }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: label.color }} />
                    {label.name}
                    {canEdit && <button onClick={() => handleRemoveLabel(label.id)} className="hover:opacity-60 ml-0.5">×</button>}
                  </span>
                ))}
              </div>
            )}

            {/* Description */}
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h8" />
                </svg>
                <span className="text-sm font-semibold text-gray-700 dark:text-slate-300">Description</span>
              </div>
              {editingDesc && canEdit ? (
                <div>
                  <textarea
                    autoFocus
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    rows={4}
                    className="w-full border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                    placeholder="Add a description…"
                  />
                  <div className="flex gap-2 mt-2">
                    <button onClick={handleDescSave} className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors">Save</button>
                    <button onClick={() => { setDescription(card.description || ''); setEditingDesc(false); }} className="text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 text-xs px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">Cancel</button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => canEdit && setEditingDesc(true)}
                  className={`rounded-lg px-3 py-2 text-sm min-h-[52px] transition-colors ${canEdit ? 'cursor-pointer' : ''} ${
                    description ? 'text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700' : 'text-gray-400 dark:text-slate-500 bg-gray-50 dark:bg-slate-700/50 hover:bg-gray-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {description || (canEdit ? 'Click to add a description…' : 'No description')}
                </div>
              )}
            </div>

            {/* Checklists */}
            {(checklists.length > 0 || canEdit) && (
              <div className="mb-5">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  <span className="text-sm font-semibold text-gray-700 dark:text-slate-300">Checklists</span>
                  {canEdit && (
                    <button
                      onClick={() => setAddingChecklist(v => !v)}
                      className="ml-auto text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 font-medium"
                    >
                      + Add checklist
                    </button>
                  )}
                </div>

                {addingChecklist && (
                  <form onSubmit={handleAddChecklist} className="flex gap-2 mb-3">
                    <input
                      autoFocus
                      value={newChecklistTitle}
                      onChange={e => setNewChecklistTitle(e.target.value)}
                      placeholder="Checklist title…"
                      className="flex-1 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      onKeyDown={e => { if (e.key === 'Escape') { setAddingChecklist(false); setNewChecklistTitle(''); } }}
                    />
                    <button type="submit" className="bg-indigo-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors">Add</button>
                    <button type="button" onClick={() => { setAddingChecklist(false); setNewChecklistTitle(''); }} className="text-slate-400 hover:text-slate-600 text-xs px-2">✕</button>
                  </form>
                )}

                <div className="space-y-4">
                  {checklists.map(cl => {
                    const total = cl.items?.length || 0;
                    const done = cl.items?.filter(it => it.done).length || 0;
                    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                    return (
                      <div key={cl.id}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300 flex-1">{cl.title}</span>
                          <span className="text-[11px] text-slate-400">{pct}%</span>
                          {canEdit && (
                            <button onClick={() => handleDeleteChecklist(cl.id)} className="text-slate-300 hover:text-red-400 transition-colors">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                        {total > 0 && (
                          <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full mb-2 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-300"
                              style={{ width: `${pct}%`, background: pct === 100 ? '#22c55e' : '#6366f1' }}
                            />
                          </div>
                        )}
                        <div className="space-y-1">
                          {(cl.items || []).map(item => (
                            <div key={item.id} className="flex items-start gap-2 group/item">
                              <input
                                type="checkbox"
                                checked={item.done}
                                onChange={e => canEdit && handleToggleItem(cl.id, item.id, e.target.checked)}
                                disabled={!canEdit}
                                className="mt-0.5 w-3.5 h-3.5 rounded accent-indigo-600 flex-shrink-0 cursor-pointer"
                              />
                              <span className={`flex-1 text-sm ${item.done ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-300'}`}>
                                {item.text}
                              </span>
                              {canEdit && (
                                <button
                                  onClick={() => handleDeleteItem(cl.id, item.id)}
                                  className="opacity-0 group-hover/item:opacity-100 text-slate-300 hover:text-red-400 transition-all"
                                >
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                        {canEdit && (
                          addingItemTo === cl.id ? (
                            <form onSubmit={e => handleAddItem(e, cl.id)} className="flex gap-2 mt-2">
                              <input
                                autoFocus
                                value={newItemText}
                                onChange={e => setNewItemText(e.target.value)}
                                placeholder="Item text…"
                                className="flex-1 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                onKeyDown={e => { if (e.key === 'Escape') { setAddingItemTo(null); setNewItemText(''); } }}
                              />
                              <button type="submit" className="bg-indigo-600 text-white text-xs px-2 py-1 rounded hover:bg-indigo-700 transition-colors">Add</button>
                              <button type="button" onClick={() => { setAddingItemTo(null); setNewItemText(''); }} className="text-slate-400 hover:text-slate-600 text-xs">✕</button>
                            </form>
                          ) : (
                            <button
                              onClick={() => { setAddingItemTo(cl.id); setNewItemText(''); }}
                              className="text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 font-medium mt-1.5"
                            >
                              + Add item
                            </button>
                          )
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Attachments */}
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                <span className="text-sm font-semibold text-gray-700 dark:text-slate-300">Attachments</span>
                {canEdit && (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingAttachment}
                      className="ml-auto text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 font-medium disabled:opacity-50"
                    >
                      {uploadingAttachment ? 'Uploading…' : '+ Attach file'}
                    </button>
                  </>
                )}
              </div>

              {attachments.length > 0 && (
                <div className="space-y-2">
                  {attachments.map(att => {
                    const isImage = att.mimetype?.startsWith('image/');
                    const isCover = card.cover_attachment_id === att.id;
                    return (
                      <div key={att.id} className="flex items-start gap-3 group/att p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                        {isImage ? (
                          <img src={att.url} alt={att.original_name} className="w-10 h-10 rounded object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded bg-slate-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                            <AttachmentIcon mimetype={att.mimetype} />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <a
                            href={att.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 truncate block transition-colors"
                          >
                            {att.original_name}
                          </a>
                          <p className="text-[11px] text-slate-400 dark:text-slate-500">{formatBytes(att.size)}</p>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover/att:opacity-100 transition-opacity flex-shrink-0">
                          {isImage && canEdit && (
                            <button
                              onClick={() => handleSetCover(att.id)}
                              className={`text-[10px] font-medium px-1.5 py-0.5 rounded transition-colors ${
                                isCover
                                  ? 'bg-indigo-100 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400'
                                  : 'text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30'
                              }`}
                              title={isCover ? 'Remove cover' : 'Set as cover'}
                            >
                              {isCover ? 'Cover ✓' : 'Set cover'}
                            </button>
                          )}
                          {canEdit && (
                            <button
                              onClick={() => handleDeleteAttachment(att.id)}
                              className="text-slate-300 hover:text-red-400 transition-colors p-0.5"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Comments / Activity tabs */}
            <div>
              <div className="flex items-center gap-1 mb-3 border-b border-slate-100 dark:border-slate-700">
                {['comments', 'activity'].map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-3 py-1.5 text-xs font-semibold capitalize transition-colors border-b-2 -mb-px ${
                      activeTab === tab
                        ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                        : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                    }`}
                  >
                    {tab}
                    {tab === 'comments' && comments.length > 0 && (
                      <span className="ml-1 text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded px-1">{comments.length}</span>
                    )}
                  </button>
                ))}
              </div>

              {activeTab === 'comments' ? (
                <>
                  <div className="space-y-3 mb-3 max-h-44 overflow-y-auto">
                    {comments.map(c => (
                      <div key={c.id} className="flex gap-2.5">
                        <UserAvatar user={{ name: c.user_name, avatar_color: c.user_color }} size={28} className="flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs font-semibold text-gray-700 dark:text-slate-300">{c.user_name}</span>
                            <span className="text-xs text-gray-400 dark:text-slate-500">{timeAgo(c.created_at)}</span>
                            {c.user_id === user.id && (
                              <button onClick={() => deleteComment(c.id)} className="text-gray-300 hover:text-red-400 transition-colors ml-auto">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 dark:text-slate-400 break-words">{renderMentions(c.content)}</p>
                        </div>
                      </div>
                    ))}
                    {comments.length === 0 && (
                      <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-4">No comments yet</p>
                    )}
                  </div>

                  {canComment && (
                    <div className="flex gap-2.5">
                      <UserAvatar user={user} size={28} className="flex-shrink-0 mt-1" />
                      <div className="flex-1">
                        <MentionInput
                          value={commentText}
                          onChange={setCommentText}
                          onSubmit={submitComment}
                          boardMembers={boardMembers}
                          placeholder="Write a comment… (@ to mention, Enter to send)"
                        />
                        {commentText.trim() && (
                          <button
                            onClick={submitComment}
                            disabled={submittingComment}
                            className="mt-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                          >
                            {submittingComment ? 'Sending…' : 'Save'}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {activities.length === 0 ? (
                    <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-4">No activity yet</p>
                  ) : (
                    activities.map(a => {
                      const style = ACTIVITY_ICONS[a.type] || ACTIVITY_ICONS.created;
                      return (
                        <div key={a.id} className="flex items-start gap-2.5">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-[11px] font-bold ${style.bg} ${style.color}`}>
                            {style.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-slate-700 dark:text-slate-300">
                              <span className="font-semibold">{a.user_name}</span>{' '}
                              <span className="text-slate-500 dark:text-slate-400">{activityText(a)}</span>
                            </p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{timeAgo(a.created_at)}</p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="w-48 border-l border-slate-100 dark:border-slate-700 p-4 flex flex-col gap-4 flex-shrink-0 bg-slate-50/50 dark:bg-slate-900/40 rounded-r-xl overflow-y-auto">
            {/* Status */}
            {columns?.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Status</p>
                <div className="space-y-1">
                  {columns.map(col => {
                    const isActive = col.id === card.column_id;
                    return (
                      <button
                        key={col.id}
                        onClick={() => !isActive && canMove && onMoveToColumn?.(card.id, col.id)}
                        disabled={!canMove && !isActive}
                        className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-colors ${
                          isActive ? 'font-semibold' :
                          canMove ? 'text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700/60' :
                          'text-gray-400 dark:text-slate-600 cursor-default'
                        }`}
                        style={isActive ? { background: col.color + '18', color: col.color } : {}}
                      >
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: col.color }} />
                        {col.title}
                        {isActive && (
                          <svg className="w-3.5 h-3.5 ml-auto flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Priority */}
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Priority</p>
              <div className="space-y-1">
                {PRIORITIES.map(p => (
                  <button
                    key={p.value}
                    onClick={() => canEdit && handlePriorityChange(p.value)}
                    disabled={!canEdit}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-colors ${
                      card.priority === p.value ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400 font-medium' :
                      canEdit ? 'text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700/60' :
                      'text-gray-400 dark:text-slate-600 cursor-default'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Due date */}
            <div>
              <p className={`text-[10px] font-semibold uppercase tracking-wider mb-1.5 ${isOverdue ? 'text-red-400' : 'text-slate-400'}`}>
                Due date{isOverdue ? ' · Overdue' : ''}
              </p>
              <input
                type="date"
                value={card.due_date ? card.due_date.slice(0, 10) : ''}
                onChange={handleDueDateChange}
                disabled={!canEdit}
                className={`w-full border rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${
                  isOverdue
                    ? 'border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30'
                    : 'border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200'
                } ${!canEdit ? 'opacity-60 cursor-not-allowed' : ''}`}
              />
            </div>

            {/* Assignees */}
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Assignees</p>
              <div className="space-y-1.5 mb-2">
                {boardMembers.map(member => {
                  const assigned = card.assignees?.some(a => a.id === member.id);
                  return (
                    <button
                      key={member.id}
                      onClick={() => canEdit && toggleAssignee(member)}
                      disabled={!canEdit}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors text-sm ${
                        assigned ? 'bg-indigo-50 dark:bg-indigo-950/50' :
                        canEdit ? 'hover:bg-gray-50 dark:hover:bg-slate-700/60' : 'cursor-default'
                      }`}
                    >
                      <UserAvatar user={member} size={22} />
                      <span className={`text-xs truncate ${assigned ? 'text-indigo-700 dark:text-indigo-400 font-medium' : 'text-gray-600 dark:text-slate-400'}`}>
                        {member.name}
                      </span>
                      {assigned && (
                        <svg className="w-3.5 h-3.5 text-indigo-600 ml-auto flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
              {can?.manageMembers !== false && (
                <>
                  <button
                    onClick={() => setShowMemberAdd(!showMemberAdd)}
                    className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                  >
                    + Invite member
                  </button>
                  {showMemberAdd && (
                    <form onSubmit={handleAddMember} className="mt-2">
                      <input
                        autoFocus
                        type="email"
                        value={memberEmail}
                        onChange={e => setMemberEmail(e.target.value)}
                        placeholder="Email address"
                        className="w-full border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      {memberError && <p className="text-red-500 text-xs mt-1">{memberError}</p>}
                      <button type="submit" disabled={addingMember} className="mt-1 w-full bg-indigo-600 text-white text-xs py-1 rounded hover:bg-indigo-700 transition-colors disabled:opacity-50">
                        {addingMember ? 'Adding…' : 'Add'}
                      </button>
                    </form>
                  )}
                </>
              )}
            </div>

            {/* Labels */}
            {canEdit && (
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Labels</p>
                <button
                  onClick={() => setShowLabelPicker(!showLabelPicker)}
                  className="text-xs text-indigo-600 hover:text-indigo-700 font-medium mb-2"
                >
                  + Add label
                </button>
                {showLabelPicker && (
                  <div className="space-y-2">
                    <input
                      autoFocus
                      value={newLabelName}
                      onChange={e => setNewLabelName(e.target.value)}
                      placeholder="Label name"
                      className="w-full border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddLabel(); } }}
                    />
                    <div className="flex flex-wrap gap-1">
                      {LABEL_COLORS.map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setNewLabelColor(c)}
                          className={`w-5 h-5 rounded-full transition-transform ${newLabelColor === c ? 'scale-125 ring-2 ring-offset-1 ring-gray-400' : ''}`}
                          style={{ background: c }}
                        />
                      ))}
                    </div>
                    <button onClick={handleAddLabel} className="w-full bg-indigo-600 text-white text-xs py-1 rounded hover:bg-indigo-700 transition-colors">
                      Add
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Danger zone */}
            {(canDelete || canEdit) && (
              <div className="mt-auto pt-3 border-t border-gray-100 dark:border-slate-700 space-y-1">
                {canEdit && (
                  <button
                    onClick={handleArchiveToggle}
                    className="w-full flex items-center gap-2 px-2.5 py-2 text-xs text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-lg transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                    </svg>
                    {card.archived ? 'Unarchive card' : 'Archive card'}
                  </button>
                )}
                {canDelete && (
                  <button
                    onClick={handleDelete}
                    className="w-full flex items-center gap-2 px-2.5 py-2 text-xs text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete card
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
