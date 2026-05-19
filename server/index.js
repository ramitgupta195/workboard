require('dotenv').config({ path: require('path').join(__dirname, '.env') });

// Fail fast with a clear message if the DB URL is missing
if (!process.env.DATABASE_URL) {
  console.error('FATAL: DATABASE_URL is not set. Set it in the Render dashboard under Environment.');
  process.exit(1);
}
console.log('[startup] DATABASE_URL prefix:', process.env.DATABASE_URL.slice(0, 30) + '...');

const http = require('http');
const path = require('path');
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');
const db = require('./db/database');
const initSchema = require('./db/schema');
const { runScheduledTriggers } = require('./engine/automations');
const { setIo } = require('./io');

// Load passport strategy (registers GoogleStrategy if env vars are set)
require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3001;

// Always enable CORS — in production the FE is on Vercel (different domain)
const corsOrigin = process.env.CLIENT_URL || 'http://localhost:5173';
app.use(cors({ origin: corsOrigin, credentials: true }));

app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'workboard-session-secret',
  resave: false,
  saveUninitialized: false,
}));
app.use(passport.initialize());
app.use(passport.session());

// Serve uploaded files
const UPLOADS_SERVE_DIR = process.env.DATA_DIR
  ? path.join(process.env.DATA_DIR, 'uploads')
  : path.join(__dirname, 'uploads');
app.use('/uploads', express.static(UPLOADS_SERVE_DIR));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/boards', require('./routes/boards'));
app.use('/api/columns', require('./routes/columns'));
app.use('/api/cards', require('./routes/cards'));
app.use('/api/comments', require('./routes/comments'));
app.use('/api/users', require('./routes/users'));
app.use('/api/automations', require('./routes/automations'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/search', require('./routes/search'));
app.use('/api/checklists', require('./routes/checklists'));
app.use('/api/my-tasks', require('./routes/myTasks'));
app.use('/api/invites', require('./routes/invites'));
app.use('/api/file-explorer', require('./routes/fileExplorer'));
app.use('/api/workspace', require('./routes/workspace'));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// TEMPORARY: test email sending
app.get('/api/test-email', async (req, res) => {
  if (!process.env.ADMIN_KEY || req.query.key !== process.env.ADMIN_KEY) return res.status(403).json({ error: 'forbidden' });
  const to = req.query.to;
  if (!to) return res.status(400).json({ error: 'to required' });
  const { sendEmail } = require('./utils/email');
  try {
    await sendEmail(to, 'Workboard test email', '<p>It works!</p>');
    res.json({ ok: true, sentTo: to });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// TEMPORARY: list registered users
app.get('/api/list-users', async (req, res) => {
  if (!process.env.ADMIN_KEY || req.query.key !== process.env.ADMIN_KEY) return res.status(403).json({ error: 'forbidden' });
  try {
    const users = await db.prepare('SELECT id, name, email FROM users').all();
    res.json(users);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// TEMPORARY: promote user to owner on all their boards
app.get('/api/fix-owner', async (req, res) => {
  if (!process.env.ADMIN_KEY || req.query.key !== process.env.ADMIN_KEY) return res.status(403).json({ error: 'forbidden' });
  const email = req.query.email;
  if (!email) return res.status(400).json({ error: 'email required' });
  try {
    const user = await db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (!user) return res.status(404).json({ error: 'user not found' });
    const boards = await db.prepare('SELECT board_id FROM board_members WHERE user_id = ?').all(user.id);
    await db.prepare('UPDATE board_members SET role = ? WHERE user_id = ?').run('owner', user.id);
    await db.prepare('UPDATE boards SET created_by = ? WHERE id IN (SELECT board_id FROM board_members WHERE user_id = ?)').run(user.id, user.id);
    res.json({ ok: true, boardsUpdated: boards.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// TEMPORARY: add a user to a board by email
app.get('/api/add-member', async (req, res) => {
  if (!process.env.ADMIN_KEY || req.query.key !== process.env.ADMIN_KEY) return res.status(403).json({ error: 'forbidden' });
  const { email, boardId, role = 'member' } = req.query;
  if (!email || !boardId) return res.status(400).json({ error: 'email and boardId required' });
  try {
    const user = await db.prepare('SELECT id, name FROM users WHERE email = ?').get(email);
    if (!user) return res.status(404).json({ error: 'user not found' });
    const board = await db.prepare('SELECT id, title FROM boards WHERE id = ?').get(boardId);
    if (!board) return res.status(404).json({ error: 'board not found' });
    const existing = await db.prepare('SELECT 1 FROM board_members WHERE board_id = ? AND user_id = ?').get(boardId, user.id);
    if (existing) return res.json({ ok: true, message: 'already a member', user: user.name, board: board.title });
    await db.prepare('INSERT INTO board_members (board_id, user_id, role) VALUES (?, ?, ?)').run(boardId, user.id, role);
    res.json({ ok: true, added: true, user: user.name, board: board.title, role });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Create HTTP server and attach socket.io
const httpServer = http.createServer(app);
const { Server } = require('socket.io');
const socketCorsOrigin = process.env.CLIENT_URL || 'http://localhost:5173';
const io = new Server(httpServer, {
  cors: { origin: socketCorsOrigin, credentials: true },
});

setIo(io);

io.on('connection', socket => {
  socket.on('join:board', boardId => socket.join(`board:${boardId}`));
  socket.on('leave:board', boardId => socket.leave(`board:${boardId}`));
  socket.on('join:user', userId => socket.join(`user:${userId}`));
});

async function main() {
  await initSchema();
  httpServer.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    setInterval(async () => {
      try { await runScheduledTriggers(); } catch (err) { console.error('[scheduler]', err.message); }
    }, 60_000);
  });
}

main().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

module.exports = { io };
