import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import UserAvatar from './UserAvatar';

const PRIORITY_COLORS = {
  none: null,
  low: '#3b82f6',
  medium: '#f59e0b',
  high: '#f97316',
  urgent: '#ef4444',
};

const PRIORITY_ICONS = {
  low:    { path: 'M5 15l7-7 7 7', label: 'Low' },
  medium: { path: 'M20 12H4',      label: 'Med' },
  high:   { path: 'M19 9l-7 7-7-7', label: 'High' },
  urgent: { path: 'M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z', label: '!!' },
};

export default function TaskCard({ card, columnTitle, columnColor, onClick, isDragOverlay, canDrag = true }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: 'card', card },
    disabled: !canDrag,
  });

  const style = isDragOverlay ? {} : { transform: CSS.Transform.toString(transform), transition };

  const isOverdue = card.due_date && new Date(card.due_date) < new Date() && !isDragOverlay;
  const formattedDate = card.due_date
    ? new Date(card.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;

  const priority = card.priority || 'none';
  const priorityColor = PRIORITY_COLORS[priority];

  const cls = [
    'task-card',
    priority !== 'none' ? `priority-${priority}` : '',
    isDragging ? 'dragging' : '',
    isDragOverlay ? 'drag-overlay' : '',
    !canDrag && !isDragOverlay ? 'cursor-default' : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      ref={isDragOverlay ? undefined : setNodeRef}
      style={style}
      className={cls}
      {...(isDragOverlay ? {} : { ...attributes, ...listeners })}
      onClick={isDragOverlay ? undefined : onClick}
    >
      {/* Cover image */}
      {card.cover_image && (
        <div className="rounded-lg overflow-hidden mb-2.5 -mx-0.5">
          <img
            src={card.cover_image}
            alt="Cover"
            className="w-full h-24 object-cover"
            draggable={false}
          />
        </div>
      )}
      {/* Top row: labels + priority icon */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex flex-wrap gap-1 flex-1">
          {card.labels?.map(label => (
            <span
              key={label.id}
              className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full leading-none"
              style={{ background: label.color + '18', color: label.color, border: `1px solid ${label.color}30` }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: label.color }} />
              {label.name}
            </span>
          ))}
        </div>

        {!canDrag && !isDragOverlay && (
          <span title="You can only move your own cards" className="flex-shrink-0 mt-0.5 text-slate-300">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </span>
        )}
        {priorityColor && (
          <span title={priority} style={{ color: priorityColor }} className="flex-shrink-0 mt-0.5">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d={PRIORITY_ICONS[priority]?.path} />
            </svg>
          </span>
        )}
      </div>

      {/* Title */}
      <p className="text-[13px] text-slate-800 dark:text-slate-100 font-medium leading-snug mb-2.5 tracking-tight">
        {card.title}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Status */}
          {columnTitle && (
            <span
              className="text-[10px] font-medium px-1.5 py-0.5 rounded leading-none"
              style={{ background: (columnColor || '#94a3b8') + '18', color: columnColor || '#94a3b8' }}
            >
              {columnTitle}
            </span>
          )}

          {/* Due date */}
          {formattedDate && (
            <span
              className={`inline-flex items-center gap-0.5 text-[10px] font-medium leading-none px-1.5 py-0.5 rounded ${
                isOverdue ? 'bg-red-50 dark:bg-red-900/30 text-red-500' : 'text-slate-400 dark:text-slate-500'
              }`}
            >
              <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {formattedDate}
            </span>
          )}

          {/* Has description */}
          {card.description && (
            <svg className="w-3 h-3 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h8" />
            </svg>
          )}
        </div>

        {/* Assignees */}
        {card.assignees?.length > 0 && (
          <div className="flex -space-x-1.5">
            {card.assignees.slice(0, 3).map(u => (
              <UserAvatar key={u.id} user={u} size={18} className="ring-1 ring-white dark:ring-slate-700" />
            ))}
            {card.assignees.length > 3 && (
              <div className="w-[18px] h-[18px] rounded-full bg-slate-100 dark:bg-slate-700 ring-1 ring-white dark:ring-slate-600 flex items-center justify-center text-[8px] text-slate-500 dark:text-slate-300 font-semibold">
                +{card.assignees.length - 3}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
