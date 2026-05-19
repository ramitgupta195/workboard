import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import UserAvatar from '../components/UserAvatar';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const BG_PREVIEW = {
  'gradient-1': 'linear-gradient(135deg,#1e3a5f,#1b6ca8)',
  'gradient-2': 'linear-gradient(135deg,#1a1a2e,#0f3460)',
  'gradient-3': 'linear-gradient(135deg,#3b0764,#6f0000)',
  'gradient-4': 'linear-gradient(135deg,#0f2027,#2c5364)',
  'gradient-5': 'linear-gradient(135deg,#2d3561,#4286f4)',
  'gradient-6': 'linear-gradient(135deg,#134e5e,#71b280)',
};

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

function FileIcon({ mimetype }) {
  const isImage = mimetype?.startsWith('image/');
  const isPdf = mimetype === 'application/pdf';
  const isDoc = mimetype?.includes('word') || mimetype?.includes('document');
  const isSheet = mimetype?.includes('sheet') || mimetype?.includes('excel') || mimetype?.includes('csv');
  const isVideo = mimetype?.startsWith('video/');

  if (isImage) return (
    <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center flex-shrink-0">
      <svg className="w-4 h-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    </div>
  );
  if (isPdf) return (
    <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/40 flex items-center justify-center flex-shrink-0">
      <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    </div>
  );
  if (isDoc) return (
    <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0">
      <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    </div>
  );
  if (isSheet) return (
    <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center flex-shrink-0">
      <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18M10 3v18M6 3h12a1 1 0 011 1v16a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1z" />
      </svg>
    </div>
  );
  if (isVideo) return (
    <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center flex-shrink-0">
      <svg className="w-4 h-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
      </svg>
    </div>
  );
  return (
    <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
      <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    </div>
  );
}

