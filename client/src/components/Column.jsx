import { useState, useRef, useEffect } from 'react';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import TaskCard from './TaskCard';
import { cardsApi } from '../api';
import { useAuthStore } from '../store/authStore';

const COLORS = [
  '#94a3b8', '#6366f1', '#8b5cf6', '#a855f7',
  '#ec4899', '#ef4444', '#f97316', '#eab308',
  '#22c55e', '#10b981', '#06b6d4', '#3b82f6',
];

function ColumnMenu({ column, onColorChange, onDelete }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (!ref.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onPointerDown={e => e.stopPropagation()}
        onClick={e => { e.stopPropagation(); setOpen(v => !v); }}
        className={`p-1 rounded transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-black/5 dark:hover:bg-white/10 ${open ? 'opacity-100 text-slate-600 dark:text-slate-300' : ''}`}
        title="Column options"
      >
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
          <circle cx="4" cy="10" r="1.5" />
          <circle cx="10" cy="10" r="1.5" />
          <circle cx="16" cy="10" r="1.5" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-44 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-2 overflow-hidden">
          <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide px-3 mb-1.5">Color</p>
          <div className="grid grid-cols-6 gap-1 px-3 mb-2">
            {COLORS.map(c => (
              <button
                key={c}
                onPointerDown={e => e.stopPropagation()}
                onClick={e => { e.stopPropagation(); onColorChange(c); setOpen(false); }}
                className="w-5 h-5 rounded-full transition-transform hover:scale-110 focus:outline-none"
                style={{
                  background: c,
                  boxShadow: column.color === c ? `0 0 0 2px white, 0 0 0 3.5px ${c}` : 'none',
                }}
              />
            ))}
          </div>
          <div className="border-t border-slate-100 dark:border-slate-700 my-1" />
          <button
            onPointerDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); setOpen(false); onDelete(); }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete column
          </button>
        </div>
      )}
    </div>
  );
}

