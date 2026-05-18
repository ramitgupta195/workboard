const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const { sendNotificationEmail } = require('./email');

function notify(userId, type, message, cardId, boardId) {
  try {
    db.prepare('INSERT INTO notifications (id, user_id, type, message, card_id, board_id) VALUES (?, ?, ?, ?, ?, ?)')
      .run(uuidv4(), userId, type, message, cardId || null, boardId || null);
    sendNotificationEmail(userId, type, message, cardId, boardId);
  } catch (_) {}
}

module.exports = { notify };
