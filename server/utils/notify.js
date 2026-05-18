const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const { sendNotificationEmail } = require('./email');

async function _notify(userId, type, message, cardId, boardId) {
  await db.prepare('INSERT INTO notifications (id, user_id, type, message, card_id, board_id) VALUES (?, ?, ?, ?, ?, ?)')
    .run(uuidv4(), userId, type, message, cardId || null, boardId || null);
  sendNotificationEmail(userId, type, message, cardId, boardId).catch(() => {});
}

function notify(userId, type, message, cardId, boardId) {
  _notify(userId, type, message, cardId, boardId).catch(() => {});
}

module.exports = { notify };
