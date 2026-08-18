const path    = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') });
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });
const express = require('express');
const cors    = require('cors');

const app = express();

// Stripe webhook needs raw body BEFORE json middleware
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

// Global middleware
app.use(cors({
  origin: [
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'https://zarafiapp.com',
  'https://www.zarafiapp.com',
  'https://zarafi.vercel.app',
],
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/members',       require('./routes/members'));
app.use('/api/savings',       require('./routes/savings'));
app.use('/api/loans',         require('./routes/loans'));
app.use('/api/payments',      require('./routes/payments'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/admin',         require('./routes/admin'));

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../FRONTEND')));

app.get('/health', (req, res) => res.json({ status: 'healthy' }));

// 404 handler
app.use((req, res) => res.status(404).json({ error: `Route ${req.originalUrl} not found.` }));

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Zarafi API running on http://localhost:${PORT}`);
});