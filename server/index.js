require('./db/schema');

const express = require('express');
const cors = require('cors');
const db = require('./db/database');
const { runScheduledTriggers } = require('./engine/automations');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());

app.use('/api/auth', require('./routes/auth'));
app.use('/api/boards', require('./routes/boards'));
app.use('/api/columns', require('./routes/columns'));
app.use('/api/cards', require('./routes/cards'));
app.use('/api/comments', require('./routes/comments'));
app.use('/api/users', require('./routes/users'));
app.use('/api/automations', require('./routes/automations'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/search', require('./routes/search'));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);

  // Run scheduled automation triggers every 60 seconds
  setInterval(() => {
    try { runScheduledTriggers(db); } catch (err) { console.error('[scheduler]', err.message); }
  }, 60_000);
});
