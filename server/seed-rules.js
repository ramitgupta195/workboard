require('./db/schema');
const { v4: uuidv4 } = require('uuid');
const db = require('./db/database');

const boards = db.prepare('SELECT * FROM boards').all();
if (!boards.length) {
  console.log('No boards found. Create a board first then run this script.');
  process.exit(0);
}

let seeded = 0;

for (const board of boards) {
  const cols = db.prepare('SELECT * FROM columns WHERE board_id = ? ORDER BY position').all(board.id);
  if (!cols.length) continue;

  const existingRules = db.prepare('SELECT COUNT(*) as c FROM automation_rules WHERE board_id = ?').get(board.id).c;
  if (existingRules > 0) {
    console.log(`Board "${board.title}": already has ${existingRules} rules, skipping.`);
    continue;
  }

  // Find columns by title, fall back to positional
  const byTitle = name => cols.find(c => c.title.toLowerCase().includes(name.toLowerCase()));
  const todo       = byTitle('to do')      || byTitle('todo')      || cols[0];
  const inProgress = byTitle('in progress') || byTitle('progress')  || cols[1] || cols[0];
  const inReview   = byTitle('in review')   || byTitle('review')    || cols[2] || cols[1] || cols[0];
  const done       = byTitle('done')        || byTitle('complete')  || cols[cols.length - 1];
  const createdBy  = board.created_by;

  const rules = [
    {
      name: 'Auto-schedule when work starts',
      trigger_type: 'card_moved',
      trigger_config: { to_column_id: inProgress.id, from_column_id: 'any' },
      action_type: 'set_due_date',
      action_config: { days_from_now: 5 },
    },
    {
      name: 'Flag overdue cards as Urgent',
      trigger_type: 'due_date_passed',
      trigger_config: {},
      action_type: 'set_priority',
      action_config: { priority: 'urgent' },
    },
    {
      name: 'Clear priority when Done',
      trigger_type: 'card_moved',
      trigger_config: { to_column_id: done.id, from_column_id: 'any' },
      action_type: 'set_priority',
      action_config: { priority: 'none' },
    },
    {
      name: 'Escalate stale tickets',
      trigger_type: 'card_idle',
      trigger_config: { days: 4 },
      action_type: 'set_priority',
      action_config: { priority: 'high' },
    },
    {
      name: 'Label new work',
      trigger_type: 'card_created',
      trigger_config: { in_column_id: todo.id },
      action_type: 'add_label',
      action_config: { name: 'New', color: '#6366f1' },
    },
    {
      name: 'Move urgent cards to In Progress',
      trigger_type: 'priority_changed',
      trigger_config: { to_priority: 'urgent' },
      action_type: 'move_to_column',
      action_config: { column_id: inProgress.id },
    },
    {
      name: 'Tag cards under review',
      trigger_type: 'card_moved',
      trigger_config: { to_column_id: inReview.id, from_column_id: 'any' },
      action_type: 'add_label',
      action_config: { name: 'Needs Review', color: '#f97316' },
    },
  ];

  const insert = db.prepare(
    'INSERT INTO automation_rules (id, board_id, name, trigger_type, trigger_config, action_type, action_config, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );

  const insertAll = db.transaction(ruleList => {
    for (const r of ruleList) {
      insert.run(uuidv4(), board.id, r.name, r.trigger_type, JSON.stringify(r.trigger_config), r.action_type, JSON.stringify(r.action_config), createdBy);
    }
  });

  insertAll(rules);
  seeded += rules.length;
  console.log(`Board "${board.title}": seeded ${rules.length} rules`);
  rules.forEach(r => console.log(`  ✓ ${r.name}`));
}

console.log(`\nDone — ${seeded} total rules seeded.`);
