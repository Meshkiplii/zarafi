const express = require('express');
const bcrypt  = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const db      = require('../config/db');
const { protect, adminOnly } = require('../middleware/auth');

const router = express.Router();

// ── GET /api/members  (admin) ────────────────────────────
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT u.id, u.first_name, u.last_name, u.email, u.phone,
              u.role, u.status, u.created_at,
              COALESCE(SUM(CASE WHEN s.status='confirmed' THEN s.amount ELSE 0 END),0) AS total_savings
       FROM users u
       LEFT JOIN savings s ON s.user_id = u.id
       GROUP BY u.id ORDER BY u.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// ── GET /api/members/:id  (admin) ────────────────────────
router.get('/:id', protect, adminOnly, async (req, res) => {
  try {
    const [[user]] = await db.query(
      `SELECT u.*, COALESCE(SUM(CASE WHEN s.status='confirmed' THEN s.amount ELSE 0 END),0) AS total_savings
       FROM users u LEFT JOIN savings s ON s.user_id = u.id
       WHERE u.id = ? GROUP BY u.id`,
      [req.params.id]
    );
    if (!user) return res.status(404).json({ error: 'Member not found.' });
    user.max_loan = parseFloat(user.total_savings) * 3;
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// ── PATCH /api/members/:id/status  (admin) ───────────────
router.patch('/:id/status', protect, adminOnly, async (req, res) => {
  const { status } = req.body;
  const valid = ['active', 'pending', 'suspended'];
  if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status.' });

  try {
    await db.query('UPDATE users SET status = ? WHERE id = ?', [status, req.params.id]);
    const [[user]] = await db.query('SELECT id, first_name, last_name, email, status FROM users WHERE id = ?', [req.params.id]);

    if (status === 'active') {
      const { notify } = require('../utils/helpers');
      await notify(user.id, 'Account Activated',
        `Welcome to Zarafi, ${user.first_name}! Your account has been activated. You can now start making weekly contributions.`
      );
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// ── PUT /api/members/profile  (self) ─────────────────────
router.put('/profile', protect, [
  body('first_name').optional().trim().notEmpty(),
  body('last_name').optional().trim().notEmpty(),
  body('phone').optional().trim(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { first_name, last_name, phone } = req.body;
  try {
    await db.query(
      'UPDATE users SET first_name=COALESCE(?,first_name), last_name=COALESCE(?,last_name), phone=COALESCE(?,phone) WHERE id=?',
      [first_name || null, last_name || null, phone || null, req.user.id]
    );
    const [[user]] = await db.query('SELECT id,first_name,last_name,email,phone FROM users WHERE id=?', [req.user.id]);
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// ── PUT /api/members/password  (self) ────────────────────
router.put('/password', protect, [
  body('current_password').notEmpty(),
  body('new_password').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { current_password, new_password } = req.body;
  try {
    const [[user]] = await db.query('SELECT password_hash FROM users WHERE id=?', [req.user.id]);
    const match = await bcrypt.compare(current_password, user.password_hash);
    if (!match) return res.status(400).json({ error: 'Current password is incorrect.' });

    const hash = await bcrypt.hash(new_password, 10);
    await db.query('UPDATE users SET password_hash=? WHERE id=?', [hash, req.user.id]);
    res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
