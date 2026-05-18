import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { boardsApi, columnsApi, cardsApi } from '../api';
import { useBoardPermissions } from '../hooks/useBoardPermissions';
import { useSocket } from '../hooks/useSocket';
import Navbar from '../components/Navbar';
import Column from '../components/Column';
import TaskCard from '../components/TaskCard';
import CardModal from '../components/CardModal';
import FilterBar from '../components/FilterBar';
import SearchModal from '../components/SearchModal';
import BoardSettingsModal from '../components/BoardSettingsModal';
import ListView from '../components/ListView';
import CalendarView from '../components/CalendarView';

function buildColumnsWithCards(columns, cards) {
  return columns.map(col => ({
    ...col,
    cards: cards
      .filter(c => c.column_id === col.id)
      .sort((a, b) => a.position - b.position),
  }));
}

function applyFilters(columns, filters) {
  if (!filters.priority && !filters.assigneeId && !filters.search) return columns;
  return columns.map(col => ({
    ...col,
    cards: col.cards.filter(card => {
      if (filters.priority && card.priority !== filters.priority) return false;
      if (filters.assigneeId && !card.assignees?.some(a => a.id === filters.assigneeId)) return false;
      if (filters.search && !card.title.toLowerCase().includes(filters.search.toLowerCase())) return false;
      return true;
    }),
  }));
}

