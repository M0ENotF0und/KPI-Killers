# Scenario-Based IT Recommendation and Cost-Optimization System - Deliverable 3

Covers the mid-semester marking items: database, front-end, admin panel, and both connected to the database.

## Run it
    pip install -r requirements.txt
    python app.py          # http://127.0.0.1:5000  (creates + seeds the database on first run)

**Database (PostgreSQL, as in the schema design):**
    createdb it_recommender
    export DATABASE_URL=postgresql://user:password@localhost/it_recommender
    export SECRET_KEY=<long random string>
    python app.py
Without `DATABASE_URL` it falls back to a local SQLite file so it runs with zero setup (same 17 tables).
`schema.sql` is the PostgreSQL DDL for the 17 tables in the Deliverable 2 schema.

## Demo logins
| Role | Email | Password |
|---|---|---|
| Admin | admin@recommend.app | Admin123! |
| Student | student@recommend.app | Demo1234! |
| Business buyer | business@recommend.app | Demo1234! |
| Consumer | consumer@recommend.app | Demo1234! |

## What is built
- **Database:** 17 tables, PKs/FKs, CHECK/UNIQUE/NOT NULL constraints, seed data (10 laptop models, local + Dubai listings, price history, cost rates, rules).
- **Front-end (screens 1-3):** register/login/logout; role-specific scenario forms with validation; ranked recommendations; local vs Dubai landed-cost chart and breakdown; wishlist; saved scenarios; PDF export.
- **Admin panel (screen 4):** dashboard (items, low-stock alerts, last backup), catalog CRUD + search + CSV bulk import, prices and rates, rule editor, user management (register, reset password, delete), audit log, JSON backups.
- **Connections:** every page reads/writes the DB through `db.py` (parameterised queries only).
- **Also included:** forgot/reset password (signed 30-minute single-use link, shown on screen because the prototype has no mail server), help page, admin report with company name/logo/date, filtering, sorting and print-to-PDF.
- **Security:** hashed passwords, JWT in an HttpOnly cookie, role checks (RBAC), CSRF tokens, audit trail, parameterised SQL.

## Notes
- Duty, VAT, freight and FX start with default values; maintain them under Admin > Prices & rates.
- Password hashing uses Werkzeug (scrypt) instead of bcrypt from the architecture slide.
- Two-factor authentication is not included in this prototype.
