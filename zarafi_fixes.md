# Zarafi Chama Savings & Loans — Debugging & Implementation Report

This document details all the bugs fixed, cleanups executed, and deployment enhancements added to the Zarafi project to ensure seamless monolithic hosting and database reliability.

---

## 🧹 1. Workspace Cleanups

### Redundant Root Configurations
*   **Issue**: The repository root folder contained a redundant `package.json` and `package-lock.json`. These conflicted with the actual Node.js application which resides inside the `/BACKEND` directory.
*   **Action**: Deleted both root files to prevent dependency confusion.

---

## 🐛 2. MySQL Database & Schema Fixes

### Missing Password Reset Columns
*   **Files**: [`schema.sql`](file:///c:/Users/ADMIN/Documents/Sharon/zarafi/BACKEND/config/schema.sql#L18-L23) & [`auth.js`](file:///c:/Users/ADMIN/Documents/Sharon/zarafi/BACKEND/routes/auth.js#L151-L154)
*   **Issue**: The password recovery endpoints update and select `reset_token` and `reset_token_expires` columns in the `users` table. However, these columns were missing from the SQL definition, causing all password-reset flows to crash.
*   **Fix**: Modified the `users` table schema in `schema.sql` to include:
    ```sql
    reset_token         VARCHAR(255) NULL,
    reset_token_expires TIMESTAMP NULL,
    ```

### Seed Admin Password Recovery
*   **File**: [`schema.sql`](file:///c:/Users/ADMIN/Documents/Sharon/zarafi/BACKEND/config/schema.sql#L150-L156)
*   **Issue**: The default seed admin account had an unknown Bcrypt password hash.
*   **Fix**: Generated a new secure Bcrypt hash and updated the SQL statement. The default seed admin credentials are now:
    *   **Email**: `admin@zarafi.co.ke`
    *   **Password**: `Admin@123`

---

## 🐛 3. API & Authentication Fixes

### Unpopulated Computed Login Properties
*   **File**: [`auth.js`](file:///c:/Users/ADMIN/Documents/Sharon/zarafi/BACKEND/routes/auth.js#L64-L105)
*   **Issue**: The successful `/login` response payload returned `total_savings` and `max_loan` limit fields directly from a simple `SELECT * FROM users` query. Because these are dynamically computed fields (and not columns in the table), they returned as `0` for all users initially.
*   **Fix**: Modified the login query to join with the `savings` table and calculate `total_savings` dynamically:
    ```javascript
    SELECT u.*, 
           COALESCE(SUM(CASE WHEN s.status='confirmed' THEN s.amount ELSE 0 END), 0) AS total_savings
    FROM users u
    LEFT JOIN savings s ON s.user_id = u.id
    WHERE u.email = ?
    GROUP BY u.id
    ```
    Then, computed the `max_loan` limit (3x savings) in JavaScript and returned both properties populated in the JSON payload.

---

## 🚀 4. Monolithic Deployment & Host Compatibility

### Monolithic Frontend Hosting
*   **File**: [`server.js`](file:///c:/Users/ADMIN/Documents/Sharon/zarafi/BACKEND/server.js#L4-L35)
*   **Issue**: The user wanted to host both the frontend and backend together under a single Railway container service.
*   **Fix**: Configured Express static middleware pointing to the static frontend files and removed the root `/` API route handler:
    ```javascript
    app.use(express.static(path.join(__dirname, '../FRONTEND')));
    ```
    Now, opening the backend port in production serves the frontend landing page, HTML files, and static CSS/JS files automatically.

### Dynamic API Endpoint URLs
*   **File**: [`app.js`](file:///c:/Users/ADMIN/Documents/Sharon/zarafi/FRONTEND/app.js#L5-L7)
*   **Issue**: The frontend API URL was hardcoded to a specific Railway domain, which interfered with local testing and monolithic routing.
*   **Fix**: Replaced the URL string with a dynamic endpoint resolver:
    ```javascript
    const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && window.location.port !== '5000'
      ? 'http://localhost:5000/api'
      : '/api';
    ```
    If accessed via local Live Server (port 5500), it targets local Express (port 5000). In production, it routes using relative same-origin `/api` calls.

---

## ⚙️ 5. Railway Connection & Migration Utilities

### Railway Database URL Configuration
*   **File**: [`db.js`](file:///c:/Users/ADMIN/Documents/Sharon/zarafi/BACKEND/config/db.js#L4-L18)
*   **Issue**: Railway databases provide connection strings via a single `DATABASE_URL` environment variable, whereas the code was configured only for split variables (host, port, user, etc.).
*   **Fix**: Configured connection pool instantiation to prioritize `process.env.DATABASE_URL` if it exists.

### Multi-Environment Config Setup
*   **Files**: [`server.js`](file:///c:/Users/ADMIN/Documents/Sharon/zarafi/BACKEND/server.js#L1-L4) & [`db.js`](file:///c:/Users/ADMIN/Documents/Sharon/zarafi/BACKEND/config/db.js#L1-L5)
*   **Fix**: Updated `dotenv` calls to load `.env.local` first and `.env` second. This facilitates local overrides without leaking details to git repository defaults.

### Automated SQL Database Initializer
*   **Files**: [`initDb.js`](file:///c:/Users/ADMIN/Documents/Sharon/zarafi/BACKEND/utils/initDb.js) & [`package.json`](file:///c:/Users/ADMIN/Documents/Sharon/zarafi/BACKEND/package.json#L9)
*   **Fix**: Added a database migration script that connects to the database via your pool config, splits `schema.sql` into individual statements, and runs them. It filters out DB creation/use statements (`CREATE DATABASE`, `USE`) to ensure compatibility with Railway's pre-configured databases. Triggered by running:
    ```bash
    npm run db:init
    ```