export default function Column({ column, can, onCardClick, onCardCreated, onColumnUpdated, onColumnDeleted, isDragOverlay }) {
  const user = useAuthStore(s => s.user);
  const [addingCard, setAddingCard] = useState(false);
  const [newCardTitle, setNewCardTitle] = useState('');
  const [editingTitle, setEditingTitle] = useState(false);
  const [colTitle, setColTitle] = useState(column.title);
  const [saving, setSaving] = useState(false);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: column.id,
    data: { type: 'column', column },
  });

  const style = isDragOverlay ? {} : { transform: CSS.Transform.toString(transform), transition };
  const cardIds = (column.cards || []).map(c => c.id);

  async function handleCreateCard(e) {
    e.preventDefault();
    if (!newCardTitle.trim()) return;
    setSaving(true);
    try {
      const card = await cardsApi.create(column.id, { title: newCardTitle.trim() });
      onCardCreated(column.id, card);
      setNewCardTitle('');
      setAddingCard(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleTitleSave() {
    if (colTitle.trim() && colTitle !== column.title) {
      await onColumnUpdated(column.id, { ...column, title: colTitle.trim() });
    } else {
      setColTitle(column.title);
    }
    setEditingTitle(false);
  }

  async function handleColorChange(color) {
    await onColumnUpdated(column.id, { ...column, color });
  }

  const wrapClass = [
    'column-wrap group',
    isDragging ? 'opacity-40' : '',
    isDragOverlay ? 'rotate-1 shadow-2xl' : '',
  ].filter(Boolean).join(' ');

  return (
    <div ref={isDragOverlay ? undefined : setNodeRef} style={style} className={wrapClass}>
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2.5 cursor-grab select-none"
        {...(isDragOverlay ? {} : { ...attributes, ...listeners })}
      >
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ background: column.color || '#94a3b8' }}
        />

        {editingTitle ? (
          <input
            autoFocus
            value={colTitle}
            onChange={e => setColTitle(e.target.value)}
            onBlur={handleTitleSave}
            onKeyDown={e => {
              if (e.key === 'Enter') handleTitleSave();
              if (e.key === 'Escape') { setColTitle(column.title); setEditingTitle(false); }
            }}
            onClick={e => e.stopPropagation()}
            onPointerDown={e => e.stopPropagation()}
            className="flex-1 bg-white dark:bg-slate-700 border border-indigo-300 dark:border-indigo-600 rounded-md px-2 py-0.5 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-400 min-w-0"
          />
        ) : (
          <button
            className="flex-1 text-xs font-semibold text-slate-600 dark:text-slate-400 truncate text-left hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
            onClick={e => { e.stopPropagation(); setEditingTitle(true); }}
            onPointerDown={e => e.stopPropagation()}
          >
            {column.title}
          </button>
        )}

        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium bg-slate-100 dark:bg-slate-700/60 rounded px-1.5 py-0.5 leading-none flex-shrink-0">
          {column.cards?.length || 0}
        </span>

        {!isDragOverlay && (can?.createCard !== false || can?.manageColumns !== false) && (
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {can?.createCard !== false && (
              <button
                onPointerDown={e => e.stopPropagation()}
                onClick={e => { e.stopPropagation(); setAddingCard(true); }}
                className="p-1 rounded transition-colors text-slate-400 hover:text-indigo-500 dark:hover:text-indigo-400 hover:bg-black/5 dark:hover:bg-white/10"
                title="Add card"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            )}
            {can?.manageColumns !== false && (
              <ColumnMenu
                column={column}
                onColorChange={handleColorChange}
                onDelete={() => onColumnDeleted(column.id)}
              />
            )}
          </div>
        )}
      </div>

      {/* Cards */}
      <div className="column-cards">
        <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
          {(column.cards || []).map(card => {
            const isOwnCard = card.created_by === user?.id || card.assignees?.some(a => a.id === user?.id);
            const canDrag = !isDragOverlay && can?.moveCard !== false && (can?.moveAnyCard !== false || isOwnCard);
            return (
              <TaskCard
                key={card.id}
                card={card}
                columnTitle={column.title}
                columnColor={column.color}
                canDrag={canDrag}
                onClick={() => onCardClick(card)}
              />
            );
          })}
        </SortableContext>

        {column.cards?.length === 0 && !addingCard && (
          <div className="h-10 rounded-lg border border-dashed border-slate-200 dark:border-slate-600 flex items-center justify-center">
            <span className="text-[11px] text-slate-300 dark:text-slate-600">Empty</span>
          </div>
        )}
      </div>

      {/* Add card */}
      <div className="px-2 pb-2 pt-1">
        {addingCard ? (
          <form onSubmit={handleCreateCard} className="space-y-1.5">
            <textarea
              autoFocus
              value={newCardTitle}
              onChange={e => setNewCardTitle(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleCreateCard(e); }
                if (e.key === 'Escape') { setAddingCard(false); setNewCardTitle(''); }
              }}
              placeholder="Card title…"
              rows={2}
              className="w-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 dark:text-slate-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none shadow-sm placeholder-slate-300 dark:placeholder-slate-500"
            />
            <div className="flex gap-1.5">
              <button
                type="submit"
                disabled={!newCardTitle.trim() || saving}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-medium py-1.5 rounded-lg transition-colors"
              >
                {saving ? '…' : 'Add'}
              </button>
              <button
                type="button"
                onClick={() => { setAddingCard(false); setNewCardTitle(''); }}
                className="px-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs rounded-lg transition-colors"
              >
                ✕
              </button>
            </div>
          </form>
        ) : can?.createCard !== false ? (
          <button
            onClick={() => setAddingCard(true)}
            className="w-full flex items-center gap-1.5 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 px-2 py-1.5 rounded-lg transition-colors text-xs"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add card
          </button>
        ) : null}
      </div>
    </div>
  );
}
