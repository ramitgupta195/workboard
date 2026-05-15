import { useState, useEffect } from 'react';
import { boardsApi } from '../api';

const TRIGGERS = [
  { value: 'card_moved',       label: 'Card is moved to a column' },
  { value: 'card_created',     label: 'Card is created in a column' },
  { value: 'priority_changed', label: 'Card priority is changed to' },
  { value: 'due_date_passed',  label: 'Card due date passes' },
  { value: 'card_idle',        label: 'Card is idle for N days' },
];

const ACTIONS = [
  { value: 'move_to_column',     label: 'Move card to column' },
  { value: 'set_priority',       label: 'Set priority to' },
  { value: 'assign_user',        label: 'Assign to member' },
  { value: 'set_due_date',       label: 'Set due date to N days from now' },
  { value: 'add_label',          label: 'Add label' },
  { value: 'create_card_in_board', label: '🔀 Hand off to another board' },
];

const PRIORITIES = ['none','low','medium','high','urgent'];
const LABEL_COLORS = ['#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#8b5cf6','#ec4899','#14b8a6'];

export default function RuleBuilder({ columns, members, allBoards = [], currentBoardId, initial, onSave, onClose }) {
  const [name, setName] = useState(initial?.name || '');
  const [triggerType, setTriggerType] = useState(initial?.trigger_type || 'card_moved');
  const [triggerConfig, setTriggerConfig] = useState(initial?.trigger_config || { to_column_id: 'any' });
  const [actionType, setActionType] = useState(initial?.action_type || 'set_priority');
  const [actionConfig, setActionConfig] = useState(initial?.action_config || { priority: 'high' });
  const [saving, setSaving] = useState(false);
  const [targetBoardCols, setTargetBoardCols] = useState([]);

  const otherBoards = allBoards.filter(b => b.id !== currentBoardId);

  useEffect(() => {
    if (actionType === 'create_card_in_board' && actionConfig.board_id) {
      boardsApi.get(actionConfig.board_id).then(b => {
        setTargetBoardCols(b.columns || []);
        if (!actionConfig.column_id && b.columns?.length) {
          setAC('column_id', b.columns[0].id);
        }
      }).catch(() => setTargetBoardCols([]));
    }
  }, [actionConfig.board_id, actionType]);

  function setTC(key, val) { setTriggerConfig(c => ({ ...c, [key]: val })); }
  function setAC(key, val) { setActionConfig(c => ({ ...c, [key]: val })); }

  function onTriggerTypeChange(val) {
    setTriggerType(val);
    switch (val) {
      case 'card_moved':     setTriggerConfig({ to_column_id: 'any' }); break;
      case 'card_created':   setTriggerConfig({ in_column_id: 'any' }); break;
      case 'priority_changed': setTriggerConfig({ to_priority: 'urgent' }); break;
      case 'due_date_passed':  setTriggerConfig({}); break;
      case 'card_idle':        setTriggerConfig({ days: 3 }); break;
    }
  }

  function onActionTypeChange(val) {
    setActionType(val);
    switch (val) {
      case 'move_to_column': setActionConfig({ column_id: columns[0]?.id || '' }); break;
      case 'set_priority':   setActionConfig({ priority: 'high' }); break;
      case 'assign_user':    setActionConfig({ user_id: members[0]?.id || '' }); break;
      case 'set_due_date':   setActionConfig({ days_from_now: 3 }); break;
      case 'add_label':      setActionConfig({ name: '', color: LABEL_COLORS[0] }); break;
      case 'create_card_in_board': setActionConfig({ board_id: otherBoards[0]?.id || '', column_id: '' }); break;
    }
  }

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({ name: name.trim(), trigger_type: triggerType, trigger_config: triggerConfig, action_type: actionType, action_config: actionConfig });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg p-6 animate-slide-up">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">{initial ? 'Edit rule' : 'New automation rule'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-5">
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Rule name</label>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Flag urgent deals"
              className="w-full border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Trigger */}
          <div className="bg-amber-50 dark:bg-amber-950/25 border border-amber-200 dark:border-amber-900/40 rounded-xl p-4">
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-3">⚡ When (trigger)</p>

            <select
              value={triggerType}
              onChange={e => onTriggerTypeChange(e.target.value)}
              className="w-full border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-3 bg-white"
            >
              {TRIGGERS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>

            {/* Trigger config */}
            {triggerType === 'card_moved' && (
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">To column</label>
                  <select value={triggerConfig.to_column_id || 'any'} onChange={e => setTC('to_column_id', e.target.value)} className="w-full border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                    <option value="any">Any column</option>
                    {columns.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">From column (optional)</label>
                  <select value={triggerConfig.from_column_id || 'any'} onChange={e => setTC('from_column_id', e.target.value)} className="w-full border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                    <option value="any">Any column</option>
                    {columns.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                  </select>
                </div>
              </div>
            )}

            {triggerType === 'card_created' && (
              <div>
                <label className="text-xs text-gray-500 mb-1 block">In column</label>
                <select value={triggerConfig.in_column_id || 'any'} onChange={e => setTC('in_column_id', e.target.value)} className="w-full border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                  <option value="any">Any column</option>
                  {columns.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
              </div>
            )}

            {triggerType === 'priority_changed' && (
              <div>
                <label className="text-xs text-gray-500 mb-1 block">To priority</label>
                <select value={triggerConfig.to_priority || 'any'} onChange={e => setTC('to_priority', e.target.value)} className="w-full border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                  <option value="any">Any priority</option>
                  {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                </select>
              </div>
            )}

            {triggerType === 'card_idle' && (
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Idle for (days)</label>
                <input type="number" min={1} max={90} value={triggerConfig.days || 3} onChange={e => setTC('days', parseInt(e.target.value))} className="w-full border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            )}

            {triggerType === 'due_date_passed' && (
              <p className="text-xs text-amber-600 italic">Fires once per day for each card whose due date has passed.</p>
            )}
          </div>

          {/* Action */}
          <div className="bg-indigo-50 dark:bg-indigo-950/25 border border-indigo-200 dark:border-indigo-900/40 rounded-xl p-4">
            <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide mb-3">→ Then (action)</p>

            <select
              value={actionType}
              onChange={e => onActionTypeChange(e.target.value)}
              className="w-full border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-3 bg-white"
            >
              {ACTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>

            {/* Action config */}
            {actionType === 'move_to_column' && (
              <select value={actionConfig.column_id || ''} onChange={e => setAC('column_id', e.target.value)} className="w-full border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                {columns.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            )}

            {actionType === 'set_priority' && (
              <select value={actionConfig.priority || 'high'} onChange={e => setAC('priority', e.target.value)} className="w-full border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
              </select>
            )}

            {actionType === 'assign_user' && (
              <select value={actionConfig.user_id || ''} onChange={e => setAC('user_id', e.target.value)} className="w-full border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            )}

            {actionType === 'set_due_date' && (
              <div className="flex items-center gap-2">
                <input type="number" min={0} max={365} value={actionConfig.days_from_now || 3} onChange={e => setAC('days_from_now', parseInt(e.target.value))} className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <span className="text-sm text-gray-500">days from now</span>
              </div>
            )}

            {actionType === 'add_label' && (
              <div className="space-y-2">
                <input value={actionConfig.name || ''} onChange={e => setAC('name', e.target.value)} placeholder="Label name" className="w-full border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <div className="flex flex-wrap gap-1.5">
                  {LABEL_COLORS.map(c => (
                    <button key={c} type="button" onClick={() => setAC('color', c)}
                      className={`w-6 h-6 rounded-full transition-transform ${actionConfig.color === c ? 'scale-125 ring-2 ring-offset-1 ring-gray-400' : ''}`}
                      style={{ background: c }} />
                  ))}
                </div>
              </div>
            )}

            {actionType === 'create_card_in_board' && (
              <div className="space-y-3">
                {otherBoards.length === 0 ? (
                  <p className="text-xs text-indigo-500 italic">No other boards found. Create another board first.</p>
                ) : (
                  <>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Target board</label>
                      <select
                        value={actionConfig.board_id || ''}
                        onChange={e => { setAC('board_id', e.target.value); setAC('column_id', ''); }}
                        className="w-full border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                      >
                        <option value="">Select board…</option>
                        {otherBoards.map(b => <option key={b.id} value={b.id}>{b.title}</option>)}
                      </select>
                    </div>
                    {targetBoardCols.length > 0 && (
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Drop into column</label>
                        <select
                          value={actionConfig.column_id || ''}
                          onChange={e => setAC('column_id', e.target.value)}
                          className="w-full border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                        >
                          {targetBoardCols.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                        </select>
                      </div>
                    )}
                    <p className="text-xs text-indigo-500">A copy of the card (same title) will be created in the target board.</p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 font-medium py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors text-sm">Cancel</button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || saving}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium py-2 rounded-lg transition-colors text-sm"
          >
            {saving ? 'Saving…' : initial ? 'Save changes' : 'Create rule'}
          </button>
        </div>
      </div>
    </div>
  );
}
