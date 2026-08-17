// ============================================================
// ZARAFI — app.js  (complete working version)
// ============================================================

const API_URL = 'http://localhost:5000/api';
const STRIPE_PK = 'pk_test_51TWNGHEo39TOLmD52j9eABIzwvm4bmjipM63pANbRspnfBBfLkPiQMjz7RlSj4wxnHZcMdh95AFBDgQZLNf7UlR400Beid5pls'; // your publishable key
let stripeInstance = null;

// Initialize Stripe
function initStripe() {
  if (!stripeInstance) stripeInstance = Stripe(STRIPE_PK);
  return stripeInstance;
}
// ── Session helpers ──────────────────────────────────────────
function getToken() { return localStorage.getItem('zarafi_token'); }
function getUser()  { const u = localStorage.getItem('zarafi_user'); return u ? JSON.parse(u) : null; }

function logout() {
  localStorage.removeItem('zarafi_token');
  localStorage.removeItem('zarafi_user');
  window.location.href = 'login.html';
}

// ── Base fetch ───────────────────────────────────────────────
async function apiFetch(endpoint, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res  = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
  const data = await res.json();

  if (res.status === 401) { logout(); return; }
  if (!res.ok) throw new Error(data.error || data.errors?.[0]?.msg || 'Something went wrong.');
  return data;
}
// ── AUTH — LOGIN & SIGNUP ────────────────────────────────────
async function doLogin() {
  const email    = document.getElementById('login-email')?.value.trim();
  const password = document.getElementById('login-password')?.value;
  const btn      = document.getElementById('login-btn');
  const errEl    = document.getElementById('login-err');

  if (errEl) errEl.style.display = 'none';

  if (!email || !password) {
    if (errEl) { errEl.textContent = 'Please enter your email and password.'; errEl.style.display = 'block'; }
    return;
  }

  if (btn) { btn.disabled = true; btn.textContent = 'Signing in…'; }

  try {
    const res  = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const json = await res.json();

    if (!res.ok) {
      if (errEl) { errEl.textContent = json.error || 'Login failed.'; errEl.style.display = 'block'; }
      return;
    }

    localStorage.setItem('zarafi_token', json.token);
    localStorage.setItem('zarafi_user',  JSON.stringify(json.user));
    window.location.href = json.user.role === 'admin' ? 'admin.html' : 'member.html';

  } catch (err) {
    if (errEl) { errEl.textContent = 'Could not reach server. Is it running?'; errEl.style.display = 'block'; }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Sign In →'; }
  }
}

async function doForgot() {
  const email = document.getElementById('forgot-email')?.value.trim();
  const btn   = document.getElementById('forgot-btn');
  const errEl = document.getElementById('forgot-err');
  const okEl  = document.getElementById('forgot-ok');

  errEl.style.display = 'none';
  okEl.style.display  = 'none';

  if (!email) { errEl.textContent = 'Please enter your email.'; errEl.style.display = 'block'; return; }

  if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }

  try {
    const res  = await fetch(`${API_URL}/auth/forgot-password`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const json = await res.json();
    okEl.textContent   = json.message;
    okEl.style.display = 'block';
  } catch (err) {
    errEl.textContent   = 'Could not reach server.';
    errEl.style.display = 'block';
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Send Reset Link →'; }
  }
}

async function doReset() {
  const token    = new URLSearchParams(window.location.search).get('token');
  const password = document.getElementById('reset-pass')?.value;
  const btn      = document.getElementById('reset-btn');
  const errEl    = document.getElementById('reset-err');
  const okEl     = document.getElementById('reset-ok');

  errEl.style.display = 'none';
  okEl.style.display  = 'none';

  if (!token) { errEl.textContent = 'Invalid reset link.'; errEl.style.display = 'block'; return; }
  if (!password || password.length < 6) { errEl.textContent = 'Password must be at least 6 characters.'; errEl.style.display = 'block'; return; }

  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

  try {
    const res  = await fetch(`${API_URL}/auth/reset-password`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, new_password: password })
    });
    const json = await res.json();
    if (!res.ok) { errEl.textContent = json.error; errEl.style.display = 'block'; return; }
    okEl.textContent   = json.message + ' Redirecting to login…';
    okEl.style.display = 'block';
    setTimeout(() => switchTab('login'), 2500);
  } catch (err) {
    errEl.textContent   = 'Could not reach server.';
    errEl.style.display = 'block';
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Save New Password →'; }
  }
}

