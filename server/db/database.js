const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..');
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'workboard.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

module.exports = db;
