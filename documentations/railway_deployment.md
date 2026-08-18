# Zarafi Chama Savings & Loans — Railway Deployment Guide

This guide provides step-by-step instructions for deploying the monolithic Zarafi application (Express Backend serving the static Frontend) and a MySQL database on **Railway**.

---

## 🏗️ Deployment Architecture Overview
The application is structured as a monolith:
1.  The **MySQL database** runs as a managed service on Railway.
2.  The **Express server** runs as a container service on Railway. It serves both the JSON API endpoints (`/api/*`) and the static frontend pages (`index.html`, `login.html`, etc.) from the `/FRONTEND` folder.
3.  Both services communicate securely using the unified `DATABASE_URL` environment variable.

---

## 🚀 Step 1: Provision the MySQL Database
1.  Log in to your [Railway Dashboard](https://railway.app/).
2.  Create a **New Project**.
3.  Click **Add Service** and select **Database** → **Add MySQL**.
4.  Railway will provision a MySQL service. Once created, click on the MySQL service block, go to the **Variables** tab, and locate the `DATABASE_URL` (it looks like `mysql://root:password@host:port/railway`). Copy this connection string.

---

## 📦 Step 2: Deploy the Application Service
1.  In your Railway project dashboard, click **New** → **GitHub Repo** and select your repository (`Meshkiplii/zarafi`).
2.  Before building, we need to tell Railway to execute from the `/BACKEND` directory, since that is where the server code and `package.json` are located.
    *   Click on the newly added application service.
    *   Go to **Settings** → **General**.
    *   Find the **Root Directory** field, set it to `BACKEND` (all caps to match your directory name), and save.

---

## ⚙️ Step 3: Configure Environment Variables
Go to the **Variables** tab of your application service and add the following keys:

| Environment Variable | Value / Description |
| :--- | :--- |
| `DATABASE_URL` | `${{MySQL.DATABASE_URL}}` *(This tells Railway to bind to the managed MySQL service automatically)* |
| `PORT` | `5000` *(Express will listen on this port, and Railway will bind public traffic to it)* |
| `JWT_SECRET` | A secure, random secret string used to sign JWT auth tokens. |
| `CLIENT_URL` | The public domain assigned by Railway (e.g., `https://zarafi-production.up.railway.app`). |
| `EMAIL_HOST` | *(Optional)* SMTP mail server host (e.g. `smtp.mailtrap.io`) for password recovery. |
| `EMAIL_PORT` | *(Optional)* SMTP mail server port (e.g. `2525`). |
| `EMAIL_USER` | *(Optional)* SMTP username. |
| `EMAIL_PASS` | *(Optional)* SMTP password. |
| `STRIPE_SECRET_KEY` | *(Optional)* Stripe private key for card payments. |
| `STRIPE_WEBHOOK_SECRET` | *(Optional)* Stripe webhook validation secret. |

---

## 🗄️ Step 4: Initialize the Database Schema (Migration)
You must initialize the tables and seed data in the remote Railway database. The easiest and safest way is to trigger it locally using the environment variable:

1.  Open your terminal on your local machine.
2.  Set the `DATABASE_URL` environment variable to the production Railway MySQL connection string (copied in Step 1):
    *   **PowerShell**: `$env:DATABASE_URL="mysql://root:password@host:port/railway"`
    *   **CMD**: `set DATABASE_URL=mysql://root:password@host:port/railway`
3.  Navigate to the `BACKEND` folder:
    ```bash
    cd BACKEND
    ```
4.  Run the initialization command:
    ```bash
    npm run db:init
    ```
    This script will connect to your remote Railway database, skip the local creation steps, build the tables, and seed the default admin account.

---

## 🎯 Step 5: Generate Domain and Verify
1.  Go to the **Settings** tab of your application service.
2.  Under the **Networking** section, click **Generate Domain** (or set up a custom domain).
3.  Open the generated URL in your browser.
4.  You should see the Zarafi landing page. Click **Join / Sign In**, and log in with the default admin credentials:
    *   **Email**: `admin@zarafi.co.ke`
    *   **Password**: `Admin@123`
5.  Check that dashboards and stats compute correctly!
