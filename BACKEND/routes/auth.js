// routes/auth.js
const express      = require('express');
const bcrypt       = require('bcryptjs');
const jwt          = require('jsonwebtoken');
const db           = require('../config/db');
const { protect }  = require('../middleware/auth');
const crypto       = require('crypto');
const nodemailer   = require('nodemailer');         // ← ADD THIS
const router       = express.Router();

// Email transporter — created once, used for all emails
const transporter  = nodemailer.createTransport({  // ← ADD THIS BLOCK
  host:   process.env.EMAIL_HOST,
  port:   parseInt(process.env.EMAIL_PORT),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});
// ── REGISTER ─────────────────────────────────────────────────
router.post('/register', async (req, res) => {
const { first_name, last_name, email, password, phone, join_reason } = req.body;
if (!first_name || !last_name || !email || !password || !phone) {
      return res.status(400).json({ error: 'All fields are required.' });
  }

  try {
    // Check if email already exists
    const [existing] = await db.query(
      'SELECT id FROM users WHERE email = ?', [email]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    // ✅ Auto-hash the password — member never needs to do this manually
    const password_hash = await bcrypt.hash(password, 10);

    await db.query(
      `INSERT INTO users 
        (first_name, last_name, email, password_hash, phone, join_reason, role, status)
       VALUES (?, ?, ?, ?, ?, ?, 'member', 'pending')`,
      [first_name, last_name, email, password_hash, phone, join_reason || null]
    );

    res.status(201).json({ message: 'Application submitted. Awaiting admin approval.' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// ── LOGIN ─────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    const [rows] = await db.query(
      'SELECT * FROM users WHERE email = ?', [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = rows[0];

    // ✅ Check password against stored hash
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // ✅ Block pending/suspended members from logging in
    if (user.status === 'pending') {
      return res.status(403).json({ error: 'Your account is pending admin approval.' });
    }
    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'Your account has been suspended. Contact admin.' });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      token,
      user: {
        id:            user.id,
        first_name:    user.first_name,
        last_name:     user.last_name,
        email:         user.email,
        role:          user.role,
        total_savings: user.total_savings || 0,
        max_loan:      user.max_loan      || 0,
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// ── GET CURRENT USER ──────────────────────────────────────────
router.get('/me', protect, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT u.id, u.first_name, u.last_name, u.email, u.phone, 
              u.role, u.status,
              COALESCE(SUM(CASE WHEN s.status='confirmed' THEN s.amount ELSE 0 END), 0) AS total_savings
       FROM users u
       LEFT JOIN savings s ON s.user_id = u.id
       WHERE u.id = ?
       GROUP BY u.id`,
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found.' });

    const user = rows[0];
    user.max_loan = parseFloat(user.total_savings) * 3;

    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch profile.' });
  }
});
// ── FORGOT PASSWORD ───────────────────────────────────────────
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required.' });

  try {
    const [rows] = await db.query('SELECT id FROM users WHERE email = ?', [email]);

    // Always return success — don't reveal if email exists
    if (!rows.length) return res.json({ message: 'If that email exists, a reset link has been sent.' });

    const token   = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

    await db.query(
      'UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE email = ?',
      [token, expires, email]
    );

const resetLink = `${process.env.CLIENT_URL}/login.html?token=${token}`;

await transporter.sendMail({
  from:    `"Zarafi" <${process.env.EMAIL_USER}>`,
  to:      email,
  subject: 'Reset your Zarafi password',
  html: `
    <div style="font-family:sans-serif;max-width:480px;margin:auto">
      <h2>Reset your password</h2>
      <p>Click the button below to reset your Zarafi password. This link expires in 1 hour.</p>
      <a href="${resetLink}" style="display:inline-block;background:#d4a847;color:#08080e;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">
        Reset Password →
      </a>
      <p style="color:#999;font-size:12px;margin-top:24px">If you didn't request this, ignore this email.</p>
    </div>
  `,
});

res.json({ message: 'If that email exists, a reset link has been sent.' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// ── RESET PASSWORD ────────────────────────────────────────────
router.post('/reset-password', async (req, res) => {
  const { token, new_password } = req.body;
  if (!token || !new_password)  return res.status(400).json({ error: 'Token and new password are required.' });
  if (new_password.length < 6)  return res.status(400).json({ error: 'Password must be at least 6 characters.' });

  try {
    const [rows] = await db.query(
      'SELECT id FROM users WHERE reset_token = ? AND reset_token_expires > NOW()',
      [token]
    );

    if (!rows.length) return res.status(400).json({ error: 'Reset link is invalid or has expired.' });

    const hash = await bcrypt.hash(new_password, 10);
    await db.query(
      'UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?',
      [hash, rows[0].id]
    );

    res.json({ message: 'Password reset successfully. You can now log in.' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;