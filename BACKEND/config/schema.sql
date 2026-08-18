-- ZARAFI CHAMA DATABASE SCHEMA
-- Run this file once to set up all tables

CREATE DATABASE IF NOT EXISTS zarafi CHARACTER SET utf8 COLLATE utf8_unicode_ci;
USE zarafi;

-- USERS
CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  first_name    VARCHAR(100)  NOT NULL,
  last_name     VARCHAR(100)  NOT NULL,
  email         VARCHAR(255)  NOT NULL UNIQUE,
  phone         VARCHAR(20),
  national_id   VARCHAR(50)   UNIQUE,
  password_hash VARCHAR(255)  NOT NULL,
  role          ENUM('member','admin') DEFAULT 'member',
  status        ENUM('pending','active','suspended') DEFAULT 'pending',
  join_reason         TEXT,
  reset_token         VARCHAR(255) NULL,
  reset_token_expires TIMESTAMP NULL,
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_role   (role),
  INDEX idx_users_status (status)
);

-- SAVINGS
CREATE TABLE IF NOT EXISTS savings (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  amount      DECIMAL(10,2) NOT NULL DEFAULT 0,
  week_date   DATE NOT NULL,
  status      ENUM('confirmed','missed') DEFAULT 'confirmed',
  notes       VARCHAR(255),
  recorded_by INT,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY  uq_savings_week (user_id, week_date),
  INDEX       idx_savings_user_id     (user_id),
  INDEX       idx_savings_recorded_by (recorded_by),
  FOREIGN KEY (user_id)     REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE SET NULL
);

-- PENALTIES
CREATE TABLE IF NOT EXISTS penalties (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL,
  amount     DECIMAL(10,2) NOT NULL DEFAULT 50.00,
  reason     VARCHAR(255) DEFAULT 'Missed weekly contribution',
  week_date  DATE NOT NULL,
  paid       BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_penalty_week (user_id, week_date),
  INDEX      idx_penalties_user_id (user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- LOANS
CREATE TABLE IF NOT EXISTS loans (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  borrower_id   INT NOT NULL,
  amount        DECIMAL(10,2) NOT NULL,
  loan_type     ENUM('2_weeks','1_month','2_months','3_months') NOT NULL,
  interest_rate DECIMAL(5,2) NOT NULL DEFAULT 10.00,
  due_date      DATE NULL,
  status        ENUM('pending','approved','active','completed','rejected') DEFAULT 'pending',
  purpose       TEXT,
  approved_by   INT,
  approved_at   TIMESTAMP NULL,
  disbursed_at  TIMESTAMP NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_loans_borrower_id (borrower_id),
  INDEX idx_loans_approved_by (approved_by),
  INDEX idx_loans_status      (status),
  FOREIGN KEY (borrower_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
);

-- LOAN GUARANTORS
CREATE TABLE IF NOT EXISTS loan_guarantors (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  loan_id      INT NOT NULL,
  guarantor_id INT NOT NULL,
  accepted     TINYINT(1) DEFAULT NULL,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_loan_guarantor (loan_id, guarantor_id),
  INDEX      idx_loan_guarantors_loan_id      (loan_id),
  INDEX      idx_loan_guarantors_guarantor_id (guarantor_id),
  FOREIGN KEY (loan_id)      REFERENCES loans(id) ON DELETE CASCADE,
  FOREIGN KEY (guarantor_id) REFERENCES users(id) ON DELETE CASCADE
);

-- REPAYMENTS
CREATE TABLE IF NOT EXISTS repayments (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  loan_id            INT NOT NULL,
  installment_number INT NOT NULL,
  amount_due         DECIMAL(10,2) NOT NULL,
  amount_paid        DECIMAL(10,2) DEFAULT 0.00,
  due_date           DATE NOT NULL,
  paid_at            TIMESTAMP NULL,
  status             ENUM('pending','partial','paid','overdue') DEFAULT 'pending',
  UNIQUE KEY uq_repayment_installment (loan_id, installment_number),
  CONSTRAINT chk_amount_paid CHECK (amount_paid >= 0 AND amount_paid <= amount_due),
  INDEX idx_repayments_loan_id  (loan_id),
  INDEX idx_repayments_due_date (due_date),
  FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE CASCADE
);

-- PAYMENTS
CREATE TABLE IF NOT EXISTS payments (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  user_id             INT NOT NULL,
  amount              DECIMAL(10,2) NOT NULL,
  payment_type        ENUM('savings','loan_repayment','penalty') NOT NULL,
  reference_id        INT DEFAULT NULL,
  stripe_payment_id   VARCHAR(255),
  stripe_status       VARCHAR(50) DEFAULT 'pending',
  notes               VARCHAR(255),
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_payments_user_id           (user_id),
  INDEX idx_payments_stripe_payment_id (stripe_payment_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL,
  title      VARCHAR(255) NOT NULL,
  message    TEXT NOT NULL,
  is_read    BOOLEAN DEFAULT FALSE,
  notif_type ENUM('general','penalty','loan','repayment') DEFAULT 'general',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_notifications_user_id (user_id),
  INDEX idx_notifications_is_read (is_read),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ANNOUNCEMENTS
CREATE TABLE IF NOT EXISTS announcements (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  title      VARCHAR(255) NOT NULL,
  body       TEXT NOT NULL,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_announcements_created_by (created_by),
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- SEED: default admin user
-- SECURITY WARNING: Change this password immediately after first login.
INSERT IGNORE INTO users (first_name, last_name, email, password_hash, role, status)
VALUES ('Zarafi', 'Admin', 'admin@zarafi.co.ke',
        '$2a$10$hZZmLL1tSmPEJ3ITGJCppOigIINxt7e94aLbOI0az1Rx3ImZDyJZ.',
        'admin', 'active');
