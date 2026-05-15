const { v4: uuidv4 } = require('uuid');

function matchesTrigger(type, config, ctx) {
  switch (type) {
    case 'card_moved':
      return (
        (config.to_column_id === 'any' || config.to_column_id === ctx.to_column_id) &&
        (!config.from_column_id || config.from_column_id === 'any' || config.from_column_id === ctx.from_column_id)
      );
    case 'card_created':
      return !config.in_column_id || config.in_column_id === 'any' || config.in_column_id === ctx.column_id;
    case 'priority_changed':
      return config.to_priority === 'any' || config.to_priority === ctx.to_priority;
    case 'due_date_passed':
    case 'card_idle':
      return true;
    default:
      return false;
  }
}

function executeAction(type, config, card, db) {
  try {
    switch (type) {
      case 'assign_user': {
        const exists = db.prepare('SELECT 1 FROM card_assignees WHERE card_id = ? AND user_id = ?').get(card.id, config.user_id);
        if (!exists) db.prepare('INSERT INTO card_assignees (card_id, user_id) VALUES (?, ?)').run(card.id, config.user_id);
        break;
      }
      case 'set_due_date': {
        const d = new Date();
        d.setDate(d.getDate() + (parseInt(config.days_from_now) || 0));
        db.prepare("UPDATE cards SET due_date = ?, updated_at = datetime('now') WHERE id = ?")
          .run(d.toISOString().slice(0, 10), card.id);
        break;
      }
      case 'add_label': {
        const exists = db.prepare('SELECT 1 FROM card_labels WHERE card_id = ? AND name = ?').get(card.id, config.name);
        if (!exists) db.prepare('INSERT INTO card_labels (id, card_id, name, color) VALUES (?, ?, ?, ?)').run(uuidv4(), card.id, config.name, config.color);
        break;
      }
      case 'move_to_column': {
        if (card.column_id === config.column_id) break;
        const maxPos = db.prepare('SELECT MAX(position) as max FROM cards WHERE column_id = ?').get(config.column_id);
        const pos = (maxPos.max ?? -1) + 1;
        db.prepare("UPDATE cards SET column_id = ?, position = ?, updated_at = datetime('now') WHERE id = ?")
          .run(config.column_id, pos, card.id);
        break;
      }
      case 'set_priority':
        db.prepare("UPDATE cards SET priority = ?, updated_at = datetime('now') WHERE id = ?").run(config.priority, card.id);
        break;
      case 'create_card_in_board': {
        const targetCol = db.prepare('SELECT * FROM columns WHERE id = ?').get(config.column_id);
        if (!targetCol) break;
        const maxPos = db.prepare('SELECT MAX(position) as max FROM cards WHERE column_id = ?').get(config.column_id);
        const pos = (maxPos.max ?? -1) + 1;
        db.prepare('INSERT INTO cards (id, column_id, board_id, title, priority, position, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .run(uuidv4(), config.column_id, targetCol.board_id, card.title, 'none', pos, card.created_by);
        break;
      }
    }
  } catch (err) {
    console.error(`[automation] action ${type} failed:`, err.message);
  }
}

function logExecution(ruleId, cardId, db) {
  db.prepare('INSERT INTO automation_logs (id, rule_id, card_id) VALUES (?, ?, ?)').run(uuidv4(), ruleId, cardId);
}

function runTrigger(triggerType, card, ctx, db) {
  const rules = db.prepare(
    'SELECT * FROM automation_rules WHERE board_id = ? AND trigger_type = ? AND is_active = 1'
  ).all(card.board_id, triggerType);

  for (const rule of rules) {
    const tConfig = JSON.parse(rule.trigger_config || '{}');
    if (!matchesTrigger(triggerType, tConfig, ctx)) continue;
    executeAction(rule.action_type, JSON.parse(rule.action_config || '{}'), card, db);
    logExecution(rule.id, card.id, db);
  }
}

function runScheduledTriggers(db) {
  // due_date_passed — fires once per card per day
  const dueDateRules = db.prepare(
    "SELECT * FROM automation_rules WHERE trigger_type = 'due_date_passed' AND is_active = 1"
  ).all();

  if (dueDateRules.length) {
    const boardIds = [...new Set(dueDateRules.map(r => r.board_id))];
    for (const boardId of boardIds) {
      const cards = db.prepare(
        "SELECT * FROM cards WHERE board_id = ? AND due_date IS NOT NULL AND due_date < date('now')"
      ).all(boardId);
      for (const card of cards) {
        for (const rule of dueDateRules.filter(r => r.board_id === boardId)) {
          const ran = db.prepare(
            "SELECT 1 FROM automation_logs WHERE rule_id = ? AND card_id = ? AND executed_at > datetime('now', '-1 day')"
          ).get(rule.id, card.id);
          if (ran) continue;
          executeAction(rule.action_type, JSON.parse(rule.action_config || '{}'), card, db);
          logExecution(rule.id, card.id, db);
        }
      }
    }
  }

  // card_idle — fires once per card per day when not updated in N days
  const idleRules = db.prepare(
    "SELECT * FROM automation_rules WHERE trigger_type = 'card_idle' AND is_active = 1"
  ).all();

  for (const rule of idleRules) {
    const days = JSON.parse(rule.trigger_config || '{}').days || 3;
    const cards = db.prepare(
      `SELECT * FROM cards WHERE board_id = ? AND updated_at < datetime('now', '-${days} days')`
    ).all(rule.board_id);
    for (const card of cards) {
      const ran = db.prepare(
        "SELECT 1 FROM automation_logs WHERE rule_id = ? AND card_id = ? AND executed_at > datetime('now', '-1 day')"
      ).get(rule.id, card.id);
      if (ran) continue;
      executeAction(rule.action_type, JSON.parse(rule.action_config || '{}'), card, db);
      logExecution(rule.id, card.id, db);
    }
  }
}

module.exports = { runTrigger, runScheduledTriggers };
