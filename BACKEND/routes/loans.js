const express = require('express');
const db      = require('../config/db');
const { protect, adminOnly } = require('../middleware/auth');
const { notify, buildSchedule, getUserSavings } = require('../utils/helpers');

const router = express.Router();

// Apply for a loan
router.post('/apply', protect, async (req, res) => {
  const { amount, loan_type, purpose, guarantor_ids } = req.body;
  const validTypes = ['2_weeks','1_month','2_months','3_months'];

  if (!amount || !loan_type || !guarantor_ids?.length)
    return res.status(400).json({ error: 'amount, loan_type and at least one guarantor_id are required.' });
  if (!validTypes.includes(loan_type))
    return res.status(400).json({ error: 'Invalid loan type.' });

  try {
    const totalSavings = await getUserSavings(req.user.id);
    const maxLoan = totalSavings * 3;
    if (parseFloat(amount) > maxLoan)
      return res.status(400).json({ error: `Loan exceeds your limit of A$${maxLoan.toFixed(2)}.` });

    const [[active]] = await db.query(
      "SELECT id FROM loans WHERE borrower_id=? AND status IN ('pending','approved','active')",
      [req.user.id]
    );
    if (active) return res.status(400).json({ error: 'You already have an active or pending loan.' });

    for (const gid of guarantor_ids) {
      if (gid === req.user.id) return res.status(400).json({ error: 'You cannot be your own guarantor.' });
      const [[g]] = await db.query("SELECT id FROM users WHERE id=? AND status='active'", [gid]);
      if (!g) return res.status(400).json({ error: `Guarantor ID ${gid} is not a valid active member.` });
    }

    const [result] = await db.query(
      'INSERT INTO loans (borrower_id, amount, loan_type, purpose) VALUES (?,?,?,?)',
      [req.user.id, amount, loan_type, purpose || null]
    );
    const loanId = result.insertId;

    for (const gid of guarantor_ids) {
      await db.query('INSERT INTO loan_guarantors (loan_id, guarantor_id) VALUES (?,?)', [loanId, gid]);
      await notify(gid, 'Guarantor Request',
        `A member has listed you as a guarantor for a A$${parseFloat(amount).toFixed(2)} loan.`, 'loan'
      );
    }

    // Loans within the savings×3 limit are now auto-approved and auto-disbursed —
    // no manual admin review step. The savings×3 check above already gatekeeps eligibility.
    const now = new Date();
    await db.query(
      "UPDATE loans SET status='active', approved_at=?, disbursed_at=? WHERE id=?",
      [now, now, loanId]
    );

    const schedule = buildSchedule(amount, loan_type, now);
    for (const s of schedule)
      await db.query(
        'INSERT INTO repayments (loan_id, installment_number, amount_due, due_date) VALUES (?,?,?,?)',
        [loanId, s.n, s.amt, s.due]
      );

    await notify(req.user.id, 'Loan Approved & Disbursed',
      `Your loan of A$${parseFloat(amount).toFixed(2)} has been approved and disbursed. Check your repayment schedule.`, 'loan'
    );

    const [admins] = await db.query("SELECT id FROM users WHERE role='admin'");
    for (const admin of admins)
      await notify(admin.id, 'Loan Auto-Approved',
        `A A$${parseFloat(amount).toFixed(2)} loan was automatically approved and disbursed.`, 'loan'
      );

    const [[loan]] = await db.query('SELECT * FROM loans WHERE id=?', [loanId]);
    res.status(201).json(loan);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// My loans
router.get('/me', protect, async (req, res) => {
  try {
    const [loans] = await db.query(
      'SELECT * FROM loans WHERE borrower_id=? ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(loans);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// My repayment schedule
router.get('/me/schedule', protect, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT r.* FROM repayments r
       JOIN loans l ON l.id = r.loan_id
       WHERE l.borrower_id=? AND l.status='active'
       ORDER BY r.due_date ASC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// All loans (admin)
router.get('/all', protect, adminOnly, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT l.*, u.first_name, u.last_name, u.email
       FROM loans l JOIN users u ON u.id = l.borrower_id
       ORDER BY l.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// Get one loan
router.get('/:id', protect, async (req, res) => {
  try {
    const [[loan]] = await db.query('SELECT * FROM loans WHERE id=?', [req.params.id]);
    if (!loan) return res.status(404).json({ error: 'Loan not found.' });
    if (req.user.role !== 'admin' && loan.borrower_id !== req.user.id)
      return res.status(403).json({ error: 'Access denied.' });

    const [guarantors] = await db.query(
      `SELECT u.id, u.first_name, u.last_name, lg.accepted
       FROM loan_guarantors lg JOIN users u ON u.id = lg.guarantor_id
       WHERE lg.loan_id=?`, [req.params.id]
    );
    const [repayments] = await db.query(
      'SELECT * FROM repayments WHERE loan_id=? ORDER BY installment_number',
      [req.params.id]
    );
    res.json({ ...loan, guarantors, repayments });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// Approve / reject / disburse (admin)
router.patch('/:id/status', protect, adminOnly, async (req, res) => {
  const { status } = req.body;
  const valid = ['approved','active','rejected','completed'];
  if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status.' });

  try {
    const [[loan]] = await db.query('SELECT * FROM loans WHERE id=?', [req.params.id]);
    if (!loan) return res.status(404).json({ error: 'Loan not found.' });

    const updates = { status };
    if (status === 'approved') { updates.approved_by = req.user.id; updates.approved_at = new Date(); }
    if (status === 'active')   { updates.disbursed_at = new Date(); }

    await db.query('UPDATE loans SET ? WHERE id=?', [updates, loan.id]);

    if (status === 'active') {
      const schedule = buildSchedule(loan.amount, loan.loan_type, new Date());
      for (const s of schedule)
        await db.query(
          'INSERT INTO repayments (loan_id, installment_number, amount_due, due_date) VALUES (?,?,?,?)',
          [loan.id, s.n, s.amt, s.due]
        );
      await notify(loan.borrower_id, 'Loan Disbursed',
        `Your loan of A$${parseFloat(loan.amount).toFixed(2)} has been disbursed. Check your repayment schedule.`, 'loan'
      );
    }
    if (status === 'approved')
      await notify(loan.borrower_id, 'Loan Approved',
        `Your loan of $${parseFloat(loan.amount).toFixed(2)} has been approved!`, 'loan'
      );
    if (status === 'rejected')
      await notify(loan.borrower_id, 'Loan Rejected',
        `Your loan application was not approved. Contact admin for details.`, 'loan'
      );

    const [[updated]] = await db.query('SELECT * FROM loans WHERE id=?', [loan.id]);
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// Record repayment (admin)
router.post('/:id/repay/:repaymentId', protect, adminOnly, async (req, res) => {
  const { amount } = req.body;
  if (!amount) return res.status(400).json({ error: 'amount is required.' });

  try {
    const [[rep]] = await db.query(
      'SELECT * FROM repayments WHERE id=? AND loan_id=?',
      [req.params.repaymentId, req.params.id]
    );
    if (!rep) return res.status(404).json({ error: 'Repayment not found.' });

    const newPaid  = parseFloat(rep.amount_paid) + parseFloat(amount);
    const newStatus = newPaid >= parseFloat(rep.amount_due) ? 'paid' : 'partial';
    await db.query(
      'UPDATE repayments SET amount_paid=?, status=?, paid_at=NOW() WHERE id=?',
      [newPaid.toFixed(2), newStatus, rep.id]
    );

    const [[{ remaining }]] = await db.query(
      "SELECT COUNT(*) AS remaining FROM repayments WHERE loan_id=? AND status != 'paid'",
      [req.params.id]
    );
    if (remaining === 0) {
      await db.query("UPDATE loans SET status='completed' WHERE id=?", [req.params.id]);
      const [[loan]] = await db.query('SELECT borrower_id FROM loans WHERE id=?', [req.params.id]);
      await notify(loan.borrower_id, 'Loan Fully Repaid',
        'Congratulations! You have completely repaid your loan.', 'loan'
      );
    }

    const [[updated]] = await db.query('SELECT * FROM repayments WHERE id=?', [rep.id]);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// Defaulters (admin)
router.get('/admin/defaulters', protect, adminOnly, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT r.*, l.amount AS loan_amount, u.first_name, u.last_name, u.email,
              DATEDIFF(CURDATE(), r.due_date) AS days_overdue
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

module.exports = router;