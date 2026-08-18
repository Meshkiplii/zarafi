# Zarafi Chama Savings & Loans — Identified Bugs & Fixes

This document outlines the issues discovered in the Zarafi repository, proposed fixes, and architectural recommendations.

---

## 🧹 1. Workspace Cleanup (Root Files)

### Issue
The root directory contains a `package.json` and a `package-lock.json` file. The frontend is static (HTML/JS/CSS using CDNs) and the backend is isolated inside the `/BACKEND` folder with its own `package.json` and `node_modules`.

### Solution
Delete the redundant files in the root folder to avoid confusion:
*   [package.json](file:///c:/Users/ADMIN/Documents/Sharon/zarafi/package.json)
*   [package-lock.json](file:///c:/Users/ADMIN/Documents/Sharon/zarafi/package-lock.json)

---

## 🐛 2. Missing Password Reset Columns in Schema

### Issue
The password reset functionality in [auth.js](file:///c:/Users/ADMIN/Documents/Sharon/zarafi/BACKEND/routes/auth.js#L151-L154) updates/reads `reset_token` and `reset_token_expires` on the `users` table:
```javascript
UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE email = ?
```
However, these columns are missing from the `users` table definition in [schema.sql](file:///c:/Users/ADMIN/Documents/Sharon/zarafi/BACKEND/config/schema.sql#L7-L23).

### Solution
Modify [schema.sql](file:///c:/Users/ADMIN/Documents/Sharon/zarafi/BACKEND/config/schema.sql#L7-L23) to add the missing columns to the `users` table definition:
```sql
CREATE TABLE IF NOT EXISTS users (
  ...
  join_reason         TEXT,
  reset_token         VARCHAR(255) NULL,
  reset_token_expires TIMESTAMP NULL,
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ...
);
```

---

## 🐛 3. Unpopulated Computed Fields on Login

### Issue
In [auth.js](file:///c:/Users/ADMIN/Documents/Sharon/zarafi/BACKEND/routes/auth.js#L97-L105), the `/login` route attempts to return:
```javascript
total_savings: user.total_savings || 0,
max_loan:      user.max_loan      || 0,
```
However, `total_savings` and `max_loan` are computed values and do not exist as static fields in the `users` database table. Since the login query is a simple `SELECT * FROM users WHERE email = ?`, these fields are undefined, so the payload returned is always `0` for savings and loan eligibility on initial login.

### Solution
We can modify the query in the `/login` route of [auth.js](file:///c:/Users/ADMIN/Documents/Sharon/zarafi/BACKEND/routes/auth.js#L64-L68) to compute these values dynamically (similar to `/me`):
```javascript
const [rows] = await db.query(
  `SELECT u.*, 
          COALESCE(SUM(CASE WHEN s.status='confirmed' THEN s.amount ELSE 0 END), 0) AS total_savings
   FROM users u
   LEFT JOIN savings s ON s.user_id = u.id
   WHERE u.email = ?
   GROUP BY u.id`,
  [email]
);
```
Then, calculate the `max_loan` in JavaScript:
```javascript
const user = rows[0];
user.total_savings = parseFloat(user.total_savings || 0);
user.max_loan = user.total_savings * 3;
```

---

## 🚀 4. Deployment Architecture Recommendations

You are absolutely right about the deployment structure. Let's clarify how to distribute the hosting of this application:

### 1. Database (MySQL)
*   **Hosting**: Relational SQL databases require dedicated container instances. **Railway** is excellent for this.
*   **Action**: Spin up a MySQL database on Railway. Railway will provide a connection URL (e.g., `mysql://user:pass@host:port/db`).
*   **Env Variables**: Supply this URL/credentials as environment variables (`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`) to your backend.

### 2. Backend (Express.js)
*   **Hosting**: The backend is a standard Express app configured as a long-running HTTP server.
    *   **Can you host it on Vercel?** Vercel is designed for serverless functions, so you *can* host Express backends, but you would have to adapt it into Vercel serverless configurations (creating a `vercel.json` and structure).
    *   **Alternative (Recommended)**: Host both the **MySQL Database** and the **Express Backend** on **Railway**. Railway runs standard Docker container environments, so deploying Express is plug-and-play with the standard `npm start` command.
*   **Action**: Deploy the `BACKEND` directory to Railway and connect it to your Railway MySQL instance.

### 3. Frontend (HTML/JS/CSS)
*   **Hosting**: The frontend consists of purely static files.
*   **Action**: Deploy the `FRONTEND` directory to **Vercel**. Vercel is the premier platform for static sites and frontend CDNs, offering extremely fast page speeds and auto-routing.
*   **Connection**: Make sure the frontend `app.js` environment points to the production Railway backend URL (already configured as `https://zarafi-production.up.railway.app/api`).
