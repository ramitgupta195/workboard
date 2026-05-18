require('dotenv').config({ path: require('path').join(__dirname, '.env') });
require('./db/schema');

const http = require('http');
const path = require('path');
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');
const db = require('./db/database');
const { runScheduledTriggers } = require('./engine/automations');
const { setIo } = require('./io');

// Load passport strategy (registers GoogleStrategy if env vars are set)
require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3001;

// In dev, allow Vite dev server; in production same-origin so CORS not needed for browser reqs
if (process.env.NODE_ENV !== 'production') {
  app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
}
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'workboard-session-secret',
  resave: false,
  saveUninitialized: false,
}));
app.use(passport.initialize());
app.use(passport.session());

// Serve uploaded files (use DATA_DIR volume path in production)
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

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// TEMPORARY: test email sending
app.get('/api/test-email', async (req, res) => {
  if (!process.env.ADMIN_KEY || req.query.key !== process.env.ADMIN_KEY) return res.status(403).json({ error: 'forbidden' });
  const to = req.query.to;
  if (!to) return res.status(400).json({ error: 'to required' });
  const nodemailer = require('nodemailer');
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return res.status(500).json({ error: 'GMAIL_USER or GMAIL_APP_PASSWORD not set', user: !!user, pass: !!pass });
  try {
    const t = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
    await t.sendMail({ from: `"Workboard" <${user}>`, to, subject: 'Workboard test email', html: '<p>It works!</p>' });
    res.json({ ok: true, sentTo: to });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// TEMPORARY: list registered users
app.get('/api/list-users', (req, res) => {
  if (!process.env.ADMIN_KEY || req.query.key !== process.env.ADMIN_KEY) return res.status(403).json({ error: 'forbidden' });
  const users = db.prepare('SELECT id, name, email FROM users').all();
  res.json(users);
});

// TEMPORARY: promote user to owner on all their boards
app.get('/api/fix-owner', (req, res) => {
  if (!process.env.ADMIN_KEY || req.query.key !== process.env.ADMIN_KEY) return res.status(403).json({ error: 'forbidden' });
  const email = req.query.email;
  if (!email) return res.status(400).json({ error: 'email required' });
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (!user) return res.status(404).json({ error: 'user not found' });
  const boards = db.prepare('SELECT board_id FROM board_members WHERE user_id = ?').all(user.id);
  db.prepare('UPDATE board_members SET role = ? WHERE user_id = ?').run('owner', user.id);
  db.prepare('UPDATE boards SET created_by = ? WHERE id IN (SELECT board_id FROM board_members WHERE user_id = ?)').run(user.id, user.id);
  res.json({ ok: true, boardsUpdated: boards.length });
});

// Serve React frontend in production (must come after all API routes)
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

// Create HTTP server and attach socket.io
const httpServer = http.createServer(app);
const { Server } = require('socket.io');
const socketCorsOrigin = process.env.NODE_ENV === 'production'
  ? (process.env.CLIENT_URL || true)
  : (process.env.CLIENT_URL || 'http://localhost:5173');
const io = new Server(httpServer, {
  cors: { origin: socketCorsOrigin, credentials: true },
});

setIo(io);

io.on('connection', socket => {
  socket.on('join:board', boardId => socket.join(`board:${boardId}`));
  socket.on('leave:board', boardId => socket.leave(`board:${boardId}`));
});

httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  setInterval(() => {
    try { runScheduledTriggers(db); } catch (err) { console.error('[scheduler]', err.message); }
  }, 60_000);
});

module.exports = { io };
