const express = require('express');
const db      = require('../config/db');
const { protect, adminOnly } = require('../middleware/auth');
const { notify } = require('../utils/helpers');

const router = express.Router();

// ── GET /api/notifications ───────────────────────────────
router.get('/', protect, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 50',
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// ── PATCH /api/notifications/read-all ───────────────────
router.patch('/read-all', protect, async (req, res) => {
  await db.query('UPDATE notifications SET is_read=1 WHERE user_id=?', [req.user.id]);
  res.json({ message: 'All notifications marked as read.' });
});

// ── PATCH /api/notifications/:id/read ───────────────────
router.patch('/:id/read', protect, async (req, res) => {
  await db.query('UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
  res.json({ message: 'Marked as read.' });
});

// ── POST /api/notifications/announce  (admin) ────────────
router.post('/announce', protect, adminOnly, async (req, res) => {
  const { title, body: bodyText } = req.body;
  if (!title || !bodyText) return res.status(400).json({ error: 'title and body are required.' });

  try {
    const [ann] = await db.query(
      'INSERT INTO announcements (title, body, created_by) VALUES (?,?,?)',
      [title, bodyText, req.user.id]
    );

    // Send to all active members
    const [members] = await db.query("SELECT id FROM users WHERE status='active' AND role='member'");
    for (const m of members) await notify(m.id, title, bodyText, 'general');

    res.status(201).json({ id: ann.insertId, title, body: bodyText, sent_to: members.length });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// ── GET /api/notifications/announcements ────────────────
router.get('/announcements', protect, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT a.*, u.first_name, u.last_name
       FROM announcements a JOIN users u ON u.id = a.created_by
       ORDER BY a.created_at DESC LIMIT 20`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;