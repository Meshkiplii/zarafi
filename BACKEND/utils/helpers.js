const db = require('../config/db');

const notify = async (userId, title, message, type = 'general') => {
  await db.query(
    'INSERT INTO notifications (user_id, title, message, notif_type) VALUES (?, ?, ?, ?)',
    [userId, title, message, type]
  );
};

const buildSchedule = (amount, loanType, startDate) => {
  const schedules = [];
  const start = new Date(startDate);
  const addDays   = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
  const addMonths = (d, n) => { const r = new Date(d); r.setMonth(r.getMonth() + n); return r; };
  const fmt       = (d) => d.toISOString().split('T')[0];

  switch (loanType) {
    case '2_weeks':
      schedules.push({ n: 1, amt: amount, due: fmt(addDays(start, 14)) }); break;
    case '1_month':
      schedules.push({ n: 1, amt: amount, due: fmt(addDays(start, 28)) }); break;
    case '2_months':
      const i2 = (amount / 4).toFixed(2);
      for (let i = 1; i <= 4; i++) schedules.push({ n: i, amt: i2, due: fmt(addDays(start, i * 14)) });
      break;
    case '3_months':
      const i3 = (amount / 3).toFixed(2);
      for (let i = 1; i <= 3; i++) schedules.push({ n: i, amt: i3, due: fmt(addMonths(start, i)) });
      break;
  }
  return schedules;
};

const getUserSavings = async (userId) => {
  const [[row]] = await db.query(
    "SELECT COALESCE(SUM(amount),0) AS total FROM savings WHERE user_id = ? AND status = 'confirmed'",
    [userId]
  );
  return parseFloat(row.total);
};

module.exports = { notify, buildSchedule, getUserSavings };
