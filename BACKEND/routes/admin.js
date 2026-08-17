const express = require('express');
const db = require('../config/db');
const { protect, adminOnly } = require('../middleware/auth');

const router = express.Router();
router.get('/dashboard', protect, adminOnly, async (req, res) => {
  try {
    const [[members]]  = await db.query("SELECT COUNT(*) AS total, SUM(status='active') AS active, SUM(status='pending') AS pending FROM users WHERE role='member'");
    const [[savings]]  = await db.query("SELECT COALESCE(SUM(amount),0) AS total FROM savings WHERE status='confirmed'");
    const [[pens]]     = await db.query("SELECT COALESCE(SUM(amount),0) AS total FROM penalties");
    const [[pending]]  = await db.query("SELECT COUNT(*) AS total FROM loans WHERE status='pending'");
    const [[active]]   = await db.query("SELECT COUNT(*) AS total FROM loans WHERE status='active'");
    res.json({
      total_members:    members.total,
      active_members:   members.active,
      pending_members:  members.pending,
      total_savings:    parseFloat(savings.total),
      total_penalties:  parseFloat(pens.total),
      pending_loans:    pending.total,
      active_loans:     active.total,
    });
  } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});
// ── GET /api/admin/report ────────────────────────────────
router.get('/report', protect, adminOnly, async (req, res) => {
  try {
    const [[members]]  = await db.query("SELECT COUNT(*) AS total, SUM(status='active') AS active, SUM(status='pending') AS pending FROM users WHERE role='member'");
    const [[savings]]  = await db.query("SELECT COALESCE(SUM(amount),0) AS total FROM savings WHERE status='confirmed'");
    const [[loansIss]] = await db.query("SELECT COALESCE(SUM(amount),0) AS total FROM loans WHERE status IN ('active','completed')");
    const [[loansOut]] = await db.query("SELECT COALESCE(SUM(amount),0) AS total FROM loans WHERE status='active'");
    const [[repaid]]   = await db.query("SELECT COALESCE(SUM(amount_paid),0) AS total FROM repayments");
    const [[pens]]     = await db.query("SELECT COALESCE(SUM(amount),0) AS total FROM penalties");
    const [[pending]]  = await db.query("SELECT COUNT(*) AS total FROM loans WHERE status='pending'");
    const [[active]]   = await db.query("SELECT COUNT(*) AS total FROM loans WHERE status='active'");

    res.json({
      total_members:            members.total,
      active_members:           members.active,
      pending_members:          members.pending,
      total_savings:            parseFloat(savings.total),
      total_loans_issued:       parseFloat(loansIss.total),
      total_loans_outstanding:  parseFloat(loansOut.total),
      total_repayments_received:parseFloat(repaid.total),
      total_penalties:          parseFloat(pens.total),
      pending_loans:            pending.total,
      active_loans:             active.total,
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// ── GET /api/admin/defaulters ────────────────────────────
router.get('/defaulters', protect, adminOnly, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT r.id, r.loan_id, r.installment_number, r.amount_due, r.amount_paid,
              r.due_date, r.status, DATEDIFF(CURDATE(), r.due_date) AS days_overdue,
              u.first_name, u.last_name, u.email, u.phone
       FROM repayments r
       JOIN loans l ON l.id = r.loan_id
       JOIN users u ON u.id = l.borrower_id
       WHERE r.due_date < CURDATE() AND r.status != 'paid'
       ORDER BY days_overdue DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// ── GET /api/admin/member-summary ────────────────────────
router.get('/member-summary', protect, adminOnly, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT u.id, u.first_name, u.last_name, u.email, u.status,
              COALESCE(SUM(CASE WHEN s.status='confirmed' THEN s.amount ELSE 0 END),0) AS total_savings,
              COALESCE((SELECT SUM(amount) FROM loans WHERE borrower_id=u.id AND status IN ('active','completed')),0) AS total_loans,
              COALESCE((SELECT SUM(amount_paid) FROM repayments r2 JOIN loans l2 ON l2.id=r2.loan_id WHERE l2.borrower_id=u.id),0) AS total_repaid,
              COALESCE((SELECT SUM(amount) FROM penalties WHERE user_id=u.id),0) AS total_penalties
       FROM users u
       LEFT JOIN savings s ON s.user_id = u.id
       WHERE u.role='member'
       GROUP BY u.id ORDER BY total_savings DESC`
    );
    res.json(rows.map(r => ({
      ...r,
      max_loan_eligibility: parseFloat(r.total_savings) * 3
    })));
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
