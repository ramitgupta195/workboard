const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const db = require('../db/database');
const authMiddleware = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'workboard-dev-secret';
const AVATAR_COLORS = ['#6366f1','#8b5cf6','#ec4899','#f43f5e','#f97316','#22c55e','#06b6d4','#3b82f6'];

function makeToken(user) {
  return jwt.sign(
    { id: user.id, name: user.name, email: user.email, avatar_color: user.avatar_color },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// ── Google OAuth strategy (only if credentials are configured) ───────────────
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3001/api/auth/google/callback',
    },
    (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        const googleId = profile.id;
        const name = profile.displayName || email?.split('@')[0] || 'User';

        let user = db.prepare('SELECT * FROM users WHERE google_id = ?').get(googleId);

        if (!user && email) {
          // Link to existing email/password account if email matches
          user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
          if (user) {
            db.prepare('UPDATE users SET google_id = ? WHERE id = ?').run(googleId, user.id);
            user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
          }
        }

        if (!user) {
          const id = uuidv4();
          const avatar_color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
          db.prepare('INSERT INTO users (id, name, email, password_hash, avatar_color, google_id) VALUES (?, ?, ?, ?, ?, ?)')
            .run(id, name, email || '', '', avatar_color, googleId);
          user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
        }

        return done(null, user);
      } catch (e) {
        return done(e);
      }
    }
  ));
}

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => done(null, db.prepare('SELECT * FROM users WHERE id = ?').get(id)));

// ── Email / password ─────────────────────────────────────────────────────────
router.post('/register', (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'All fields required' });

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(400).json({ error: 'Email already in use' });

  const id = uuidv4();
  const password_hash = bcrypt.hashSync(password, 10);
  const avatar_color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

  db.prepare('INSERT INTO users (id, name, email, password_hash, avatar_color) VALUES (?, ?, ?, ?, ?)')
    .run(id, name, email, password_hash, avatar_color);

  const token = makeToken({ id, name, email, avatar_color });
  res.json({ token, user: { id, name, email, avatar_color } });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

  if (!user || !user.password_hash || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = makeToken(user);
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, avatar_color: user.avatar_color } });
});

router.get('/me', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT id, name, email, avatar_color FROM users WHERE id = ?').get(req.user.id);
  res.json(user);
});

// ── Google OAuth ─────────────────────────────────────────────────────────────
router.get('/google', (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.status(503).json({ error: 'Google OAuth not configured' });
  }
  passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

router.get('/google/callback', (req, res, next) => {
  passport.authenticate('google', { session: false }, (err, user) => {
    if (err || !user) {
      return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/login?error=google`);
    }
    const token = makeToken(user);
    res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/auth/callback?token=${token}`);
  })(req, res, next);
});

module.exports = router;
