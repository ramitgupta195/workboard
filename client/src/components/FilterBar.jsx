import UserAvatar from './UserAvatar';

const PRIORITIES = [
  { value: 'low',    label: 'Low',    color: '#3b82f6' },
  { value: 'medium', label: 'Medium', color: '#f59e0b' },
  { value: 'high',   label: 'High',   color: '#f97316' },
  { value: 'urgent', label: 'Urgent', color: '#ef4444' },
];

export default function FilterBar({ members = [], filters, onFilterChange, onSearchChange }) {
  const hasActiveFilter =
    filters.priority || filters.assigneeId || filters.search;

  function clearFilters() {
    onFilterChange({ priority: null, assigneeId: null, search: '' });
    onSearchChange('');
  }

  function handlePriorityChange(e) {
    onFilterChange({ ...filters, priority: e.target.value || null });
  }

  function handleAssigneeChange(e) {
    onFilterChange({ ...filters, assigneeId: e.target.value || null });
  }

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-black/10 backdrop-blur-sm">
      {/* Search */}
      <div className="relative">
        <div className="absolute inset-y-0 left-2.5 flex items-center pointer-events-none">
          <svg
            className="w-3.5 h-3.5 text-white/60"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
            />
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
      <div className="relative">
        <select
          value={filters.priority || ''}
          onChange={handlePriorityChange}
          className="appearance-none bg-white/15 hover:bg-white/20 text-white text-xs rounded-full pl-7 pr-6 py-1.5 focus:outline-none focus:ring-1 focus:ring-white/40 transition-colors cursor-pointer"
          style={{ colorScheme: 'dark' }}
        >
          <option value="">Priority</option>
          {PRIORITIES.map(p => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        {/* Priority dot indicator */}
        <div className="absolute inset-y-0 left-2.5 flex items-center pointer-events-none">
          {filters.priority ? (
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{
                background:
                  PRIORITIES.find(p => p.value === filters.priority)?.color ||
                  'rgba(255,255,255,0.5)',
              }}
            />
          ) : (
            <svg
              className="w-3.5 h-3.5 text-white/60"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 4h13M3 8h9M3 12h5"
              />
            </svg>
          )}
        </div>
        {/* Dropdown chevron */}
        <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none">
          <svg className="w-3 h-3 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Assignee filter */}
      {members.length > 0 && (
        <div className="relative">
          <select
            value={filters.assigneeId || ''}
            onChange={handleAssigneeChange}
            className="appearance-none bg-white/15 hover:bg-white/20 text-white text-xs rounded-full pl-7 pr-6 py-1.5 focus:outline-none focus:ring-1 focus:ring-white/40 transition-colors cursor-pointer"
            style={{ colorScheme: 'dark' }}
          >
            <option value="">Assignee</option>
            {members.map(m => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          {/* Avatar / person icon */}
          <div className="absolute inset-y-0 left-2.5 flex items-center pointer-events-none">
            {filters.assigneeId ? (
              <UserAvatar
                user={members.find(m => m.id === filters.assigneeId)}
                size={16}
              />
            ) : (
              <svg
                className="w-3.5 h-3.5 text-white/60"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            )}
          </div>
          <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none">
            <svg className="w-3 h-3 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      )}

      {/* Clear filters */}
      {hasActiveFilter && (
        <button
          onClick={clearFilters}
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