export default function Board() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [board, setBoard] = useState(null);
  const [columns, setColumns] = useState([]);
  const [members, setMembers] = useState([]);
  const [rolePermissions, setRolePermissions] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeCard, setActiveCard] = useState(null);
  const [activeColumn, setActiveColumn] = useState(null);
  const [selectedCard, setSelectedCard] = useState(null);
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColTitle, setNewColTitle] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [filters, setFilters] = useState({ priority: null, assigneeId: null, search: '' });
  const [viewMode, setViewMode] = useState('board'); // 'board' | 'list' | 'calendar'

  const { can, role } = useBoardPermissions(members, rolePermissions);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  useEffect(() => {
    boardsApi.get(id)
      .then(data => {
        setBoard(data);
        setColumns(buildColumnsWithCards(data.columns, data.cards));
        setMembers(data.members);
        setRolePermissions(data.rolePermissions || {});
      })
      .catch(() => navigate('/'))
      .finally(() => setLoading(false));
  }, [id]);

  // Cmd+K / Ctrl+K to open search
  useEffect(() => {
    function handleKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch(true);
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // Real-time socket updates
  useSocket(id, {
    'card:created': (card) => {
      setColumns(prev =>
        prev.map(col =>
          col.id === card.column_id && !col.cards.some(c => c.id === card.id)
            ? { ...col, cards: [...col.cards, card] }
            : col
        )
      );
    },
    'card:updated': (card) => {
      setColumns(prev =>
        prev.map(col => ({
          ...col,
          cards: col.cards.map(c => c.id === card.id ? { ...c, ...card } : c),
        }))
      );
      setSelectedCard(prev => prev?.id === card.id ? { ...prev, ...card } : prev);
    },
    'card:moved': ({ cardId, destColumnId, columnOrders }) => {
      setColumns(prev => {
        const next = prev.map(c => ({ ...c, cards: [...c.cards] }));
        const srcCol = next.find(c => c.cards.some(card => card.id === cardId));
        const dstCol = next.find(c => c.id === destColumnId);
        if (!srcCol || !dstCol || srcCol.id === dstCol.id) return prev;
        const idx = srcCol.cards.findIndex(c => c.id === cardId);
        const [moved] = srcCol.cards.splice(idx, 1);
        moved.column_id = destColumnId;
        dstCol.cards.push(moved);
        return next;
      });
    },
    'card:deleted': ({ cardId }) => {
      setColumns(prev =>
        prev.map(col => ({ ...col, cards: col.cards.filter(c => c.id !== cardId) }))
      );
      setSelectedCard(prev => prev?.id === cardId ? null : prev);
    },
    'column:created': (column) => {
      setColumns(prev =>
        prev.some(c => c.id === column.id)
          ? prev
          : [...prev, { ...column, cards: [] }]
      );
    },
    'column:updated': (column) => {
      setColumns(prev =>
        prev.map(c => c.id === column.id ? { ...c, ...column } : c)
      );
    },
    'column:deleted': ({ columnId }) => {
      setColumns(prev => prev.filter(c => c.id !== columnId));
    },
  });

  function onDragStart({ active }) {
    if (active.data.current?.type === 'card') setActiveCard(active.data.current.card);
    if (active.data.current?.type === 'column') setActiveColumn(active.data.current.column);
  }

  function onDragOver({ active, over }) {
    if (!over || active.id === over.id) return;
    if (active.data.current?.type !== 'card') return;

    const isOverCard = over.data.current?.type === 'card';
    const isOverColumn = over.data.current?.type === 'column';

    setColumns(prev => {
      const next = prev.map(c => ({ ...c, cards: [...c.cards] }));

      const srcIdx = next.findIndex(c => c.cards.some(card => card.id === active.id));
      if (srcIdx === -1) return prev;

      let dstIdx;
      if (isOverCard) dstIdx = next.findIndex(c => c.cards.some(card => card.id === over.id));
      else if (isOverColumn) dstIdx = next.findIndex(c => c.id === over.id);
      if (dstIdx === -1) return prev;

      const cardIdx = next[srcIdx].cards.findIndex(c => c.id === active.id);
      const [moved] = next[srcIdx].cards.splice(cardIdx, 1);

      if (srcIdx !== dstIdx) moved.column_id = next[dstIdx].id;

      if (isOverCard) {
        const overIdx = next[dstIdx].cards.findIndex(c => c.id === over.id);
        next[dstIdx].cards.splice(overIdx, 0, moved);
      } else {
        next[dstIdx].cards.push(moved);
      }

      return next;
    });
  }

  function onDragEnd({ active, over }) {
    setActiveCard(null);
    setActiveColumn(null);

    if (!over) return;

    if (active.data.current?.type === 'column' && over.data.current?.type === 'column') {
      setColumns(prev => {
        const oldIdx = prev.findIndex(c => c.id === active.id);
        const newIdx = prev.findIndex(c => c.id === over.id);
        if (oldIdx === newIdx) return prev;
        const reordered = arrayMove(prev, oldIdx, newIdx);
        boardsApi.reorderColumns(id, reordered.map(c => c.id)).catch(console.error);
        return reordered;
      });
      return;
    }

    if (active.data.current?.type === 'card') {
      setColumns(prev => {
        const columnOrders = {};
        let destColId = null;

        for (const col of prev) {
          const idx = col.cards.findIndex(c => c.id === active.id);
          if (idx !== -1) {
            destColId = col.id;
            columnOrders[col.id] = col.cards.map(c => c.id);
          }
        }

        const sourceColId = active.data.current?.card?.column_id;
        if (sourceColId && sourceColId !== destColId) {
          const srcCol = prev.find(c => c.id === sourceColId);
          if (srcCol) columnOrders[sourceColId] = srcCol.cards.map(c => c.id);
        }

        if (destColId) {
          cardsApi.move({ cardId: active.id, destColumnId: destColId, columnOrders }).catch(console.error);
        }
        return prev;
      });
    }
  }

  function handleCardUpdated(updated) {
    setColumns(prev =>
      prev.map(col => ({
        ...col,
        cards: col.cards.map(c => c.id === updated.id ? updated : c),
      }))
    );
    if (selectedCard?.id === updated.id) setSelectedCard(updated);
  }

  function handleCardDeleted(cardId) {
    setColumns(prev =>
      prev.map(col => ({ ...col, cards: col.cards.filter(c => c.id !== cardId) }))
    );
  }

  function handleCardCreated(columnId, card) {
    setColumns(prev =>
      prev.map(col => col.id === columnId ? { ...col, cards: [...col.cards, card] } : col)
    );
  }

  async function handleColumnUpdated(colId, data) {
    const updated = await columnsApi.update(colId, data);
    setColumns(prev => prev.map(c => c.id === colId ? { ...c, ...updated } : c));
  }

  async function handleColumnDeleted(colId) {
    if (!confirm('Delete this column and all its cards?')) return;
    await columnsApi.delete(colId);
    setColumns(prev => prev.filter(c => c.id !== colId));
  }

  async function handleAddColumn(e) {
    e.preventDefault();
    if (!newColTitle.trim()) return;
    const col = await boardsApi.createColumn(id, { title: newColTitle.trim() });
    setColumns(prev => [...prev, { ...col, cards: [] }]);
    setNewColTitle('');
    setAddingColumn(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-1 flex items-center justify-center">
        <div className="text-white text-sm animate-pulse">Loading board…</div>
      </div>
    );
  }

  const columnIds = columns.map(c => c.id);
  const displayColumns = applyFilters(columns, filters);
  const hasActiveFilter = !!(filters.priority || filters.assigneeId || filters.search);

  return (
    <div className={`min-h-screen flex flex-col bg-${board?.background || 'gradient-1'}`}>
      <Navbar
        title={board?.title}
        boardBackground={board?.background}
        boardId={id}
        canManageBoard={can.manageBoard}
        onSettingsClick={() => setShowSettings(true)}
        onSearchClick={() => setShowSearch(true)}
      />

      <FilterBar
        members={members}
        filters={filters}
        onFilterChange={setFilters}
        onSearchChange={v => setFilters(f => ({ ...f, search: v }))}
      />

      {/* View switcher */}
      <div className="flex items-center gap-1 px-4 pb-2">
        {[
          { key: 'board', label: 'Board', icon: 'M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7' },
          { key: 'list', label: 'List', icon: 'M4 6h16M4 10h16M4 14h16M4 18h16' },
          { key: 'calendar', label: 'Calendar', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
        ].map(v => (
          <button
            key={v.key}
            onClick={() => setViewMode(v.key)}
            className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors ${
              viewMode === v.key
                ? 'bg-white/30 text-white'
                : 'text-white/60 hover:text-white hover:bg-white/15'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={v.icon} />
            </svg>
            {v.label}
          </button>
        ))}
      </div>

      {viewMode === 'list' && (
        <div className="flex-1 overflow-auto bg-white/10 dark:bg-black/10">
          <ListView columns={displayColumns} onCardClick={setSelectedCard} />
        </div>
      )}

      {viewMode === 'calendar' && (
        <div className="flex-1 overflow-auto bg-white/10 dark:bg-black/10">
          <div className="max-w-6xl mx-auto p-6">
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
              <CalendarView
                cards={displayColumns.flatMap(c => c.cards)}
                onCardClick={setSelectedCard}
              />
            </div>
          </div>
        </div>
      )}

      {viewMode === 'board' && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
        >
          <div className="board-scroll">
            <SortableContext items={columnIds} strategy={horizontalListSortingStrategy}>
              {displayColumns.map(col => (
                <Column
                  key={col.id}
                  column={col}
                  can={can}
                  onCardClick={setSelectedCard}
                  onCardCreated={handleCardCreated}
                  onColumnUpdated={handleColumnUpdated}
                  onColumnDeleted={handleColumnDeleted}
                />
              ))}
            </SortableContext>

            {can.manageColumns && (
              <div className="flex-shrink-0 w-72">
                {addingColumn ? (
                  <form
                    onSubmit={handleAddColumn}
                    className="bg-white/90 backdrop-blur-sm rounded-xl p-3 shadow-md"
                  >
                    <input
                      autoFocus
                      value={newColTitle}
                      onChange={e => setNewColTitle(e.target.value)}
                      placeholder="Column title…"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-2"
                      onKeyDown={e => { if (e.key === 'Escape') { setAddingColumn(false); setNewColTitle(''); } }}
                    />
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={!newColTitle.trim()}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium py-1.5 rounded-lg transition-colors"
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        onClick={() => { setAddingColumn(false); setNewColTitle(''); }}
                        className="px-3 text-gray-500 hover:text-gray-700 hover:bg-gray-100 text-sm rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    onClick={() => setAddingColumn(true)}
                    className="w-full flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white font-medium px-4 py-3 rounded-xl transition-colors backdrop-blur-sm"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add column
                  </button>
                )}
              </div>
            )}
          </div>

          <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
            {activeCard && <TaskCard card={activeCard} isDragOverlay />}
            {activeColumn && <Column column={activeColumn} can={can} isDragOverlay onCardClick={() => {}} onCardCreated={() => {}} onColumnUpdated={() => {}} onColumnDeleted={() => {}} />}
          </DragOverlay>
        </DndContext>
      )}

      {selectedCard && (
        <CardModal
          card={selectedCard}
          boardMembers={members}
          columns={columns}
          can={can}
          onClose={() => setSelectedCard(null)}
          onUpdated={handleCardUpdated}
          onDeleted={handleCardDeleted}
          onMoveToColumn={(cardId, destColId) => {
            setColumns(prev => {
              const next = prev.map(c => ({ ...c, cards: [...c.cards] }));
              const srcCol = next.find(c => c.cards.some(card => card.id === cardId));
              const dstCol = next.find(c => c.id === destColId);
              if (!srcCol || !dstCol || srcCol.id === dstCol.id) return prev;
              const idx = srcCol.cards.findIndex(c => c.id === cardId);
              const [moved] = srcCol.cards.splice(idx, 1);
              moved.column_id = destColId;
              dstCol.cards.push(moved);
              const columnOrders = {
                [srcCol.id]: srcCol.cards.map(c => c.id),
                [dstCol.id]: dstCol.cards.map(c => c.id),
              };
              cardsApi.move({ cardId, destColumnId: destColId, columnOrders }).catch(console.error);
              setSelectedCard(c => c ? { ...c, column_id: destColId } : c);
              return next;
            });
          }}
        />
      )}

      {showSettings && (
        <BoardSettingsModal
          board={board}
          members={members}
          currentUserRole={role}
          onClose={() => setShowSettings(false)}
          onUpdated={updated => { setBoard(updated); setShowSettings(false); }}
          onMembersChanged={setMembers}
        />
      )}

      {showSearch && (
        <SearchModal
          onClose={() => setShowSearch(false)}
          onOpenCard={(cardId, boardId) => {
            setShowSearch(false);
            if (boardId !== id) {
              navigate(`/boards/${boardId}`);
            } else {
              const card = columns.flatMap(c => c.cards).find(c => c.id === cardId);
              if (card) setSelectedCard(card);
            }
          }}
        />
      )}
    </div>
  );
}
