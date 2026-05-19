import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useBoardsStore } from '../store/boardsStore';
import Navbar from '../components/Navbar';
import CreateBoardModal from '../components/CreateBoardModal';

const BG_PREVIEW = {
  'gradient-1': 'linear-gradient(160deg,#1e3a5f,#1b6ca8)',
  'gradient-2': 'linear-gradient(160deg,#1a1a2e,#0f3460)',
  'gradient-3': 'linear-gradient(160deg,#3b0764,#6f0000)',
  'gradient-4': 'linear-gradient(160deg,#0f2027,#2c5364)',
  'gradient-5': 'linear-gradient(160deg,#2d3561,#4286f4)',
  'gradient-6': 'linear-gradient(160deg,#134e5e,#71b280)',
};

function BoardTile({ board, onClick }) {
  return (
    <button
      onClick={onClick}
      className="group text-left bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-md transition-all duration-300"
    >
      {/* Color strip */}
      <div
        className="h-[52px] w-full"
        style={{ background: BG_PREVIEW[board.background] || BG_PREVIEW['gradient-1'] }}
      />

      {/* Content */}
      <div className="px-4 py-3">
        <h3 className="font-semibold text-slate-800 dark:text-slate-200 text-sm truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
          {board.title}
        </h3>
        {board.description && (
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate">{board.description}</p>
        )}
        <div className="flex items-center gap-3 mt-3">
          <span className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2" />
            </svg>
            {board.cardCount}
          </span>
          <span className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0" />
            </svg>
            {board.memberCount}
          </span>
        </div>
      </div>
    </button>
  );
}

export default function Boards() {
  const { boards, loading, fetch: fetchBoards, add: addBoard } = useBoardsStore();
  const [showCreate, setShowCreate] = useState(false);
  const user = useAuthStore(s => s.user);
  const navigate = useNavigate();

  useEffect(() => { fetchBoards(); }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
      <Navbar />

      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'},{' '}
              {user?.name?.split(' ')[0]}
            </h1>
            <p className="text-slate-400 dark:text-slate-500 text-sm mt-0.5">
              {boards.length === 0 ? 'No boards yet' : `${boards.length} board${boards.length > 1 ? 's' : ''}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/my-tasks"
              className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              My Tasks
            </Link>
            {boards.some(b => b.created_by === user?.id) && (
              <Link
                to="/permissions"
                className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Permissions
              </Link>
            )}
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New board
            </button>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="rounded-xl overflow-hidden bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 animate-pulse">
                <div className="h-16 bg-slate-200 dark:bg-slate-700" />
                <div className="p-3 space-y-2">
                  <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
                  <div className="h-2.5 bg-slate-100 dark:bg-slate-600 rounded w-1/2" />
                  <div className="flex gap-3 pt-1">
                    <div className="h-2 bg-slate-100 dark:bg-slate-600 rounded w-10" />
                    <div className="h-2 bg-slate-100 dark:bg-slate-600 rounded w-10" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : boards.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-28 text-center">
            <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
              </svg>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">No boards yet</p>
            <p className="text-slate-400 dark:text-slate-500 text-xs mb-5">Create one to get started</p>
            <button
              onClick={() => setShowCreate(true)}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
            >
              Create your first board →
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {boards.map(board => (
              <BoardTile key={board.id} board={board} onClick={() => navigate(`/boards/${board.id}`)} />
            ))}
            <button
              onClick={() => setShowCreate(true)}
              className="h-full min-h-[120px] border border-dashed border-slate-200 dark:border-slate-700 rounded-xl flex flex-col items-center justify-center gap-2 text-slate-400 dark:text-slate-600 hover:text-indigo-500 dark:hover:text-indigo-400 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 transition-all"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
              </svg>
              <span className="text-xs font-medium">New board</span>
            </button>
          </div>
        )}
      </div>

      {showCreate && (
        <CreateBoardModal
          onClose={() => setShowCreate(false)}
          onCreated={board => {
            addBoard(board);
            setShowCreate(false);
            navigate(`/boards/${board.id}`);
          }}
        />
      )}
    </div>
  );
}