async function doSignup() {
  const first_name  = document.getElementById('s-fname')?.value.trim();
  const last_name   = document.getElementById('s-lname')?.value.trim();
  const email       = document.getElementById('s-email')?.value.trim();
  const phone       = document.getElementById('s-phone')?.value.trim();
  const password    = document.getElementById('s-pass')?.value;
  const join_reason = document.getElementById('s-reason')?.value.trim();
  const btn         = document.getElementById('signup-btn');
  const errEl       = document.getElementById('signup-err');
  const okEl        = document.getElementById('signup-ok');

  if (errEl) errEl.style.display = 'none';
  if (okEl)  okEl.style.display  = 'none';

  if (!first_name || !last_name || !email || !phone || !password) {
    if (errEl) { errEl.textContent = 'Please fill in all required fields.'; errEl.style.display = 'block'; }
    return;
  }
  if (password.length < 6) {
    if (errEl) { errEl.textContent = 'Password must be at least 6 characters.'; errEl.style.display = 'block'; }
    return;
  }

  if (btn) { btn.disabled = true; btn.textContent = 'Submitting…'; }

  try {
    const res  = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ first_name, last_name, email, phone, password, join_reason }),
    });
    const json = await res.json();

    if (!res.ok) {
      if (errEl) { errEl.textContent = json.error || 'Registration failed.'; errEl.style.display = 'block'; }
      return;
    }

    if (okEl) okEl.style.display = 'block';
    if (btn)  btn.style.display  = 'none';
    ['s-fname','s-lname','s-email','s-phone','s-pass','s-reason']
      .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });

  } catch (err) {
    if (errEl) { errEl.textContent = 'Could not reach server. Is it running?'; errEl.style.display = 'block'; }
  } finally {
    if (btn && btn.style.display !== 'none') { btn.disabled = false; btn.textContent = 'Submit Application →'; }
  }
}
// ── Auth guard ───────────────────────────────────────────────
function requireAuth(role) {
  const user = getUser();
  if (!user || !getToken()) { window.location.href = 'login.html'; return null; }
  if (role && user.role !== role) {
    window.location.href = user.role === 'admin' ? 'admin.html' : 'member.html';
    return null;
  }
  return user;
}

// ── Badge helper ─────────────────────────────────────────────
function badge(status) {
  return `<span class="badge ${status}">${status}</span>`;
}

// ── Date formatter ───────────────────────────────────────────
function fmtDate(d) {
  if (!d) return '—';
return new Date(d).toLocaleDateString('en-AU', { day:'numeric', month:'short', year:'numeric' });}

// ============================================================
// ADMIN DASHBOARD
// ============================================================
async function loadAdminDashboard() {
  const user = requireAuth('admin');
  if (!user) return;

  // Update admin name in sidebar
  const nameEl = document.getElementById('admin-name');
  if (nameEl) nameEl.textContent = user.first_name + ' ' + user.last_name;

  loadDashboardStats();
  loadAllMembers();
  loadAllLoans();
  loadAllSavings();
  loadAnnouncements();
  loadReports();           
  populateMemberFilter();  
}

async function loadDashboardStats() {
  try {
const data = await apiFetch('/admin/report');
    setEl('stat-total-members',  data.total_members);
    setEl('stat-active-members', data.active_members + ' active · ' + data.pending_members + ' pending');
    setEl('stat-total-savings',  'AUD ' + parseFloat(data.total_savings).toLocaleString());
    setEl('stat-active-loans',   data.active_loans);
    setEl('stat-pending-loans',  data.pending_loans + ' awaiting review');
    setEl('stat-total-penalties','AUD ' + parseFloat(data.total_penalties).toLocaleString());
  } catch (err) { console.error('Stats error:', err); }
}

