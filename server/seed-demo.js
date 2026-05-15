/**
 * Demo seed — creates users, boards, cards, comments, notifications.
 * Safe to re-run: skips anything that already exists.
 *
 * Login credentials after running:
 *   sarah@demo.com   / demo123   (Sales Lead)
 *   mike@demo.com    / demo123   (Ops Manager)
 *   priya@demo.com   / demo123   (SDR)
 *   alex@demo.com    / demo123   (Ops Team)
 */

require('./db/schema');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('./db/database');

// ─── helpers ──────────────────────────────────────────────────────────────────

function upsertUser(name, email, password, color) {
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return existing.id;
  const id = uuidv4();
  const hash = bcrypt.hashSync(password, 10);
  db.prepare('INSERT INTO users (id, name, email, password_hash, avatar_color) VALUES (?, ?, ?, ?, ?)')
    .run(id, name, email, hash, color);
  return id;
}

function upsertBoard(title, description, background, createdBy) {
  const existing = db.prepare('SELECT id FROM boards WHERE title = ?').get(title);
  if (existing) return existing.id;
  const id = uuidv4();
  db.prepare('INSERT INTO boards (id, title, description, background, created_by) VALUES (?, ?, ?, ?, ?)')
    .run(id, title, description, background, createdBy);
  db.prepare('INSERT OR IGNORE INTO board_members (board_id, user_id, role) VALUES (?, ?, ?)').run(id, createdBy, 'owner');
  return id;
}

function addMember(boardId, userId) {
  db.prepare('INSERT OR IGNORE INTO board_members (board_id, user_id, role) VALUES (?, ?, ?)').run(boardId, userId, 'member');
}

function upsertColumn(boardId, title, color, position) {
  const existing = db.prepare('SELECT id FROM columns WHERE board_id = ? AND title = ?').get(boardId, title);
  if (existing) return existing.id;
  const id = uuidv4();
  db.prepare('INSERT INTO columns (id, board_id, title, color, position) VALUES (?, ?, ?, ?, ?)').run(id, boardId, title, color, position);
  return id;
}

function createCard({ columnId, boardId, title, description, priority, daysAgo, dueInDays, createdBy }) {
  const id = uuidv4();
  const daysAgoVal = daysAgo ?? 0;
  db.prepare(`
    INSERT INTO cards (id, column_id, board_id, title, description, priority, position, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?), datetime('now', ?))
  `).run(id, columnId, boardId, title, description ?? '', priority ?? 'none',
    db.prepare('SELECT COALESCE(MAX(position)+1, 0) as p FROM cards WHERE column_id = ?').get(columnId).p,
    createdBy, `-${daysAgoVal} days`, `-${daysAgoVal} days`);

  if (dueInDays !== undefined) {
    db.prepare("UPDATE cards SET due_date = date('now', ?) WHERE id = ?").run(`+${dueInDays} days`, id);
  }
  return id;
}

function addLabel(cardId, name, color) {
  db.prepare('INSERT INTO card_labels (id, card_id, name, color) VALUES (?, ?, ?, ?)').run(uuidv4(), cardId, name, color);
}

function assignCard(cardId, ...userIds) {
  const stmt = db.prepare('INSERT OR IGNORE INTO card_assignees (card_id, user_id) VALUES (?, ?)');
  userIds.forEach(uid => stmt.run(cardId, uid));
}

function addComment(cardId, userId, content, daysAgo = 0) {
  const id = uuidv4();
  db.prepare(`INSERT INTO comments (id, card_id, user_id, content, created_at) VALUES (?, ?, ?, ?, datetime('now', ?))`)
    .run(id, cardId, userId, content, `-${daysAgo} days`);
  return id;
}

function addNotification(userId, type, message, cardId, boardId, daysAgo = 0) {
  db.prepare(`INSERT INTO notifications (id, user_id, type, message, card_id, board_id, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, datetime('now', ?))`)
    .run(uuidv4(), userId, type, message, cardId, boardId, `-${daysAgo} days`);
}

