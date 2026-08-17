const express = require('express');
const db = require('../config/db');
const { protect } = require('../middleware/auth');
const { notify } = require('../utils/helpers');

const router = express.Router();

let stripe;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
}

// Create Stripe payment intent
router.post('/create-intent', protect, async (req, res) => {
  if (!stripe) return res.status(500).json({ error: 'Stripe is not configured yet.' });

  const { amount, payment_type, reference_id } = req.body;

if (!amount || !payment_type)
  return res.status(400).json({ error: 'amount and payment_type are required.' });

if (parseFloat(amount) <= 0)
  return res.status(400).json({ error: 'Amount must be greater than zero.' });

try {
  const intent = await stripe.paymentIntents.create({
    amount: Math.round(parseFloat(amount) * 100),
    currency: 'aud',  // ← changed from usd to aud
    metadata: {
      user_id:      String(req.user.id),
      payment_type,
      reference_id: String(reference_id || ''),
    },
  });

    await db.query(
      'INSERT INTO payments (user_id, amount, payment_type, reference_id, stripe_payment_id, stripe_status) VALUES (?,?,?,?,?,?)',
      [req.user.id, amount, payment_type, reference_id || null, intent.id, 'pending']
    );

    res.json({ clientSecret: intent.client_secret, paymentIntentId: intent.id });
  } catch (err) {
    console.error('Stripe error:', err.message);
    res.status(500).json({ error: 'Could not create payment. ' + err.message });
  }
});

// Stripe webhook
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe) return res.status(500).json({ error: 'Stripe not configured.' });

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'payment_intent.succeeded') {
    const pi       = event.data.object;
    const { user_id, payment_type, reference_id } = pi.metadata;
    const amount   = pi.amount / 100;

    try {
      await db.query(
        "UPDATE payments SET stripe_status='succeeded' WHERE stripe_payment_id=?", [pi.id]
      );

      if (payment_type === 'savings') {
        const today = new Date().toISOString().split('T')[0];
        await db.query(
          "INSERT INTO savings (user_id, amount, week_date, status) VALUES (?,?,?,'confirmed')",
          [user_id, amount, today]
        );
        await notify(user_id, 'Savings Confirmed',
          `Your savings of A$${amount.toFixed(2)} have been confirmed.`
        );
      }

      if (payment_type === 'loan_repayment' && reference_id) {
        const [[rep]] = await db.query(
          'SELECT amount_paid, amount_due FROM repayments WHERE id=?', [reference_id]
        );
        if (rep) {
          const newPaid   = parseFloat(rep.amount_paid) + amount;
          const newStatus = newPaid >= parseFloat(rep.amount_due) ? 'paid' : 'partial';
          await db.query(
            'UPDATE repayments SET amount_paid=?, status=?, paid_at=NOW() WHERE id=?',
            [newPaid.toFixed(2), newStatus, reference_id]
          );
          await notify(user_id, 'Repayment Received',
            `Your repayment of A$${amount.toFixed(2)} has been received.`, 'repayment'
          );
        }
      }
    } catch (err) {
      console.error('Webhook processing error:', err);
    }
  }

  res.json({ received: true });
});

// My payment history
router.get('/me', protect, async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM payments WHERE user_id=? AND stripe_status='succeeded' ORDER BY created_at DESC",
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// All payments (admin)
router.get('/all', protect, async (req, res) => {
  if (req.user.role !== 'admin')
    return res.status(403).json({ error: 'Admin only.' });
  try {
    const [rows] = await db.query(
      `SELECT p.*, u.first_name, u.last_name
       FROM payments p JOIN users u ON u.id = p.user_id
       ORDER BY p.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;