import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../api';

const PRIORITY_COLORS = {
  low:    '#3b82f6',
  medium: '#f59e0b',
  high:   '#f97316',
  urgent: '#ef4444',
};

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function SearchModal({ onClose, onOpenCard }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const debouncedQuery = useDebounce(query, 300);

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Search when debounced query changes
  useEffect(() => {
    if (debouncedQuery.trim().length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api.get(`/search?q=${encodeURIComponent(debouncedQuery.trim())}`)
      .then(data => {
        if (!cancelled) {
          setResults(Array.isArray(data) ? data : (data?.results || []));
          setActiveIndex(0);
        }
      })
      .catch(() => {
        if (!cancelled) setResults([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [debouncedQuery]);

  // Scroll active result into view
  useEffect(() => {
    if (!listRef.current) return;
    const active = listRef.current.querySelector('[data-active="true"]');
    active?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const handleKeyDown = useCallback(
    e => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (results.length === 0) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex(i => Math.min(i + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex(i => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const r = results[activeIndex];
        if (r) {
          onOpenCard(r.card_id || r.id, r.board_id);
          onClose();
        }
      }
    },
    [results, activeIndex, onClose, onOpenCard]
  );

  function handleResultClick(result) {
    onOpenCard(result.card_id || result.id, result.board_id);
    onClose();
  }

  const showEmpty =
    debouncedQuery.trim().length >= 2 && !loading && results.length === 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] bg-black/50 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden border border-slate-200 dark:border-slate-700 animate-slide-up"
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-700">
          <svg
            className="w-4 h-4 text-gray-400 dark:text-slate-500 flex-shrink-0"
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
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search cards…"
            className="flex-1 text-sm text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 bg-transparent focus:outline-none"
          />
          {loading && (
            <svg
              className="w-4 h-4 text-indigo-500 animate-spin flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
            </svg>
          )}
          <kbd className="hidden sm:inline-flex items-center text-[10px] text-gray-400 dark:text-slate-500 bg-gray-100 dark:bg-slate-700 rounded px-1.5 py-0.5 font-mono">
            ESC
          </kbd>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <ul ref={listRef} className="max-h-80 overflow-y-auto py-1">
            {results.map((result, i) => {
              const priorityColor =
                result.priority && result.priority !== 'none'
                  ? PRIORITY_COLORS[result.priority]
                  : null;
              return (
                <li key={result.card_id || result.id}>
                  <button
                    data-active={i === activeIndex ? 'true' : 'false'}
                    onClick={() => handleResultClick(result)}
                    onMouseEnter={() => setActiveIndex(i)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      i === activeIndex
                        ? 'bg-indigo-50 dark:bg-indigo-950/40'
                        : 'hover:bg-gray-50 dark:hover:bg-slate-700/50'
                    }`}
                  >
                    {/* Priority dot */}
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0 mt-0.5"
                      style={{ background: priorityColor || '#cbd5e1' }}
                    />

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">
                        {result.title}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-slate-400 truncate">
                        {result.board_title && (
                          <span>{result.board_title}</span>
                        )}
                        {result.board_title && result.column_title && (
                          <span className="mx-1 text-gray-300 dark:text-slate-600">·</span>
                        )}
                        {result.column_title && (
                          <span>{result.column_title}</span>
                        )}
                      </p>
                    </div>

                    {i === activeIndex && (
                      <svg
                        className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {/* Empty state */}
        {showEmpty && (
          <div className="flex flex-col items-center justify-center py-10 text-center px-6">
            <svg
              className="w-8 h-8 text-gray-300 dark:text-slate-600 mb-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
              />
            </svg>
            <p className="text-sm text-gray-500 dark:text-slate-400">
              No results for <span className="font-medium text-gray-700 dark:text-slate-300">"{debouncedQuery}"</span>
            </p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
              Try a different search term
            </p>
          </div>
        )}

        {/* Idle hint */}
        {query.trim().length < 2 && !loading && (
          <div className="px-4 py-3 text-xs text-gray-400 dark:text-slate-500 flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="bg-gray-100 dark:bg-slate-700 rounded px-1 font-mono">↑↓</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="bg-gray-100 dark:bg-slate-700 rounded px-1 font-mono">↵</kbd>
              open
            </span>
            <span className="flex items-center gap-1">
              <kbd className="bg-gray-100 dark:bg-slate-700 rounded px-1 font-mono">ESC</kbd>
              close
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
