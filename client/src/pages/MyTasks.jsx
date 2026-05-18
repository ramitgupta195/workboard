import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { myTasksApi } from '../api';
import Navbar from '../components/Navbar';
import UserAvatar from '../components/UserAvatar';
import { useAuthStore } from '../store/authStore';

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
  if (!priority || priority === 'none') return null;
  const color = PRIORITY_COLORS[priority] || PRIORITY_COLORS.none;
  const iconPath = PRIORITY_ICONS[priority];
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded" style={{ color, background: color + '18' }}>
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d={iconPath} />
      </svg>
      <span className="capitalize">{priority}</span>
    </span>
  );
}

export default function MyTasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const user = useAuthStore(s => s.user);
  const navigate = useNavigate();

  useEffect(() => {
    myTasksApi.list().then(setTasks).finally(() => setLoading(false));
  }, []);

  // Group tasks by board
  const grouped = tasks.reduce((acc, task) => {
    const key = task.board_id;
    if (!acc[key]) acc[key] = { board_id: task.board_id, board_title: task.board_title, tasks: [] };
    acc[key].tasks.push(task);
    return acc;
  }, {});

  const groups = Object.values(grouped);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
      <Navbar />
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">My Tasks</h1>
            <p className="text-slate-400 dark:text-slate-500 text-sm mt-0.5">
              Cards assigned to you across all boards
            </p>
          </div>
          <Link
            to="/"
            className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
            </svg>
            All boards
          </Link>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
            ))}
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-28 text-center">
            <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">No tasks assigned to you</p>
            <p className="text-slate-400 dark:text-slate-500 text-xs">When someone assigns you a card, it will appear here</p>
          </div>
        ) : (
          <div className="space-y-8">
            {groups.map(group => (
              <div key={group.board_id}>
                <div className="flex items-center gap-2 mb-3">
                  <Link
                    to={`/boards/${group.board_id}`}
                    className="text-sm font-semibold text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                  >
                    {group.board_title}
                  </Link>
                  <span className="text-[11px] text-slate-400 bg-slate-100 dark:bg-slate-700 dark:text-slate-500 rounded px-1.5 py-0.5">
                    {group.tasks.length}
                  </span>
                  <Link
                    to={`/boards/${group.board_id}`}
                    className="text-[11px] text-indigo-500 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors ml-1"
                  >
                    Open board →
                  </Link>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700 shadow-sm overflow-hidden">
                  {group.tasks.map(task => {
                    const isOverdue = task.due_date && new Date(task.due_date) < new Date();
                    const formattedDate = task.due_date
                      ? new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                      : null;
                    return (
                      <button
                        key={task.id}
                        onClick={() => navigate(`/boards/${task.board_id}`)}
                        className="w-full flex items-center gap-4 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{task.title}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <PriorityBadge priority={task.priority} />
                          {task.column_title && (
                            <span
                              className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                              style={{
                                background: (task.column_color || '#94a3b8') + '18',
                                color: task.column_color || '#94a3b8',
                              }}
                            >
                              {task.column_title}
                            </span>
                          )}
                          {formattedDate && (
                            <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded ${
                              isOverdue ? 'bg-red-50 text-red-500 dark:bg-red-950/40 dark:text-red-400' : 'text-slate-400 dark:text-slate-500'
                            }`}>
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              {formattedDate}
                            </span>
                          )}
                          {task.assignees?.length > 0 && (
                            <div className="flex -space-x-1.5">
                              {task.assignees.slice(0, 3).map(u => (
                                <UserAvatar key={u.id} user={u} size={20} className="ring-1 ring-white dark:ring-slate-800" />
                              ))}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
