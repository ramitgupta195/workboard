const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const db = require('../db/database');
const authMiddleware = require('../middleware/auth');
const { sendEmail } = require('../utils/email');

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

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

// ── Password reset ───────────────────────────────────────────────────────────
router.post('/forgot-password', (req, res) => {
  const { email } = req.body;
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (user) {
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    db.prepare('INSERT INTO password_reset_tokens (token, user_id, expires_at) VALUES (?, ?, ?)')
      .run(token, user.id, expiresAt);
    const resetLink = `${CLIENT_URL}/reset-password?token=${token}`;
    sendEmail(email, 'Reset your Workboard password',
      `<p>Click the link below to reset your password. It expires in 1 hour.</p>
       <p><a href="${resetLink}">${resetLink}</a></p>
       <p>If you did not request this, ignore this email.</p>`
    );
  }
  res.json({ message: 'If that email exists, a reset link has been sent.' });
});

router.post('/reset-password', (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: 'Token and password are required' });

  const row = db.prepare('SELECT * FROM password_reset_tokens WHERE token = ?').get(token);
  if (!row) return res.status(400).json({ error: 'Invalid or expired token' });
  if (row.used) return res.status(400).json({ error: 'Token already used' });
  if (new Date(row.expires_at) < new Date()) return res.status(400).json({ error: 'Token expired' });

  const password_hash = bcrypt.hashSync(password, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(password_hash, row.user_id);
  db.prepare('UPDATE password_reset_tokens SET used = 1 WHERE token = ?').run(token);

  res.json({ message: 'Password updated' });
});

// ── Profile & password update (requires auth) ────────────────────────────────
router.put('/profile', authMiddleware, (req, res) => {
  const { name, avatar_color } = req.body;
  db.prepare('UPDATE users SET name = COALESCE(?, name), avatar_color = COALESCE(?, avatar_color) WHERE id = ?')
    .run(name || null, avatar_color || null, req.user.id);
  const user = db.prepare('SELECT id, name, email, avatar_color FROM users WHERE id = ?').get(req.user.id);
  res.json(user);
});

router.put('/change-password', authMiddleware, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Both currentPassword and newPassword are required' });

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user.password_hash) return res.status(400).json({ error: 'Cannot change password for Google-only accounts' });
  if (!bcrypt.compareSync(currentPassword, user.password_hash)) return res.status(400).json({ error: 'Current password is incorrect' });

  const password_hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(password_hash, req.user.id);
  res.json({ message: 'Password changed' });
});

// ── Email verification ────────────────────────────────────────────────────────
router.get('/verify-email', (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Token required' });

  const user = db.prepare('SELECT id FROM users WHERE verify_token = ?').get(token);
  if (!user) return res.status(400).json({ error: 'Invalid or already used verification token' });

  db.prepare("UPDATE users SET email_verified = 1, verify_token = NULL WHERE id = ?").run(user.id);
  res.redirect(`${CLIENT_URL}/?verified=1`);
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
