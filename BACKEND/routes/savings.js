const express = require('express');
const db      = require('../config/db');
const { protect, adminOnly } = require('../middleware/auth');
const { notify } = require('../utils/helpers');

const router = express.Router();

// ── POST /api/savings  — record contribution (admin) ─────
router.post('/', protect, adminOnly, async (req, res) => {
  const { user_id, amount, week_date, notes } = req.body;
  if (!user_id || !amount || !week_date)
    return res.status(400).json({ error: 'user_id, amount and week_date are required.' });
  try {
    const [result] = await db.query(
      'INSERT INTO savings (user_id, amount, week_date, status, notes, recorded_by) VALUES (?,?,?,?,?,?)',
      [user_id, amount, week_date, 'confirmed', notes || null, req.user.id]
    );
    await notify(user_id, 'Savings Recorded',
      `Your contribution of A$${parseFloat(amount).toFixed(2)} for week of ${week_date} has been recorded.`
    );
    const [[saving]] = await db.query('SELECT * FROM savings WHERE id=?', [result.insertId]);
    res.status(201).json(saving);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// ── GET /api/savings/me  — my history ────────────────────
router.get('/me', protect, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM savings WHERE user_id=? ORDER BY week_date DESC',
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// ── GET /api/savings/all  (admin) ────────────────────────
router.get('/all', protect, adminOnly, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT s.*, u.first_name, u.last_name
       FROM savings s JOIN users u ON u.id = s.user_id
       ORDER BY s.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// ── GET /api/savings/member/:id  (admin) ─────────────────
router.get('/member/:id', protect, adminOnly, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM savings WHERE user_id=? ORDER BY week_date DESC',
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// ── POST /api/savings/flag-missed  (admin) ───────────────
router.post('/flag-missed', protect, adminOnly, async (req, res) => {
  const { user_id, week_date } = req.body;
  if (!user_id || !week_date)
    return res.status(400).json({ error: 'user_id and week_date are required.' });

  try {
    await db.query(
      'INSERT INTO savings (user_id, amount, week_date, status, recorded_by) VALUES (?,0,?,?,?)',
      [user_id, week_date, 'missed', req.user.id]
    );
    await db.query(
      'INSERT INTO penalties (user_id, amount, week_date) VALUES (?,50,?)',
      [user_id, week_date]
    );
    await notify(user_id, 'Missed Contribution — Penalty Applied',
      `You missed your weekly contribution for ${week_date}. A A$50 penalty has been applied to your account.`,
      'penalty'
    );
    res.status(201).json({ message: 'Member flagged. $50 penalty applied and notification sent.' });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// ── GET /api/savings/penalties/me ────────────────────────
router.get('/penalties/me', protect, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM penalties WHERE user_id=? ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// ── GET /api/savings/penalties/all  (admin) ───────────────
router.get('/penalties/all', protect, adminOnly, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT p.*, u.first_name, u.last_name
       FROM penalties p JOIN users u ON u.id = p.user_id
       ORDER BY p.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
