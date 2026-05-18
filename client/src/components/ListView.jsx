import UserAvatar from './UserAvatar';

const PRIORITY_COLORS = {
  none: '#94a3b8',
  low: '#3b82f6',
  medium: '#f59e0b',
  high: '#f97316',
  urgent: '#ef4444',
};

const PRIORITY_ICONS = {
  low:    'M5 15l7-7 7 7',
  medium: 'M20 12H4',
  high:   'M19 9l-7 7-7-7',
  urgent: 'M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z',
};

function PriorityBadge({ priority }) {
  if (!priority || priority === 'none') {
    return <span className="text-xs text-slate-300 dark:text-slate-600">—</span>;
  }
  const color = PRIORITY_COLORS[priority];
  const iconPath = PRIORITY_ICONS[priority];
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded capitalize"
      style={{ background: color + '18', color }}
    >
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d={iconPath} />
      </svg>
      {priority}
    </span>
  );
}

export default function ListView({ columns = [], onCardClick }) {
  // columns is array of { id, title, color, cards: [...] }
  const allColumns = columns.filter(col => col.cards && col.cards.length > 0);

  if (allColumns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-slate-400 dark:text-slate-500 text-sm">No cards to display</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 px-4 py-4">
      {allColumns.map(col => (
        <div key={col.id}>
          {/* Column header */}
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: col.color || '#94a3b8' }} />
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">{col.title}</span>
            <span className="text-[11px] text-slate-400 bg-slate-100 dark:bg-slate-700 dark:text-slate-500 rounded px-1.5 py-0.5">
              {col.cards.length}
            </span>
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700">
                  <th className="text-left text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-4 py-2.5">Title</th>
                  <th className="text-left text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-3 py-2.5 w-28">Priority</th>
                  <th className="text-left text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-3 py-2.5 w-32">Status</th>
                  <th className="text-left text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-3 py-2.5 w-28">Due date</th>
                  <th className="text-left text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-3 py-2.5 w-24">Assignees</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {col.cards.map(card => {
                  const isOverdue = card.due_date && new Date(card.due_date) < new Date();
                  const formattedDate = card.due_date
                    ? new Date(card.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                    : null;

                  return (
                    <tr
                      key={card.id}
                      onClick={() => onCardClick?.(card)}
                      className="hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{card.title}</p>
                          {card.labels?.length > 0 && (
                            <div className="flex gap-1 flex-shrink-0">
                              {card.labels.slice(0, 2).map(label => (
                                <span
                                  key={label.id}
                                  className="w-2 h-2 rounded-full flex-shrink-0"
                                  style={{ background: label.color }}
                                  title={label.name}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <PriorityBadge priority={card.priority} />
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                          style={{
                            background: (col.color || '#94a3b8') + '18',
                            color: col.color || '#94a3b8',
                          }}
                        >
                          {col.title}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        {formattedDate ? (
                          <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                            isOverdue ? 'text-red-500 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'
                          }`}>
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            {formattedDate}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-300 dark:text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {card.assignees?.length > 0 ? (
                          <div className="flex -space-x-1.5">
                            {card.assignees.slice(0, 3).map(u => (
                              <UserAvatar key={u.id} user={u} size={22} className="ring-1 ring-white dark:ring-slate-800" />
                            ))}
                            {card.assignees.length > 3 && (
                              <div className="w-[22px] h-[22px] rounded-full bg-slate-100 dark:bg-slate-700 ring-1 ring-white dark:ring-slate-800 flex items-center justify-center text-[8px] text-slate-500 font-semibold">
                                +{card.assignees.length - 3}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-300 dark:text-slate-600">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
