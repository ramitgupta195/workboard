require('./db/schema');
const { v4: uuidv4 } = require('uuid');
const db = require('./db/database');

const owner = db.prepare('SELECT id FROM users LIMIT 1').get();
if (!owner) {
  console.log('No users found. Register an account first, then run this script.');
  process.exit(1);
}
const userId = owner.id;

function createBoard(title, description, background) {
  const existing = db.prepare('SELECT id FROM boards WHERE title = ?').get(title);
  if (existing) {
    console.log(`Board "${title}" already exists, skipping creation.`);
    return existing.id;
  }
  const id = uuidv4();
  db.prepare('INSERT INTO boards (id, title, description, background, created_by) VALUES (?, ?, ?, ?, ?)')
    .run(id, title, description, background, userId);
  db.prepare('INSERT INTO board_members (board_id, user_id, role) VALUES (?, ?, ?)').run(id, userId, 'owner');
  return id;
}

function createColumn(boardId, title, color, position) {
  const id = uuidv4();
  db.prepare('INSERT INTO columns (id, board_id, title, color, position) VALUES (?, ?, ?, ?, ?)').run(id, boardId, title, color, position);
  return id;
}

function seedRule(boardId, rule) {
  const id = uuidv4();
  db.prepare(`INSERT INTO automation_rules (id, board_id, name, trigger_type, trigger_config, action_type, action_config, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, boardId, rule.name, rule.trigger_type, JSON.stringify(rule.trigger_config), rule.action_type, JSON.stringify(rule.action_config), userId);
  console.log(`  ⚡ ${rule.name}`);
}

// ─── Sales Pipeline ────────────────────────────────────────────────────────────
console.log('\n📊 Creating Sales Pipeline board...');
const salesId = createBoard('Sales Pipeline', 'Track leads from first contact to closed deal', 'gradient-5');

const salesCols = db.prepare('SELECT id FROM columns WHERE board_id = ?').all(salesId);
if (salesCols.length === 0) {
  var sLead        = createColumn(salesId, 'New Lead',       '#94a3b8', 0);
  var sQualified   = createColumn(salesId, 'Qualified',      '#3b82f6', 1);
  var sProposal    = createColumn(salesId, 'Proposal Sent',  '#8b5cf6', 2);
  var sNegotiation = createColumn(salesId, 'Negotiation',    '#f97316', 3);
  var sWon         = createColumn(salesId, 'Won',            '#22c55e', 4);
  var sLost        = createColumn(salesId, 'Lost',           '#ef4444', 5);
  console.log('  Created 6 columns: New Lead → Qualified → Proposal Sent → Negotiation → Won → Lost');
} else {
  const c = db.prepare('SELECT * FROM columns WHERE board_id = ? ORDER BY position').all(salesId);
  var [sLead, sQualified, sProposal, sNegotiation, sWon, sLost] = c.map(x => x.id);
  console.log('  Columns already exist, reusing.');
}

// ─── Ops Pipeline ──────────────────────────────────────────────────────────────
console.log('\n⚙️  Creating Ops Pipeline board...');
const opsId = createBoard('Ops Pipeline', 'Fulfillment and delivery after a deal is closed', 'gradient-6');

const opsCols = db.prepare('SELECT id FROM columns WHERE board_id = ?').all(opsId);
if (opsCols.length === 0) {
  var oNew       = createColumn(opsId, 'New Order',      '#6366f1', 0);
  var oInProg    = createColumn(opsId, 'In Progress',    '#3b82f6', 1);
  var oQA        = createColumn(opsId, 'QA / Review',    '#f97316', 2);
  var oReady     = createColumn(opsId, 'Ready to Ship',  '#14b8a6', 3);
  var oDelivered = createColumn(opsId, 'Delivered',      '#22c55e', 4);
  var oInvoiced  = createColumn(opsId, 'Invoiced',       '#94a3b8', 5);
  console.log('  Created 6 columns: New Order → In Progress → QA / Review → Ready to Ship → Delivered → Invoiced');
} else {
  const c = db.prepare('SELECT * FROM columns WHERE board_id = ? ORDER BY position').all(opsId);
  var [oNew, oInProg, oQA, oReady, oDelivered, oInvoiced] = c.map(x => x.id);
  console.log('  Columns already exist, reusing.');
}

// ─── Clear old rules before seeding ───────────────────────────────────────────
db.prepare('DELETE FROM automation_rules WHERE board_id IN (?, ?)').run(salesId, opsId);

// ─── Sales Rules ───────────────────────────────────────────────────────────────
console.log('\n⚡ Seeding Sales automation rules...');

seedRule(salesId, {
  name: 'Follow up window on new lead',
  trigger_type: 'card_created',
  trigger_config: { in_column_id: sLead },
  action_type: 'set_due_date',
  action_config: { days_from_now: 2 },
});

seedRule(salesId, {
  name: 'Label lead as New',
  trigger_type: 'card_created',
  trigger_config: { in_column_id: sLead },
  action_type: 'add_label',
  action_config: { name: 'New Lead', color: '#6366f1' },
});

seedRule(salesId, {
  name: 'Escalate stale leads',
  trigger_type: 'card_idle',
  trigger_config: { days: 3 },
  action_type: 'set_priority',
  action_config: { priority: 'high' },
});

seedRule(salesId, {
  name: 'Set follow-up deadline after proposal',
  trigger_type: 'card_moved',
  trigger_config: { to_column_id: sProposal, from_column_id: 'any' },
  action_type: 'set_due_date',
  action_config: { days_from_now: 5 },
});

seedRule(salesId, {
  name: 'Flag overdue proposals as Urgent',
  trigger_type: 'due_date_passed',
  trigger_config: {},
  action_type: 'set_priority',
  action_config: { priority: 'urgent' },
});

seedRule(salesId, {
  name: 'Move urgent deals to Negotiation',
  trigger_type: 'priority_changed',
  trigger_config: { to_priority: 'urgent' },
  action_type: 'move_to_column',
  action_config: { column_id: sNegotiation },
});

seedRule(salesId, {
  name: '🔀 Handoff to Ops on Won deal',
  trigger_type: 'card_moved',
  trigger_config: { to_column_id: sWon, from_column_id: 'any' },
  action_type: 'create_card_in_board',
  action_config: { board_id: opsId, column_id: oNew },
});

seedRule(salesId, {
  name: 'Clear priority on Won',
  trigger_type: 'card_moved',
  trigger_config: { to_column_id: sWon, from_column_id: 'any' },
  action_type: 'set_priority',
  action_config: { priority: 'none' },
});

seedRule(salesId, {
  name: 'Label lost deals',
  trigger_type: 'card_moved',
  trigger_config: { to_column_id: sLost, from_column_id: 'any' },
  action_type: 'add_label',
  action_config: { name: 'Lost', color: '#ef4444' },
});

// ─── Ops Rules ─────────────────────────────────────────────────────────────────
console.log('\n⚡ Seeding Ops automation rules...');

seedRule(opsId, {
  name: 'Schedule delivery window on new order',
  trigger_type: 'card_created',
  trigger_config: { in_column_id: oNew },
  action_type: 'set_due_date',
  action_config: { days_from_now: 7 },
});

seedRule(opsId, {
  name: 'Label incoming orders',
  trigger_type: 'card_created',
  trigger_config: { in_column_id: oNew },
  action_type: 'add_label',
  action_config: { name: 'Incoming', color: '#6366f1' },
});

seedRule(opsId, {
  name: 'Tag cards under QA review',
  trigger_type: 'card_moved',
  trigger_config: { to_column_id: oQA, from_column_id: 'any' },
  action_type: 'add_label',
  action_config: { name: 'In Review', color: '#f97316' },
});

seedRule(opsId, {
  name: 'Flag overdue deliveries as Urgent',
  trigger_type: 'due_date_passed',
  trigger_config: {},
  action_type: 'set_priority',
  action_config: { priority: 'urgent' },
});

seedRule(opsId, {
  name: 'Escalate stale ops tickets',
  trigger_type: 'card_idle',
  trigger_config: { days: 4 },
  action_type: 'set_priority',
  action_config: { priority: 'high' },
});

seedRule(opsId, {
  name: 'Label delivered orders',
  trigger_type: 'card_moved',
  trigger_config: { to_column_id: oDelivered, from_column_id: 'any' },
  action_type: 'add_label',
  action_config: { name: 'Delivered', color: '#22c55e' },
});

seedRule(opsId, {
  name: 'Clear priority on invoice sent',
  trigger_type: 'card_moved',
  trigger_config: { to_column_id: oInvoiced, from_column_id: 'any' },
  action_type: 'set_priority',
  action_config: { priority: 'none' },
});

seedRule(opsId, {
  name: 'Label invoiced orders',
  trigger_type: 'card_moved',
  trigger_config: { to_column_id: oInvoiced, from_column_id: 'any' },
  action_type: 'add_label',
  action_config: { name: 'Invoiced', color: '#94a3b8' },
});

// ─── Summary ───────────────────────────────────────────────────────────────────
const salesCount = db.prepare('SELECT COUNT(*) as c FROM automation_rules WHERE board_id = ?').get(salesId).c;
const opsCount   = db.prepare('SELECT COUNT(*) as c FROM automation_rules WHERE board_id = ?').get(opsId).c;

console.log(`
✅ Done!
   Sales Pipeline  → ${salesCount} rules  (board ID: ${salesId})
   Ops Pipeline    → ${opsCount} rules   (board ID: ${opsId})

Flow:
   New Lead → Qualified → Proposal Sent → Negotiation → Won
                                                          ↓  (automatic handoff)
                                               New Order → In Progress → QA → Ready → Delivered → Invoiced
`);
