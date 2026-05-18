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

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'workboard-session-secret',
  resave: false,
  saveUninitialized: false,
}));
app.use(passport.initialize());
app.use(passport.session());

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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

// Create HTTP server and attach socket.io
const httpServer = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  },
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
