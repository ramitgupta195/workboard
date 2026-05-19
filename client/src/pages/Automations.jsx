import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { boardsApi, automationsApi } from '../api';
import { useBoardsStore } from '../store/boardsStore';
import Navbar from '../components/Navbar';
import RuleBuilder from '../components/RuleBuilder';

const TRIGGER_LABELS = {
  card_moved:       'Card moved to column',
  card_created:     'Card created in column',
  priority_changed: 'Priority changed',
  due_date_passed:  'Due date passes',
  card_idle:        'Card idle',
};

const ACTION_LABELS = {
  move_to_column: 'Move to column',
  set_priority:   'Set priority',
  assign_user:    'Assign to member',
  set_due_date:   'Set due date',
  add_label:      'Add label',
};

const PRIORITY_COLORS = { none:'#94a3b8', low:'#3b82f6', medium:'#f59e0b', high:'#f97316', urgent:'#ef4444' };

function describeTrigger(rule, columns) {
  const cfg = rule.trigger_config || {};
  switch (rule.trigger_type) {
    case 'card_moved': {
      const to = cfg.to_column_id === 'any' ? 'any column' : (columns.find(c => c.id === cfg.to_column_id)?.title || cfg.to_column_id);
      return `Card moves to "${to}"`;
    }
    case 'card_created': {
      const col = cfg.in_column_id === 'any' ? 'any column' : (columns.find(c => c.id === cfg.in_column_id)?.title || cfg.in_column_id);
      return `Card created in "${col}"`;
    }
    case 'priority_changed':
      return `Priority changed to "${cfg.to_priority || 'any'}"`;
    case 'due_date_passed':
      return 'Card due date passes';
    case 'card_idle':
      return `Card idle for ${cfg.days || 3} days`;
    default:
      return rule.trigger_type;
  }
}

function describeAction(rule, columns, members) {
  const cfg = rule.action_config || {};
  switch (rule.action_type) {
    case 'move_to_column': {
      const col = columns.find(c => c.id === cfg.column_id)?.title || cfg.column_id;
      return `Move to "${col}"`;
    }
    case 'set_priority':
      return `Set priority → ${cfg.priority}`;
    case 'assign_user': {
      const user = members.find(m => m.id === cfg.user_id)?.name || 'member';
      return `Assign to ${user}`;
    }
    case 'set_due_date':
      return `Set due date ${cfg.days_from_now} days from now`;
    case 'add_label':
      return `Add label "${cfg.name}"`;
    default:
      return rule.action_type;
  }
}