function seedRule(boardId, rule, createdBy) {
  db.prepare(`INSERT INTO automation_rules (id, board_id, name, trigger_type, trigger_config, action_type, action_config, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(uuidv4(), boardId, rule.name, rule.trigger_type, JSON.stringify(rule.trigger_config), rule.action_type, JSON.stringify(rule.action_config), createdBy);
}

// ─── users ────────────────────────────────────────────────────────────────────
console.log('\n👥 Creating demo users...');

const sarah = upsertUser('Sarah Chen',   'sarah@demo.com',  'demo123', '#6366f1');
const mike  = upsertUser('Mike Torres',  'mike@demo.com',   'demo123', '#22c55e');
const priya = upsertUser('Priya Patel',  'priya@demo.com',  'demo123', '#f97316');
const alex  = upsertUser('Alex Kim',     'alex@demo.com',   'demo123', '#3b82f6');

console.log('  ✓ sarah@demo.com  (Sales Lead)');
console.log('  ✓ mike@demo.com   (Ops Manager)');
console.log('  ✓ priya@demo.com  (SDR)');
console.log('  ✓ alex@demo.com   (Ops Team)');

// ─── Sales Pipeline board ─────────────────────────────────────────────────────
console.log('\n📊 Sales Pipeline board...');

const salesId = upsertBoard('Sales Pipeline', 'Track leads from first contact to closed deal', 'gradient-5', sarah);
[mike, priya, alex].forEach(u => addMember(salesId, u));

const sLead        = upsertColumn(salesId, 'New Lead',       '#94a3b8', 0);
const sQualified   = upsertColumn(salesId, 'Qualified',      '#3b82f6', 1);
const sProposal    = upsertColumn(salesId, 'Proposal Sent',  '#8b5cf6', 2);
const sNegotiation = upsertColumn(salesId, 'Negotiation',    '#f97316', 3);
const sWon         = upsertColumn(salesId, 'Won',            '#22c55e', 4);
const sLost        = upsertColumn(salesId, 'Lost',           '#ef4444', 5);

// skip if cards already exist
const existingSalesCards = db.prepare('SELECT COUNT(*) as c FROM cards WHERE board_id = ?').get(salesId).c;
if (existingSalesCards === 0) {
  // New Lead
  const c1 = createCard({ columnId: sLead, boardId: salesId, title: 'DataFlow Systems — Initial Contact', description: 'Reached out via LinkedIn. Interested in data pipeline tooling.', priority: 'low', daysAgo: 1, dueInDays: 1, createdBy: priya });
  addLabel(c1, 'Inbound', '#6366f1');
  assignCard(c1, priya);
  addComment(c1, priya, 'Called them this morning — CTO is interested but needs a demo first.', 1);
  addNotification(sarah, 'mention', 'Priya Patel mentioned you in a comment on "DataFlow Systems — Initial Contact"', c1, salesId, 1);

  const c2 = createCard({ columnId: sLead, boardId: salesId, title: 'HealthPlus Corp — Referral', description: 'Referred by NovaTech. Looking for compliance reporting features.', priority: 'medium', daysAgo: 2, dueInDays: 2, createdBy: sarah });
  addLabel(c2, 'Referral', '#22c55e');
  assignCard(c2, sarah);

  // Qualified
  const c3 = createCard({ columnId: sQualified, boardId: salesId, title: 'TechStart Inc — Starter Plan', description: '12-person startup, budget confirmed at $800/mo. Decision maker: CTO Rohan.', priority: 'medium', daysAgo: 5, dueInDays: 4, createdBy: priya });
  addLabel(c3, 'SMB', '#3b82f6');
  assignCard(c3, priya, sarah);
  addComment(c3, sarah, 'Had a great discovery call. They need multi-board support — we cover that. @Priya Patel can you prepare the pricing deck?', 4);
  addComment(c3, priya, 'On it! Will send it over by EOD.', 3);
  addNotification(priya, 'mention', 'Sarah Chen mentioned you in a comment on "TechStart Inc — Starter Plan"', c3, salesId, 4);
  addNotification(priya, 'assigned', 'Sarah Chen assigned you to "TechStart Inc — Starter Plan"', c3, salesId, 5);

  const c4 = createCard({ columnId: sQualified, boardId: salesId, title: 'Nexus Analytics — Data Team', description: 'Analytics team of 25. Strong interest in automation rules + cross-board handoffs.', priority: 'high', daysAgo: 3, dueInDays: 3, createdBy: sarah });
  addLabel(c4, 'Mid-Market', '#8b5cf6');
  assignCard(c4, sarah, alex);

  // Proposal Sent
  const c5 = createCard({ columnId: sProposal, boardId: salesId, title: 'GlobalRetail — Custom Contract', description: 'Retail chain, 200 seats. Custom SLA required. Legal review in progress.', priority: 'urgent', daysAgo: 7, dueInDays: 1, createdBy: sarah });
  addLabel(c5, 'Enterprise', '#ef4444');
  addLabel(c5, 'Legal Review', '#f97316');
  assignCard(c5, sarah, mike);
  addComment(c5, mike, 'Legal flagged the SLA clause — needs revision before we can proceed. @Sarah Chen please loop in legal.', 3);
  addComment(c5, sarah, 'On it. Escalating to legal team today.', 2);
  addNotification(sarah, 'mention', 'Mike Torres mentioned you in a comment on "GlobalRetail — Custom Contract"', c5, salesId, 3);

  const c6 = createCard({ columnId: sProposal, boardId: salesId, title: 'CloudFirst — Migration Package', description: 'Moving from Jira. 80 seats. Want to import existing boards.', priority: 'high', daysAgo: 6, dueInDays: 3, createdBy: sarah });
  addLabel(c6, 'Migration', '#14b8a6');
  assignCard(c6, sarah);
  addComment(c6, sarah, 'Sent proposal on Monday. Following up Friday if no response.', 2);

  // Negotiation
  const c7 = createCard({ columnId: sNegotiation, boardId: salesId, title: 'Acme Corp — Enterprise License', description: '500-seat deal. Negotiating annual vs monthly. Procurement involved.', priority: 'high', daysAgo: 10, dueInDays: 5, createdBy: sarah });
  addLabel(c7, 'Enterprise', '#ef4444');
  addLabel(c7, 'Strategic', '#eab308');
  assignCard(c7, sarah, priya);
  addComment(c7, priya, 'Procurement wants a 2-year discount. I said 10% max. @Sarah Chen — do we have room to go to 15%?', 5);
  addComment(c7, sarah, 'Let me check with finance. Stand by.', 4);
  addComment(c7, sarah, 'Finance approved up to 13%. Counter back at 12% and hold.', 3);
  addNotification(sarah, 'mention', 'Priya Patel mentioned you in a comment on "Acme Corp — Enterprise License"', c7, salesId, 5);

  const c8 = createCard({ columnId: sNegotiation, boardId: salesId, title: 'FinanceHub — Compliance Suite', description: 'FinTech client, strict compliance requirements. SOC 2 certification needed.', priority: 'urgent', daysAgo: 8, dueInDays: 2, createdBy: sarah });
  addLabel(c8, 'FinTech', '#6366f1');
  addLabel(c8, 'Compliance', '#f97316');
  assignCard(c8, sarah, mike);

  // Won
  const c9 = createCard({ columnId: sWon, boardId: salesId, title: 'NovaTech — SMB Package', description: 'Closed! 25 seats, annual plan. Handoff to ops for onboarding.', priority: 'none', daysAgo: 12, createdBy: sarah });
  addLabel(c9, 'Closed Won', '#22c55e');
  assignCard(c9, sarah);
  addComment(c9, sarah, '🎉 Closed! Handed off to ops. Great win for Q1.', 12);

  const c10 = createCard({ columnId: sWon, boardId: salesId, title: 'RetailBrand — Annual Renewal', description: 'Existing customer renewal. 3-year deal signed.', priority: 'none', daysAgo: 15, createdBy: priya });
  addLabel(c10, 'Renewal', '#14b8a6');
  assignCard(c10, priya);

  // Lost
  const c11 = createCard({ columnId: sLost, boardId: salesId, title: 'OldCo — Legacy Migration', description: 'Lost to competitor on pricing. They went with cheaper option.', priority: 'none', daysAgo: 20, createdBy: priya });
  addLabel(c11, 'Lost', '#ef4444');
  addLabel(c11, 'Price Sensitivity', '#94a3b8');
  addComment(c11, priya, 'Post-mortem: need a lower-tier plan option to compete in this segment.', 18);

  console.log(`  ✓ Created ${db.prepare('SELECT COUNT(*) as c FROM cards WHERE board_id = ?').get(salesId).c} cards`);
} else {
  console.log(`  ↩  Cards already exist, skipping.`);
}

// ─── Ops Pipeline board ───────────────────────────────────────────────────────
console.log('\n⚙️  Ops Pipeline board...');

const opsId = upsertBoard('Ops Pipeline', 'Fulfillment and delivery after a deal is closed', 'gradient-6', mike);
[sarah, priya, alex].forEach(u => addMember(opsId, u));

const oNew       = upsertColumn(opsId, 'New Order',      '#6366f1', 0);
const oInProg    = upsertColumn(opsId, 'In Progress',    '#3b82f6', 1);
const oQA        = upsertColumn(opsId, 'QA / Review',    '#f97316', 2);
const oReady     = upsertColumn(opsId, 'Ready to Ship',  '#14b8a6', 3);
const oDelivered = upsertColumn(opsId, 'Delivered',      '#22c55e', 4);
const oInvoiced  = upsertColumn(opsId, 'Invoiced',       '#94a3b8', 5);

const existingOpsCards = db.prepare('SELECT COUNT(*) as c FROM cards WHERE board_id = ?').get(opsId).c;
if (existingOpsCards === 0) {
  // New Order
  const o1 = createCard({ columnId: oNew, boardId: opsId, title: 'TechStart Inc — Onboarding Setup', description: 'New customer from sales handoff. Set up workspace, import team members, configure roles.', priority: 'medium', daysAgo: 1, dueInDays: 5, createdBy: mike });
  addLabel(o1, 'Incoming', '#6366f1');
  assignCard(o1, alex, mike);
  addComment(o1, mike, '@Alex Kim this one just came in from sales. Please kick off the onboarding checklist.', 1);
  addNotification(alex, 'mention', 'Mike Torres mentioned you in a comment on "TechStart Inc — Onboarding Setup"', o1, opsId, 1);
  addNotification(alex, 'assigned', 'Mike Torres assigned you to "TechStart Inc — Onboarding Setup"', o1, opsId, 1);

  const o2 = createCard({ columnId: oNew, boardId: opsId, title: 'HealthPlus Corp — Order #1052', description: 'Compliance reporting package. Custom data export config required.', priority: 'low', daysAgo: 0, dueInDays: 7, createdBy: mike });
  addLabel(o2, 'Incoming', '#6366f1');
  assignCard(o2, mike);

  // In Progress
  const o3 = createCard({ columnId: oInProg, boardId: opsId, title: 'NovaTech — SMB Onboarding', description: 'Setting up 25 user accounts. Migrating their existing Trello boards.', priority: 'medium', daysAgo: 3, dueInDays: 4, createdBy: mike });
  addLabel(o3, 'Onboarding', '#3b82f6');
  assignCard(o3, alex, mike);
  addComment(o3, alex, 'Accounts created. Board migration 60% done — need to map their labels.', 2);
  addComment(o3, mike, 'Good progress! @Alex Kim aim to finish migration by Thursday.', 1);
  addNotification(alex, 'mention', 'Mike Torres mentioned you in a comment on "NovaTech — SMB Onboarding"', o3, opsId, 1);

  const o4 = createCard({ columnId: oInProg, boardId: opsId, title: 'CloudFirst — Data Import', description: '80-user migration from Jira. Custom field mapping in progress.', priority: 'high', daysAgo: 4, dueInDays: 3, createdBy: mike });
  addLabel(o4, 'Migration', '#14b8a6');
  assignCard(o4, alex);
  addComment(o4, alex, 'Field mapping is complex — they have 40+ custom fields. Might need an extra day.', 2);
  addNotification(alex, 'card_moved', '"CloudFirst — Data Import" was moved to "In Progress"', o4, opsId, 4);

  // QA / Review
  const o5 = createCard({ columnId: oQA, boardId: opsId, title: 'RetailCo — Order #1047', description: 'Retail chain configuration. QA checking permission setup and workflow automation.', priority: 'medium', daysAgo: 5, dueInDays: 1, createdBy: mike });
  addLabel(o5, 'In Review', '#f97316');
  assignCard(o5, mike, alex);
  addComment(o5, alex, 'Permissions look good. Testing automation rules now.', 1);
  addComment(o5, mike, 'If automation passes, clear to ship today.', 0);

  const o6 = createCard({ columnId: oQA, boardId: opsId, title: 'DataSystems — Order #1048', description: 'API integration setup. Testing webhook endpoints and rate limits.', priority: 'high', daysAgo: 3, dueInDays: 0, createdBy: mike });
  addLabel(o6, 'In Review', '#f97316');
  addLabel(o6, 'API', '#8b5cf6');
  assignCard(o6, alex);
  addComment(o6, alex, '⚠️ Webhooks failing on /cards/move endpoint. Investigating.', 0);
  addNotification(mike, 'mention', 'Alex Kim mentioned you in a comment on "DataSystems — Order #1048"', o6, opsId, 0);

  // Ready to Ship
  const o7 = createCard({ columnId: oReady, boardId: opsId, title: 'Nexus Analytics — Delivery Pack', description: 'All setup verified. Sending welcome kit and training materials.', priority: 'none', daysAgo: 7, createdBy: mike });
  addLabel(o7, 'Delivered', '#22c55e');
  assignCard(o7, mike);

  // Delivered
  const o8 = createCard({ columnId: oDelivered, boardId: opsId, title: 'HealthPlus — Order #1046', description: 'Delivered on time. Customer confirmed receipt.', priority: 'none', daysAgo: 10, createdBy: mike });
  addLabel(o8, 'Delivered', '#22c55e');
  assignCard(o8, mike, alex);
  addComment(o8, mike, '✅ Customer confirmed setup. Sending feedback survey.', 9);

  const o9 = createCard({ columnId: oDelivered, boardId: opsId, title: 'RetailBrand — Renewal Onboarding', description: '3-year renewal. Upgraded their plan, migrated to new tier.', priority: 'none', daysAgo: 14, createdBy: mike });
  addLabel(o9, 'Delivered', '#22c55e');
  assignCard(o9, alex);

  // Invoiced
  const o10 = createCard({ columnId: oInvoiced, boardId: opsId, title: 'NovaTech — Invoice #INV-0041', description: 'Annual plan invoice sent. Net-30 terms.', priority: 'none', daysAgo: 15, createdBy: mike });
  addLabel(o10, 'Invoiced', '#94a3b8');
  assignCard(o10, mike);

  console.log(`  ✓ Created ${db.prepare('SELECT COUNT(*) as c FROM cards WHERE board_id = ?').get(opsId).c} cards`);
} else {
  console.log(`  ↩  Cards already exist, skipping.`);
}

// ─── Product Backlog board ────────────────────────────────────────────────────
console.log('\n🛠️  Product Backlog board...');

const prodId = upsertBoard('Product Backlog', 'Engineering tasks, bugs, and feature work', 'gradient-2', alex);
[sarah, mike, priya].forEach(u => addMember(prodId, u));

const pTodo     = upsertColumn(prodId, 'Backlog',      '#94a3b8', 0);
const pInProg   = upsertColumn(prodId, 'In Progress',  '#3b82f6', 1);
const pReview   = upsertColumn(prodId, 'In Review',    '#8b5cf6', 2);
const pDone     = upsertColumn(prodId, 'Done',         '#22c55e', 3);

const existingProdCards = db.prepare('SELECT COUNT(*) as c FROM cards WHERE board_id = ?').get(prodId).c;
if (existingProdCards === 0) {
  // Backlog
  const p1 = createCard({ columnId: pTodo, boardId: prodId, title: 'Add CSV export for card data', description: 'Users want to export their boards to CSV for reporting.', priority: 'medium', daysAgo: 5, createdBy: alex });
  addLabel(p1, 'Feature', '#3b82f6');

  const p2 = createCard({ columnId: pTodo, boardId: prodId, title: 'Email digest for notifications', description: 'Daily/weekly email summary of unread notifications.', priority: 'low', daysAgo: 3, createdBy: alex });
  addLabel(p2, 'Feature', '#3b82f6');

  const p3 = createCard({ columnId: pTodo, boardId: prodId, title: 'Fix: drag-and-drop jitter on Safari', description: 'Cards jump on Safari iOS when dragging. Affects mobile users.', priority: 'high', daysAgo: 2, dueInDays: 3, createdBy: alex });
  addLabel(p3, 'Bug', '#ef4444');
  assignCard(p3, alex);

  const p4 = createCard({ columnId: pTodo, boardId: prodId, title: 'Board templates', description: 'Pre-built templates: Sales CRM, Sprint, Hiring Pipeline, etc.', priority: 'low', daysAgo: 7, createdBy: sarah });
  addLabel(p4, 'Feature', '#3b82f6');
  addLabel(p4, 'Q2', '#eab308');

  // In Progress
  const p5 = createCard({ columnId: pInProg, boardId: prodId, title: 'Mobile responsive layout', description: 'Board and card views need to work on phones. Design in Figma done.', priority: 'high', daysAgo: 4, dueInDays: 5, createdBy: alex });
  addLabel(p5, 'Enhancement', '#8b5cf6');
  assignCard(p5, alex, mike);
  addComment(p5, alex, 'Column scroll works now. Card modal still needs work on small screens.', 2);
  addComment(p5, mike, '@Alex Kim does this need to work on tablets too or just phones?', 1);
  addComment(p5, alex, 'Both — targeting 375px minimum width.', 0);
  addNotification(alex, 'mention', 'Mike Torres mentioned you in a comment on "Mobile responsive layout"', p5, prodId, 1);

  const p6 = createCard({ columnId: pInProg, boardId: prodId, title: 'Search across all cards', description: 'Global search bar to find cards by title, description, or label.', priority: 'medium', daysAgo: 3, dueInDays: 7, createdBy: alex });
  addLabel(p6, 'Feature', '#3b82f6');
  assignCard(p6, alex);
  addComment(p6, alex, 'Backend FTS (full-text search) query working. Frontend UI in progress.', 1);

  // In Review
  const p7 = createCard({ columnId: pReview, boardId: prodId, title: 'Notification system — backend', description: 'Mention, assignment, and card-move triggers. DB schema + API routes.', priority: 'none', daysAgo: 6, createdBy: alex });
  addLabel(p7, 'Feature', '#3b82f6');
  addLabel(p7, 'Done', '#22c55e');
  assignCard(p7, alex);
  addComment(p7, sarah, 'Tested @mentions — working great! Edge cases with partial names fixed.', 1);
  addComment(p7, alex, 'Thanks @Sarah Chen! Will merge after final review.', 0);

  // Done
  const p8 = createCard({ columnId: pDone, boardId: prodId, title: 'Dark mode support', description: 'Light/dark toggle with smooth transitions. Persists to localStorage.', priority: 'none', daysAgo: 8, createdBy: alex });
  addLabel(p8, 'Enhancement', '#8b5cf6');
  addLabel(p8, 'Done', '#22c55e');
  assignCard(p8, alex);
  addComment(p8, sarah, '✨ Looks amazing! The transition animation is a nice touch.', 7);

  const p9 = createCard({ columnId: pDone, boardId: prodId, title: 'Automation rules engine', description: 'Tier-1 automation: triggers, actions, scheduled runs. Sales + Ops rules seeded.', priority: 'none', daysAgo: 14, createdBy: alex });
  addLabel(p9, 'Feature', '#3b82f6');
  addLabel(p9, 'Done', '#22c55e');
  assignCard(p9, alex, mike);

  const p10 = createCard({ columnId: pDone, boardId: prodId, title: 'JWT auth + user registration', description: 'bcryptjs password hashing, JWT tokens, protected routes.', priority: 'none', daysAgo: 20, createdBy: alex });
  addLabel(p10, 'Done', '#22c55e');

  console.log(`  ✓ Created ${db.prepare('SELECT COUNT(*) as c FROM cards WHERE board_id = ?').get(prodId).c} cards`);
} else {
  console.log(`  ↩  Cards already exist, skipping.`);
}

// ─── Automation rules ─────────────────────────────────────────────────────────
console.log('\n⚡ Seeding automation rules...');

const existingSalesRules = db.prepare('SELECT COUNT(*) as c FROM automation_rules WHERE board_id = ?').get(salesId).c;
if (existingSalesRules === 0) {
  seedRule(salesId, { name: 'Follow-up window on new lead', trigger_type: 'card_created', trigger_config: { in_column_id: sLead }, action_type: 'set_due_date', action_config: { days_from_now: 2 } }, sarah);
  seedRule(salesId, { name: 'Escalate stale leads', trigger_type: 'card_idle', trigger_config: { days: 3 }, action_type: 'set_priority', action_config: { priority: 'high' } }, sarah);
  seedRule(salesId, { name: 'Follow-up deadline after proposal', trigger_type: 'card_moved', trigger_config: { to_column_id: sProposal, from_column_id: 'any' }, action_type: 'set_due_date', action_config: { days_from_now: 5 } }, sarah);
  seedRule(salesId, { name: 'Flag overdue proposals as Urgent', trigger_type: 'due_date_passed', trigger_config: {}, action_type: 'set_priority', action_config: { priority: 'urgent' } }, sarah);
  seedRule(salesId, { name: '🔀 Handoff to Ops on Won deal', trigger_type: 'card_moved', trigger_config: { to_column_id: sWon, from_column_id: 'any' }, action_type: 'create_card_in_board', action_config: { board_id: opsId, column_id: oNew } }, sarah);
  seedRule(salesId, { name: 'Clear priority on Won', trigger_type: 'card_moved', trigger_config: { to_column_id: sWon, from_column_id: 'any' }, action_type: 'set_priority', action_config: { priority: 'none' } }, sarah);
  seedRule(salesId, { name: 'Label lost deals', trigger_type: 'card_moved', trigger_config: { to_column_id: sLost, from_column_id: 'any' }, action_type: 'add_label', action_config: { name: 'Lost', color: '#ef4444' } }, sarah);
  console.log(`  ✓ Sales: 7 rules`);
}

const existingOpsRules = db.prepare('SELECT COUNT(*) as c FROM automation_rules WHERE board_id = ?').get(opsId).c;
if (existingOpsRules === 0) {
  seedRule(opsId, { name: 'Schedule delivery window', trigger_type: 'card_created', trigger_config: { in_column_id: oNew }, action_type: 'set_due_date', action_config: { days_from_now: 7 } }, mike);
  seedRule(opsId, { name: 'Tag cards under QA review', trigger_type: 'card_moved', trigger_config: { to_column_id: oQA, from_column_id: 'any' }, action_type: 'add_label', action_config: { name: 'In Review', color: '#f97316' } }, mike);
  seedRule(opsId, { name: 'Flag overdue deliveries as Urgent', trigger_type: 'due_date_passed', trigger_config: {}, action_type: 'set_priority', action_config: { priority: 'urgent' } }, mike);
  seedRule(opsId, { name: 'Escalate stale ops tickets', trigger_type: 'card_idle', trigger_config: { days: 4 }, action_type: 'set_priority', action_config: { priority: 'high' } }, mike);
  seedRule(opsId, { name: 'Label delivered orders', trigger_type: 'card_moved', trigger_config: { to_column_id: oDelivered, from_column_id: 'any' }, action_type: 'add_label', action_config: { name: 'Delivered', color: '#22c55e' } }, mike);
  console.log(`  ✓ Ops: 5 rules`);
}

// ─── summary ──────────────────────────────────────────────────────────────────
const totalCards   = db.prepare('SELECT COUNT(*) as c FROM cards').get().c;
const totalComments = db.prepare('SELECT COUNT(*) as c FROM comments').get().c;
const totalNotifs  = db.prepare('SELECT COUNT(*) as c FROM notifications').get().c;

console.log(`
╔══════════════════════════════════════════════════════╗
║              ✅  Demo data ready!                    ║
╠══════════════════════════════════════════════════════╣
║  Boards   3  (Sales, Ops, Product Backlog)           ║
║  Cards    ${String(totalCards).padEnd(3)} across all boards                   ║
║  Comments ${String(totalComments).padEnd(3)} with @mentions                   ║
║  Notifs   ${String(totalNotifs).padEnd(3)} seeded notifications               ║
╠══════════════════════════════════════════════════════╣
║  Login with any of these accounts (pw: demo123)     ║
║                                                      ║
║  sarah@demo.com  — Sales Lead                        ║
║  mike@demo.com   — Ops Manager                       ║
║  priya@demo.com  — SDR / Sales Rep                   ║
║  alex@demo.com   — Ops / Engineering                 ║
╚══════════════════════════════════════════════════════╝
`);