async function loadAllMembers() {
  try {
    const rows = await apiFetch('/members');
    const tbody = document.querySelector('#members-table tbody');
    if (!tbody) return;

    if (!rows.length) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--muted)">No members found.</td></tr>'; return; }

    tbody.innerHTML = rows.map(m => `
      <tr data-status="${m.status}" data-id="${m.id}">
        <td><div style="font-weight:600">${m.first_name} ${m.last_name}</div></td>
        <td style="color:var(--muted)">${m.email}</td>
        <td style="color:var(--muted)">${m.phone || '—'}</td>
        <td style="color:var(--gold)">AUD ${parseFloat(m.total_savings).toLocaleString()}</td>
        <td>${badge(m.status)}</td>
        <td style="color:var(--muted)">${fmtDate(m.created_at)}</td>
        <td>
          <div class="member-row-actions">
  <button class="btn btn-outline btn-xs" onclick='viewMember(${JSON.stringify(m)})'>View</button>
  ${m.status === 'pending'   ? `<button class="btn btn-teal btn-xs" onclick="activateMember(this)">Activate</button>` : ''}
</div>
        </td>
      </tr>
    `).join('');
  } catch (err) { console.error('Members error:', err); }
}

async function activateMember(btn) {
  const row    = btn.closest('tr');
  const userId = row.dataset.id;
  try {
    await apiFetch(`/members/${userId}/status`, { method:'PATCH', body: JSON.stringify({ status:'active' }) });
    loadAllMembers();
  } catch (err) { alert('Error: ' + err.message); }
}

async function loadAllLoans() {
  try {
    const rows = await apiFetch('/loans/all');
    const tbody = document.querySelector('#loans-table tbody');
    if (!tbody) return;

    if (!rows.length) { tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--muted)">No loan applications yet.</td></tr>'; return; }

    tbody.innerHTML = rows.map(l => `
      <tr data-id="${l.id}">
        <td><div style="font-weight:600">${l.first_name} ${l.last_name}</div></td>
        <td style="color:var(--gold);font-weight:600">AUD ${parseFloat(l.amount).toLocaleString()}</td>
        <td>${l.loan_type.replace(/_/g,' ')}</td>
        <td style="color:var(--muted)">${l.purpose || '—'}</td>
        <td style="color:var(--muted)">${fmtDate(l.created_at)}</td>
        <td>${badge(l.status)}</td>
        <td>
          ${l.status === 'pending' ? `
            <div style="display:flex;gap:.3rem">
              <button class="btn btn-teal btn-xs" onclick="approveLoan(this)">Approve</button>
              <button class="btn btn-red btn-xs"  onclick="rejectLoan(this)">Reject</button>
            </div>` : `<span style="color:var(--muted);font-size:.8rem">—</span>`}
        </td>
      </tr>
    `).join('');
  } catch (err) { console.error('Loans error:', err); }
}

async function approveLoan(btn) {
  const loanId = btn.closest('tr').dataset.id;
  try {
await apiFetch(`/loans/${loanId}/status`, { method:'PATCH', body: JSON.stringify({ status: 'approved' }) });    showAdminMsg('✅ Loan approved successfully.');
    loadAllLoans();
    loadDashboardStats();
  } catch (err) { alert('Error: ' + err.message); }
}

async function rejectLoan(btn) {
  const loanId = btn.closest('tr').dataset.id;
  try {
await apiFetch(`/loans/${loanId}/status`, { method:'PATCH', body: JSON.stringify({ status: 'rejected' }) });    showAdminMsg('✅ Loan rejected.');
    loadAllLoans();
    loadDashboardStats();
  } catch (err) { alert('Error: ' + err.message); }
}

