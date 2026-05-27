import { useState, useRef, useEffect } from 'react';
import UserAvatar from './UserAvatar';

const PRIORITIES = [
  { value: 'low',    label: 'Low',    color: '#3b82f6' },
  { value: 'medium', label: 'Medium', color: '#f59e0b' },
  { value: 'high',   label: 'High',   color: '#f97316' },
  { value: 'urgent', label: 'Urgent', color: '#ef4444' },
];

function Dropdown({ trigger, children, open, onToggle, dropdownRef }) {
  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={onToggle}
        className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-white text-xs rounded-full px-3 py-1.5 focus:outline-none transition-colors cursor-pointer"
      >
        {trigger}
        <svg className="w-3 h-3 text-white/60 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1.5 min-w-[140px] bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-100 dark:border-slate-700 z-50 py-1 overflow-hidden">
          {children}
        </div>
      )}
    </div>
  );
}

export default function FilterBar({ members = [], filters, onFilterChange, onSearchChange }) {
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const priorityRef = useRef(null);
  const assigneeRef = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (priorityRef.current && !priorityRef.current.contains(e.target)) setPriorityOpen(false);
      if (assigneeRef.current && !assigneeRef.current.contains(e.target)) setAssigneeOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const activePriority = PRIORITIES.find(p => p.value === filters.priority);
  const activeAssignee = members.find(m => m.id === filters.assigneeId);
  const hasActiveFilter = filters.priority || filters.assigneeId || filters.search;

  return (
    <div className="relative z-[100] flex items-center gap-2 px-4 py-2 bg-black/10 backdrop-blur-sm">
      {/* Search */}
      <div className="relative">
        <div className="absolute inset-y-0 left-2.5 flex items-center pointer-events-none">
          <svg className="w-3.5 h-3.5 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
        </div>
        <input
          type="text"
          value={filters.search}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="Search cards…"
          className="w-48 bg-white/15 hover:bg-white/20 focus:bg-white/20 text-white placeholder-white/50 text-xs rounded-full pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-white/40 transition-colors"
        />
      </div>

      {/* Priority filter */}
      <Dropdown
        dropdownRef={priorityRef}
        open={priorityOpen}
        onToggle={() => { setPriorityOpen(v => !v); setAssigneeOpen(false); }}
        trigger={
          <>
            {activePriority
              ? <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: activePriority.color }} />
              : <svg className="w-3.5 h-3.5 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9M3 12h5" /></svg>
            }
            <span>{activePriority?.label ?? 'Priority'}</span>
          </>
        }
      >
        {filters.priority && (
          <button
            onClick={() => { onFilterChange({ ...filters, priority: null }); setPriorityOpen(false); }}
            className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600 flex-shrink-0" />
            Any priority
          </button>
        )}
        {PRIORITIES.map(p => (
          <button
            key={p.value}
            onClick={() => { onFilterChange({ ...filters, priority: p.value }); setPriorityOpen(false); }}
            className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
            {p.label}
            {filters.priority === p.value && (
              <svg className="w-3 h-3 ml-auto text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
        ))}
      </Dropdown>

      {/* Assignee filter */}
      {members.length > 0 && (
        <Dropdown
          dropdownRef={assigneeRef}
          open={assigneeOpen}
          onToggle={() => { setAssigneeOpen(v => !v); setPriorityOpen(false); }}
          trigger={
            <>
              {activeAssignee
                ? <UserAvatar user={activeAssignee} size={14} />
                : <svg className="w-3.5 h-3.5 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
              }
              <span>{activeAssignee?.name ?? 'Assignee'}</span>
            </>
          }
        >
          {filters.assigneeId && (
            <button
              onClick={() => { onFilterChange({ ...filters, assigneeId: null }); setAssigneeOpen(false); }}
              className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              <span className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-600 flex-shrink-0" />
              Anyone
            </button>
          )}
          {members.map(m => (
            <button
              key={m.id}
              onClick={() => { onFilterChange({ ...filters, assigneeId: m.id }); setAssigneeOpen(false); }}
              className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              <UserAvatar user={m} size={16} className="flex-shrink-0" />
              {m.name}
              {filters.assigneeId === m.id && (
                <svg className="w-3 h-3 ml-auto text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          ))}
        </Dropdown>
      )}

      {/* Clear filters */}
      {hasActiveFilter && (
        <button
          onClick={() => { onFilterChange({ priority: null, assigneeId: null, search: '' }); onSearchChange(''); }}
          className="flex items-center gap-1 bg-white/15 hover:bg-white/25 text-white/80 hover:text-white text-xs rounded-full px-3 py-1.5 transition-colors"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          Clear
        </button>
      )}
    </div>
  );
}