function PreviewModal({ file, onClose, downloadUrl }) {
  const isImage = file.mimetype?.startsWith('image/');
  const isPdf = file.mimetype === 'application/pdf';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-4xl w-full mx-4 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <FileIcon mimetype={file.mimetype} />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{file.name}</p>
              <p className="text-xs text-slate-400">{formatSize(file.size)} · {file.uploadedBy}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 ml-4">
            <a
              href={downloadUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download
            </a>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <div className="p-5 max-h-[70vh] overflow-auto flex items-center justify-center bg-slate-50 dark:bg-slate-950">
          {isImage ? (
            <img src={downloadUrl} alt={file.name} className="max-w-full max-h-[60vh] rounded-lg object-contain" />
          ) : isPdf ? (
            <iframe src={downloadUrl} title={file.name} className="w-full h-[60vh] rounded-lg border-0" />
          ) : (
            <div className="text-center py-12">
              <FileIcon mimetype={file.mimetype} />
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Preview not available for this file type.</p>
              <a
                href={downloadUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Download to view
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function FileExplorer() {
  const [boards, setBoards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBoard, setSelectedBoard] = useState(null);
  const [expandedCards, setExpandedCards] = useState({});
  const [preview, setPreview] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [search, setSearch] = useState('');

  const token = localStorage.getItem('wb_token');
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetch(`${API}/api/file-explorer`, { headers })
      .then(r => r.json())
      .then(data => {
        setBoards(data);
        if (data.length > 0) setSelectedBoard(data[0]);
      })
      .finally(() => setLoading(false));
  }, []);

  async function handlePreview(file) {
    setPreview(file);
    const res = await fetch(`${API}/api/file-explorer/download/${file.id}`, { headers, redirect: 'follow' });
    setPreviewUrl(res.url);
  }

  async function handleDelete(file, boardCanDelete) {
    if (!boardCanDelete) return;
    if (!confirm(`Delete "${file.name}"? This cannot be undone.`)) return;
    setDeleting(file.id);
    try {
      await fetch(`${API}/api/file-explorer/${file.id}`, { method: 'DELETE', headers });
      setBoards(prev => prev.map(b => ({
        ...b,
        cards: b.cards.map(c => ({ ...c, files: c.files.filter(f => f.id !== file.id) }))
          .filter(c => c.files.length > 0),
        fileCount: b.fileCount - 1,
      })));
      if (selectedBoard) {
        setSelectedBoard(prev => prev ? {
          ...prev,
          cards: prev.cards.map(c => ({ ...c, files: c.files.filter(f => f.id !== file.id) }))
            .filter(c => c.files.length > 0),
        } : prev);
      }
    } finally {
      setDeleting(null);
    }
  }

  function toggleCard(cardId) {
    setExpandedCards(prev => ({ ...prev, [cardId]: !prev[cardId] }));
  }

  const filteredCards = selectedBoard?.cards.map(card => ({
    ...card,
    files: card.files.filter(f => f.name.toLowerCase().includes(search.toLowerCase())),
  })).filter(card => card.files.length > 0) ?? [];

  const totalFiles = selectedBoard?.cards.reduce((sum, c) => sum + c.files.length, 0) ?? 0;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      <Navbar />

      <div className="flex flex-1 overflow-hidden" style={{ height: 'calc(100vh - 52px)' }}>

        {/* Sidebar */}
        <aside className="w-60 flex-shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col overflow-y-auto">
          <div className="px-4 pt-5 pb-3">
            <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Boards</p>
          </div>
          {loading ? (
            <div className="px-4 space-y-2">
              {[1,2,3].map(i => <div key={i} className="h-9 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />)}
            </div>
          ) : boards.length === 0 ? (
            <p className="px-4 text-xs text-slate-400 dark:text-slate-500">No files accessible.</p>
          ) : (
            <nav className="flex flex-col gap-0.5 px-2 pb-4">
              {boards.map(board => {
                const active = selectedBoard?.id === board.id;
                return (
                  <button
                    key={board.id}
                    onClick={() => { setSelectedBoard(board); setSearch(''); setExpandedCards({}); }}
                    className={`flex items-center gap-2.5 w-full text-left px-3 py-2.5 rounded-lg transition-colors ${
                      active
                        ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="w-5 h-5 rounded-md flex-shrink-0" style={{ background: BG_PREVIEW[board.background] || BG_PREVIEW['gradient-1'] }} />
                    <span className="text-xs font-medium truncate flex-1">{board.title}</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 flex-shrink-0">{board.fileCount}</span>
                  </button>
                );
              })}
            </nav>
          )}
        </aside>

        {/* Main */}
        <main className="flex-1 overflow-y-auto">
          {!selectedBoard ? (
            <div className="flex items-center justify-center h-full text-slate-400 dark:text-slate-600 text-sm">
              {loading ? 'Loading…' : 'Select a board to browse files'}
            </div>
          ) : (
            <div className="max-w-4xl mx-auto px-8 py-8">

              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg flex-shrink-0" style={{ background: BG_PREVIEW[selectedBoard.background] || BG_PREVIEW['gradient-1'] }} />
                  <div>
                    <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">{selectedBoard.title}</h1>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {totalFiles} file{totalFiles !== 1 ? 's' : ''} across {selectedBoard.cards.length} card{selectedBoard.cards.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>

                <div className="relative">
                  <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search files…"
                    className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 w-48"
                  />
                </div>
              </div>

              {/* File tree */}
              {filteredCards.length === 0 ? (
                <div className="text-center py-16 text-slate-400 dark:text-slate-600">
                  <svg className="w-10 h-10 mx-auto mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  <p className="text-sm">No files found</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredCards.map(card => {
                    const expanded = expandedCards[card.id] !== false; // default open
                    return (
                      <div key={card.id} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                        {/* Card folder header */}
                        <button
                          onClick={() => toggleCard(card.id)}
                          className="flex items-center gap-2.5 w-full px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-left"
                        >
                          <svg className={`w-3.5 h-3.5 text-slate-400 flex-shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                          <svg className="w-4 h-4 text-amber-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                          </svg>
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300 flex-1 truncate">{card.title}</span>
                          <span className="text-xs text-slate-400 dark:text-slate-500 flex-shrink-0">{card.files.length} file{card.files.length !== 1 ? 's' : ''}</span>
                        </button>

                        {/* Files list */}
                        {expanded && (
                          <div className="border-t border-slate-100 dark:border-slate-800 divide-y divide-slate-50 dark:divide-slate-800/60">
                            {card.files.map(file => (
                              <div
                                key={file.id}
                                className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors group"
                              >
                                <div className="pl-6 flex-shrink-0">
                                  <FileIcon mimetype={file.mimetype} />
                                </div>

                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{file.name}</p>
                                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                                    {formatSize(file.size)} · {file.uploadedBy} · {timeAgo(file.uploadedAt)}
                                  </p>
                                </div>

                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                  <button
                                    onClick={() => handlePreview(file)}
                                    title="Preview"
                                    className="p-1.5 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 rounded-lg transition-colors"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                  </button>
                                  <a
                                    href={`${API}/api/file-explorer/download/${file.id}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    title="Download"
                                    className="p-1.5 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-lg transition-colors"
                                    onClick={async e => {
                                      e.preventDefault();
                                      const res = await fetch(`${API}/api/file-explorer/download/${file.id}`, { headers, redirect: 'follow' });
                                      const a = document.createElement('a');
                                      a.href = res.url;
                                      a.download = file.name;
                                      a.click();
                                    }}
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                  </a>
                                  {selectedBoard.canDelete && (
                                    <button
                                      onClick={() => handleDelete(file, selectedBoard.canDelete)}
                                      disabled={deleting === file.id}
                                      title="Delete"
                                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors disabled:opacity-50"
                                    >
                                      {deleting === file.id ? (
                                        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                        </svg>
                                      ) : (
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                      )}
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {preview && previewUrl && (
        <PreviewModal
          file={preview}
          downloadUrl={previewUrl}
          onClose={() => { setPreview(null); setPreviewUrl(null); }}
        />
      )}
    </div>
  );
}