async function loadAllSavings() {
  try {
    const rows = await apiFetch('/savings/all');

    // Update stat cards
    const total = rows.reduce((s, r) => s + parseFloat(r.amount || 0), 0);
    const now = new Date();
    const thisMonth = rows.filter(r => {
      const d = new Date(r.week_date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const monthTotal = thisMonth.reduce((s, r) => s + parseFloat(r.amount || 0), 0);
    const missed = rows.filter(r => r.status === 'missed' &&
      new Date(r.week_date).getMonth() === now.getMonth()).length;

    setEl('savings-stat-total',    'AUD ' + total.toLocaleString());
    setEl('savings-stat-month',    'AUD ' + monthTotal.toLocaleString());
    setEl('savings-stat-missed',   missed);
    setEl('savings-stat-penalties','—');

    const tbody = document.querySelector('#savings-table tbody');
    if (!tbody) return;

    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:2rem">No savings recorded yet.</td></tr>';
      return;
    }

    tbody.innerHTML = rows.map(s => `
      <tr>
        <td>${s.first_name} ${s.last_name}</td>
        <td>${fmtDate(s.week_date)}</td>
        <td style="color:var(--teal);font-weight:600">AUD ${parseFloat(s.amount).toLocaleString()}</td>
        <td>${badge(s.status)}</td>
        <td style="color:var(--muted)">${s.notes || '—'}</td>
      </tr>
    `).join('');
  } catch (err) { console.error('Savings error:', err); }
}
async function loadDefaulters() {
  try {
    const rows = await apiFetch('/admin/defaulters');
    const tbody = document.querySelector('#defaulters-table tbody');
    if (!tbody) return;
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:2rem">No defaulters. All repayments are on track.</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(r => `
      <tr>
        <td><div style="font-weight:600">${r.first_name} ${r.last_name}</div><div style="color:var(--muted);font-size:.78rem">${r.email}</div></td>
        <td style="color:var(--gold)">AUD ${parseFloat(r.loan_amount).toLocaleString()}</td>
        <td>Installment ${r.installment_number}</td>
        <td style="color:var(--red)">AUD ${parseFloat(r.amount_due).toLocaleString()}</td>
        <td>${fmtDate(r.due_date)}</td>
        <td style="color:var(--red);font-weight:600">${r.days_overdue} days</td>
      </tr>
    `).join('');
  } catch (err) { console.error('Defaulters error:', err); 
    
  }
}

async function recordSaving_real() {
  const user_id   = document.getElementById('savings-user-id')?.value;
  const amount    = document.getElementById('savings-amount')?.value;
  const week_date = document.getElementById('savings-date')?.value;
  const notes     = document.getElementById('savings-notes')?.value?.trim();

  if (!user_id || !amount || !week_date) {
    alert('User ID, amount and week date are required.');
    return;
  }

  try {
    await apiFetch('/savings', {
      method: 'POST',
      body: JSON.stringify({ user_id: parseInt(user_id), amount: parseFloat(amount), week_date, notes })
    });
    showEl('save-ok');
    loadAllSavings();
  } catch (err) { alert('Error: ' + err.message); }
}

async function loadAnnouncements() {
  try {
    const rows = await apiFetch('/notifications/announcements');
    const list = document.getElementById('announcements-list');
    if (!list || !rows.length) return;

    list.innerHTML = rows.map(a => `
      <div class="ann-card">
        <div>
          <h4>${a.title}</h4>
          <p>${a.body}</p>
        </div>
        <div class="ann-date">${fmtDate(a.created_at)}</div>
      </div>
    `).join('');
  } catch (err) { console.error('Announcements error:', err); }
}

async function loadReports() {
  try {
    const data = await apiFetch('/admin/report');
    setEl('report-total-savings',    'AUD ' + parseFloat(data.total_savings).toLocaleString());
    setEl('report-loans-issued',     'AUD ' + parseFloat(data.total_loans_issued).toLocaleString());
    setEl('report-loans-outstanding','AUD ' + parseFloat(data.total_loans_outstanding).toLocaleString());
    setEl('report-repayments',       'AUD ' + parseFloat(data.total_repayments_received).toLocaleString());
    setEl('report-penalties',        'AUD ' + parseFloat(data.total_penalties).toLocaleString());
    setEl('report-members',          data.total_members);
  } catch (err) { console.error('Reports error:', err); }
}
async function populateMemberFilter() {
  try {
    const members = await apiFetch('/members');
    const sel = document.getElementById('savings-member-filter');
    if (!sel) return;
    members.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = `${m.first_name} ${m.last_name}`;
      sel.appendChild(opt);
    });
  } catch (err) { console.error('Member filter error:', err); }
}

async function postAnnouncement() {
  const title = document.getElementById('ann-title')?.value.trim();
  const body  = document.getElementById('ann-body')?.value.trim();
  const btn   = document.getElementById('ann-btn');

  if (!title || !body) { alert('Title and message are required.'); return; }

  if (btn) { btn.disabled = true; btn.textContent = 'Sending...'; }

  try {
    const data = await apiFetch('/notifications/announce', {
      method: 'POST',
      body: JSON.stringify({ title, body })
    });
    showEl('ann-ok');
    document.getElementById('ann-title').value = '';
    document.getElementById('ann-body').value  = '';
    loadAnnouncements();
  } catch (err) { alert('Error: ' + err.message); }
  finally { if (btn) { btn.disabled = false; btn.textContent = 'Send to All Members →'; } }
}

function showAdminMsg(msg) {
  const el = document.getElementById('admin-msg');
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 4000);
}

// ============================================================
// MEMBER DASHBOARD
// ============================================================
async function loadMemberDashboard() {
  const user = requireAuth('member');
  if (!user) return;

  try {
    const me = await apiFetch('/auth/me');
    const nameEl    = document.getElementById('member-name');
    const greetEl   = document.getElementById('member-greeting');
    const profileEl = document.getElementById('member-profile-name');
    const fullName  = me.first_name + ' ' + me.last_name;
    const hour      = new Date().getHours();
    const greeting  = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

    if (nameEl)    nameEl.textContent    = fullName;
    if (greetEl)   greetEl.textContent   = greeting + ', ' + me.first_name + ' 👋';
    if (profileEl) profileEl.textContent = fullName;

    const initials  = me.first_name[0].toUpperCase() + me.last_name[0].toUpperCase();
const avatarEl  = document.getElementById('member-avatar');
const topbarEl  = document.getElementById('topbar-avatar');
const profileAv = document.getElementById('profile-avatar');
if (avatarEl)  avatarEl.textContent  = initials;
if (topbarEl)  topbarEl.textContent  = initials;
if (profileAv) profileAv.textContent = initials;

// Also fill profile fields:
const fnameEl = document.getElementById('profile-fname');
const lnameEl = document.getElementById('profile-lname');
const emailEl = document.getElementById('profile-email');
const phoneEl = document.getElementById('profile-phone');
const idEl    = document.getElementById('profile-id');
if (fnameEl) fnameEl.value = me.first_name;
if (lnameEl) lnameEl.value = me.last_name;
if (emailEl) emailEl.value = me.email;
if (phoneEl) phoneEl.value = me.phone || '';
    setEl('stat-total-savings',  'AUD ' + parseFloat(me.total_savings || 0).toLocaleString());
    setEl('stat-max-loan',       'AUD ' + parseFloat(me.max_loan || 0).toLocaleString());
    setEl('loan-max-hint',       'A$'  + parseFloat(me.max_loan || 0).toFixed(2));   // ← ADD THIS

  } catch (err) { console.error('Me error:', err); }

  loadMySavings();
  loadMyLoans();
  loadMyNotifications();
}

async function loadMySavings() {
  try {
    const rows = await apiFetch('/savings/me');
    const tbody = document.querySelector('#my-savings-table tbody');
    if (!tbody) return;

    if (!rows.length) { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--muted)">No savings recorded yet.</td></tr>'; return; }

    tbody.innerHTML = rows.map(s => `
      <tr>
        <td>${fmtDate(s.week_date)}</td>
        <td>AUD ${parseFloat(s.amount).toLocaleString()}</td>
        <td>${badge(s.status)}</td>
        <td style="color:var(--muted)">${s.notes || '—'}</td>
      </tr>
    `).join('');
  } catch (err) { console.error('My savings error:', err); }
}

async function loadMyLoans() {
  try {
    const rows = await apiFetch('/loans/me');
    const tbody = document.querySelector('#my-loans-table tbody');
    if (!tbody) return;

    if (!rows.length) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--muted)">No loan applications yet.</td></tr>'; return; }

    tbody.innerHTML = rows.map(l => `
      <tr>
        <td>${fmtDate(l.created_at)}</td>
        <td style="color:var(--gold);font-weight:600">AUD ${parseFloat(l.amount).toLocaleString()}</td>
        <td>${l.loan_type.replace(/_/g,' ')}</td>
        <td style="color:var(--muted)">${l.purpose || '—'}</td>
        <td>${badge(l.status)}</td>
      </tr>
    `).join('');
  } catch (err) { console.error('My loans error:', err); }
}

async function loadMyPayments() {
  try {
    const rows = await apiFetch('/payments/me');
    const tbody = document.querySelector('#my-payments-table tbody');
    if (!tbody) return;

    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:2rem">No payments yet.</td></tr>';
      return;
    }

    tbody.innerHTML = rows.map(p => `
      <tr>
        <td>${fmtDate(p.created_at)}</td>
        <td>${p.payment_type.replace(/_/g,' ')}</td>
        <td style="color:var(--teal);font-weight:600">AUD ${parseFloat(p.amount).toLocaleString()}</td>
        <td style="color:var(--muted);font-size:.78rem;font-family:monospace">${p.stripe_payment_id || '—'}</td>
        <td><span class="badge ${p.stripe_status === 'succeeded' ? 'confirmed' : 'pending'}">${p.stripe_status}</span></td>
      </tr>
    `).join('');
  } catch (err) { console.error('Payments error:', err); }
}

async function loadMyProfile() {
  try {
    const me = await apiFetch('/auth/me');

    // Fill profile card
    const initials = me.first_name[0].toUpperCase() + me.last_name[0].toUpperCase();
    setEl('member-profile-name', me.first_name + ' ' + me.last_name);
    setEl('member-profile-email', me.email);
    setEl('profile-avatar', initials);

    // Fill profile stats
    const [loans] = await Promise.all([apiFetch('/loans/me')]);
    setEl('profile-total-saved', 'AUD ' + parseFloat(me.total_savings || 0).toLocaleString());
    setEl('profile-weeks', '—');
    setEl('profile-loans', loans.length);

    // Fill form fields
    const fnameEl = document.getElementById('profile-fname');
    const lnameEl = document.getElementById('profile-lname');
    const emailEl = document.getElementById('profile-email');
    const phoneEl = document.getElementById('profile-phone');
    if (fnameEl) fnameEl.value = me.first_name;
    if (lnameEl) lnameEl.value = me.last_name;
    if (emailEl) emailEl.value = me.email;
    if (phoneEl) phoneEl.value = me.phone || '';

  } catch (err) { console.error('Profile error:', err); }
}

async function loadMyNotifications() {
  try {
    const rows = await apiFetch('/notifications');
    const list  = document.getElementById('notifications-list');
    const badge = document.getElementById('notif-badge');

    const unread = rows.filter(n => !n.is_read).length;
    if (badge) badge.textContent = unread > 0 ? unread : '';

    if (!list) return;
    if (!rows.length) { list.innerHTML = '<div class="empty"><div class="empty-ico">🔔</div><p>No notifications yet.</p></div>'; return; }

    list.innerHTML = rows.map(n => `
      <div class="notif-item ${n.is_read ? '' : 'unread'}" onclick="markRead(${n.id})">
        <div class="notif-ico ${n.notif_type}">
          ${n.notif_type === 'loan' ? '💰' : n.notif_type === 'penalty' ? '⚠️' : '📢'}
        </div>
        <div class="notif-body">
          <div class="notif-title">
            ${!n.is_read ? '<span class="unread-dot"></span>' : ''}
            ${n.title}
          </div>
          <div class="notif-msg">${n.message}</div>
          <div class="notif-time">${fmtDate(n.created_at)}</div>
        </div>
      </div>
    `).join('');
  } catch (err) { console.error('Notifications error:', err); }
}

async function markRead(id) {
  try {
    await apiFetch(`/notifications/${id}/read`, { method:'PATCH' });
    loadMyNotifications();
  } catch (err) { console.error(err); }
}

async function markAllRead() {
  try {
    await apiFetch('/notifications/read-all', { method:'PATCH' });
    loadMyNotifications();
  } catch (err) { console.error(err); }
}

async function submitLoanApp() {
  const amount    = document.getElementById('loan-amount-inp')?.value;
const loan_type = document.getElementById('loan-type-sel')?.value;
  const purpose   = document.getElementById('loan-purpose')?.value?.trim();
  const g1        = document.getElementById('guarantor-1')?.value.trim();
  const g2        = document.getElementById('guarantor-2')?.value.trim();
  const btn       = document.getElementById('loan-submit-btn');

  if (!amount || !loan_type || !purpose) { alert('Please fill in amount, type and purpose.'); return; }
  if (!g1) { alert('Please enter at least one guarantor ID.'); return; }

  const guarantor_ids = [g1, g2].filter(g => g !== '').map(Number);

  if (btn) { btn.disabled = true; btn.textContent = 'Submitting...'; }

  try {
await apiFetch('/loans/apply', {
        method: 'POST',
      body: JSON.stringify({ amount: parseFloat(amount), loan_type, purpose, guarantor_ids })
    });
    showEl('loan-app-ok');
    if (btn) btn.style.display = 'none';
    loadMyLoans();
  } catch (err) {
    alert('Error: ' + err.message);
    if (btn) { btn.disabled = false; btn.textContent = 'Submit Application →'; }
  }
}

// ── Utility helpers ──────────────────────────────────────────
function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function showEl(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'block';
}

function filterMembers(q) {
  document.querySelectorAll('#members-table tbody tr').forEach(r => {
    r.style.display = r.textContent.toLowerCase().includes(q.toLowerCase()) ? '' : 'none';
  });
}

function filterByStatus(s) {
  document.querySelectorAll('#members-table tbody tr').forEach(r => {
    r.style.display = (!s || r.dataset.status === s) ? '' : 'none';
  });
}
// ── PROFILE ──────────────────────────────────────────────────
async function saveProfile() {
  const first_name = document.getElementById('profile-fname')?.value.trim();
  const last_name  = document.getElementById('profile-lname')?.value.trim();
  const phone      = document.getElementById('profile-phone')?.value.trim();

  try {
    await apiFetch('/members/profile', {
      method: 'PUT',
      body: JSON.stringify({ first_name, last_name, phone }),
    });
    showEl('profile-ok');
    setTimeout(() => hideEl('profile-ok'), 3000);
  } catch (err) {
    alert('Could not save profile: ' + err.message);
  }
}

async function savePassword() {
  const fields   = document.querySelectorAll('#page-profile input[type="password"]');
  const current  = fields[0]?.value;
  const newPass  = fields[1]?.value;
  const confirm  = fields[2]?.value;

  if (!current || !newPass || !confirm) {
    alert('Please fill in all password fields.'); return;
  }
  if (newPass !== confirm) {
    alert('New passwords do not match.'); return;
  }
  if (newPass.length < 6) {
    alert('Password must be at least 6 characters.'); return;
  }

  try {
    await apiFetch('/members/password', {
      method: 'PUT',
      body: JSON.stringify({ current_password: current, new_password: newPass }),
    });
    showEl('pass-ok');
    setTimeout(() => hideEl('pass-ok'), 3000);
  } catch (err) {
    alert('Could not update password: ' + err.message);
  }
}

function hideEl(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'none';
}
// ── Auto-init ────────────────────────────────────────────────
// ── populateMemberFilter (outside DOMContentLoaded) ─────────
function filterLoans(search) {
  document.querySelectorAll('#loans-tbody tr').forEach(row => {
    row.style.display = row.textContent.toLowerCase().includes(search.toLowerCase()) ? '' : 'none';
  });
}

function filterLoanStatus(status) {
  document.querySelectorAll('#loans-tbody tr').forEach(row => {
    const badge = row.querySelector('.badge');
    if (!status || !badge) { row.style.display = ''; return; }
    row.style.display = badge.textContent.toLowerCase() === status.toLowerCase() ? '' : 'none';
  });
}
async function downloadAdminReport(type) {
  try {
    let rows, filename, headers;

    if (type === 'members') {
      rows     = await apiFetch('/members');
      headers  = ['ID','First Name','Last Name','Email','Phone','Status','Total Savings','Joined'];
      filename = 'zarafi-members.csv';
      rows     = rows.map(r => [r.id, r.first_name, r.last_name, r.email, r.phone||'', r.status, r.total_savings, r.created_at]);
    } else if (type === 'savings') {
      rows     = await apiFetch('/savings/all');
      headers  = ['Member','Week Date','Amount','Status','Notes'];
      filename = 'zarafi-savings.csv';
      rows     = rows.map(r => [r.first_name+' '+r.last_name, r.week_date, r.amount, r.status, r.notes||'']);
    } else if (type === 'loans') {
      rows     = await apiFetch('/loans/all');
      headers  = ['Member','Amount','Type','Purpose','Status','Applied'];
      filename = 'zarafi-loans.csv';
      rows     = rows.map(r => [r.first_name+' '+r.last_name, r.amount, r.loan_type, r.purpose||'', r.status, r.created_at]);
    }

    // Build CSV
    const csv = [headers, ...rows]
      .map(row => row.map(val => `"${String(val).replace(/"/g,'""')}"`).join(','))
      .join('\n');

    // Download
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

  } catch (err) {
    alert('Export failed: ' + err.message);
  }
}

// ── Auto-init ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const page  = window.location.pathname.split('/').pop();
  if (page === 'member.html') loadMemberDashboard();
  if (page === 'admin.html')  loadAdminDashboard();
  if (page === 'login.html' && new URLSearchParams(window.location.search).get('token')) {
    switchTab('reset');
  }
});