function RuleCard({ rule, columns, members, onToggle, onEdit, onDelete }) {
  return (
    <div className={`bg-white dark:bg-slate-800 rounded-xl border p-4 transition-opacity ${rule.is_active ? 'border-gray-200 dark:border-slate-700' : 'border-gray-100 dark:border-slate-800 opacity-60'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className="font-semibold text-gray-900 dark:text-slate-100 text-sm">{rule.name}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="bg-amber-50 text-amber-700 border border-amber-200 px-2 py-1 rounded-lg font-medium">
              {describeTrigger(rule, columns)}
            </span>
            <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
            <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-1 rounded-lg font-medium">
              {describeAction(rule, columns, members)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Active toggle */}
          <button
            onClick={() => onToggle(rule)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${rule.is_active ? 'bg-indigo-600' : 'bg-gray-300'}`}
            title={rule.is_active ? 'Disable' : 'Enable'}
          >
            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow-sm ${rule.is_active ? 'translate-x-4' : 'translate-x-1'}`} />
          </button>
          <button onClick={() => onEdit(rule)} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Edit">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button onClick={() => onDelete(rule.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Automations() {
  const { id } = useParams();
  const { boards: allBoards, fetch: fetchBoards } = useBoardsStore();
  const [board, setBoard] = useState(null);
  const [rules, setRules] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [activeTab, setActiveTab] = useState('rules');

  useEffect(() => {
    fetchBoards();
    Promise.all([boardsApi.get(id), automationsApi.list(id), automationsApi.getLogs(id)])
      .then(([b, r, l]) => { setBoard(b); setRules(r); setLogs(l); })
      .finally(() => setLoading(false));
  }, [id]);

  async function handleCreate(data) {
    const rule = await automationsApi.create(id, data);
    setRules(rs => [...rs, rule]);
    setShowBuilder(false);
  }

  async function handleEdit(data) {
    const rule = await automationsApi.update(editingRule.id, { ...editingRule, ...data });
    setRules(rs => rs.map(r => r.id === rule.id ? rule : r));
    setEditingRule(null);
  }

  async function handleToggle(rule) {
    const updated = await automationsApi.update(rule.id, { ...rule, is_active: !rule.is_active });
    setRules(rs => rs.map(r => r.id === updated.id ? updated : r));
  }

  async function handleDelete(ruleId) {
    if (!confirm('Delete this automation rule?')) return;
    await automationsApi.delete(ruleId);
    setRules(rs => rs.filter(r => r.id !== ruleId));
  }

  const columns = board?.columns || [];
  const members = board?.members || [];

  if (loading) return (
    <div className="min-h-screen bg-gradient-1 flex items-center justify-center">
      <span className="text-white animate-pulse text-sm">Loading…</span>
    </div>
  );

  return (
    <div className={`min-h-screen flex flex-col bg-${board?.background || 'gradient-1'}`}>
      <Navbar title={board?.title} boardBackground={board?.background} />

      <div className="flex-1 p-6">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Link to={`/boards/${id}`} className="text-white/70 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <div>
                <h1 className="text-white font-bold text-xl flex items-center gap-2">
                  <svg className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Automations
                </h1>
                <p className="text-white/60 text-sm">Rules that run automatically when things happen</p>
              </div>
            </div>
            <button
              onClick={() => setShowBuilder(true)}
              className="flex items-center gap-2 bg-white text-indigo-700 hover:bg-indigo-50 font-semibold px-4 py-2 rounded-xl transition-colors text-sm shadow"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New rule
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-black/20 p-1 rounded-xl w-fit mb-5">
            {['rules', 'logs'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
                  activeTab === tab ? 'bg-white text-gray-900 shadow' : 'text-white/70 hover:text-white'
                }`}
              >
                {tab === 'rules' ? `Rules (${rules.length})` : `Activity log`}
              </button>
            ))}
          </div>

          {activeTab === 'rules' && (
            <div className="space-y-3">
              {rules.length === 0 ? (
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-12 text-center">
                  <div className="text-5xl mb-3">⚡</div>
                  <h3 className="text-white font-semibold text-lg mb-1">No rules yet</h3>
                  <p className="text-white/60 text-sm mb-5">Create your first automation to save time on repetitive work</p>
                  <button onClick={() => setShowBuilder(true)} className="bg-white text-indigo-700 font-semibold px-5 py-2 rounded-xl hover:bg-indigo-50 transition-colors text-sm">
                    Create first rule
                  </button>
                </div>
              ) : (
                rules.map(rule => (
                  <RuleCard
                    key={rule.id}
                    rule={rule}
                    columns={columns}
                    members={members}
                    onToggle={handleToggle}
                    onEdit={r => setEditingRule(r)}
                    onDelete={handleDelete}
                  />
                ))
              )}
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow overflow-hidden">
              {logs.length === 0 ? (
                <div className="p-10 text-center text-gray-400 dark:text-slate-500 text-sm">No automation runs yet</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-slate-900/50 border-b border-gray-200 dark:border-slate-700">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Rule</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Card</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Ran at</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                    {logs.map(log => (
                      <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/40 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <svg className="w-3 h-3 text-amber-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            <span className="font-medium text-gray-800 dark:text-slate-200">{log.rule_name}</span>
                          </div>
                          <div className="text-xs text-gray-400 dark:text-slate-500 mt-0.5 pl-5">
                            {TRIGGER_LABELS[log.trigger_type]} → {ACTION_LABELS[log.action_type]}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-slate-400">{log.card_title}</td>
                        <td className="px-4 py-3 text-gray-400 dark:text-slate-500 whitespace-nowrap">
                          {new Date(log.executed_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>

      {showBuilder && (
        <RuleBuilder
          columns={columns}
          members={members}
          allBoards={allBoards}
          currentBoardId={id}
          onSave={handleCreate}
          onClose={() => setShowBuilder(false)}
        />
      )}

      {editingRule && (
        <RuleBuilder
          columns={columns}
          members={members}
          allBoards={allBoards}
          currentBoardId={id}
          initial={editingRule}
          onSave={handleEdit}
          onClose={() => setEditingRule(null)}
        />
      )}
    </div>
  );
}
