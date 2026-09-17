# MARS GPMS — Gate Pass Management System

Full-stack application replacing the paper gate-pass registers: NRGP, RGP, Scrap Outward, Inward, Store Movement, visitor passes with the FORM-1839 health declaration, weighbridge, approvals, reports and admin.

| Layer | Technology |
|---|---|
| Frontend | React 19, Tailwind CSS 4, Vite, Recharts |
| Backend | Node.js 24, Express 5, Zod validation, JWT + role-based permissions |
| Database | PostgreSQL 18 (plain SQL migrations) |
| Exports / email | ExcelJS (xlsx), CSV, browser print-to-PDF, Nodemailer |
| Deploy | Docker image (API serves the built frontend), Nginx, GitHub Actions CI |

```
gpms-app/
  backend/
    migrations/001_init.sql   database schema (follows GPMS_ER_Diagrams.docx)
    src/routes/               auth, gatePasses, visitors, weighbridge, masters, admin, insights
    src/seed.js               roles, screens, default permissions, first Super Admin, demo data
    test/workflow.test.js     end-to-end API tests on an embedded PostgreSQL
  frontend/src/pages/         one file per screen
  setup-postgres.ps1          one-time local database setup
  Dockerfile, docker-compose.yml, deploy/nginx.conf, .github/workflows/ci.yml
```

## 1. First-time setup (Windows, local PostgreSQL 18)

```powershell
cd gpms-app
powershell -ExecutionPolicy Bypass -File .\setup-postgres.ps1 -Demo
```

The script asks for your `postgres` password in psql. It then creates the `gpms` database and a separate `gpms_app` login, writes `backend\.env`, runs migrations, and creates the Super Admin. Save the admin password it prints. Leave out `-Demo` if you don't want sample vendors, materials and users (demo password `Demo@12345`).

No PostgreSQL password available? Use the embedded dev database instead. It's for development only.

```bash
cd backend && npm install && npm run dev:db     # terminal 1, keep running
npm run migrate && node --env-file=.env src/seed.js --demo
```

(`backend/.env` must use `DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5499/postgres` and `DB_POOL_MAX=1`.)

## 2. Run in development

```bash
cd backend  && npm run dev      # API on http://localhost:4000 (applies migrations on start)
cd frontend && npm install && npm run dev   # UI on http://localhost:5173 (proxies /api)
```

## 3. Tests

```bash
cd backend && npm test
```

The 22 end-to-end tests run against a throwaway PostgreSQL 18 instance. They cover:

- login, registration and activation, password reset
- NRGP: reject → amend → approve → seal mismatch → exit → weighbridge
- RGP return tracking
- vendors only seeing their own data
- direct entry and soft delete
- all-or-nothing bulk approval
- permission changes
- the visitor health flow
- master data validation
- CSV and XLSX exports
- dashboards

## 4. Deploy

```bash
# .env next to docker-compose.yml: DB_PASSWORD, JWT_SECRET, APP_URL, SMTP_*
docker compose up -d --build
docker compose exec app node src/seed.js          # once: roles + Super Admin (prints password)
```

Put Nginx in front (`deploy/nginx.conf`) for HTTPS on the MARS domain. Back up the `pgdata` and `uploads` volumes. A managed database (for example Azure Database for PostgreSQL) works too: set `DATABASE_URL` and drop the `db` service.

## 5. Business rules enforced by the server

- **One approval level** for every request (Process Document V1). An approver **cannot approve their own request**.
- Rejecting requires remarks. Only the requester can amend a rejected request, and amending sends it back to Pending.
- Pass numbers come from a locked sequence (`NRGP-2026-0001`), so two requests can never get the same number.
- **Gate:** only approved, non-deleted passes can move. Outward passes exit, Inward passes enter, and RGP passes exit then return. If a pass has a seal number, it must match, or the vehicle is held and approvers are notified.
- RGP needs a future return date. Overdue returns appear on the dashboard.
- **Registered Person (vendor):** can only raise Inward requests, the pass is always tied to their own company, and they only see their own passes. End Users only see their own passes too.
- **Direct entry and delete** need the `direct` permission and a reason. Deletes are soft deletes, and both actions go into the append-only audit log.
- **Visitors:** answering "Yes" to any health question requires details and flags the request. Visitors can only be checked in after approval.
- **Weighbridge:** gross must be more than tare, and net weight is calculated by the database. An entry must link to an approved pass. Whoever recorded an entry can't approve it.
- **Permissions:** can be edited per role and screen, and every change is audited. The Super Admin can't lose User or Role management.

## 6. API overview (`/api/v1`)

| Area | Endpoints |
|---|---|
| Auth | `POST auth/login, register, forgot-password, reset-password, change-password` · `GET/PATCH auth/me` |
| Gate passes | `GET gate-passes` (filters, paging, role-scoped) · `GET gate-passes/:id` · `GET gate-passes/lookup?q=` · `POST gate-passes` · `PUT gate-passes/:id` (amend) · `POST :id/decision` · `POST decisions/bulk` · `DELETE :id` · `POST :id/gate` · `POST/GET :id/attachments` |
| Visitors | `POST public/visitors` · `GET public/visitors/:token` · `GET visitors` · `POST visitors/:id/decision, check-in, check-out` |
| Weighbridge | `GET/POST weighbridge` · `POST weighbridge/:id/decision` |
| Masters | `GET/POST masters/:kind` · `PUT masters/:kind/:id` · `PATCH masters/:kind/:id/active` (materials, vendors, contractors, sub-contractors, service-vendors) |
| Admin | `users` (CRUD, activate) · `roles` + `roles/:code/permissions` · `audit` |
| Insights | `dashboard` · `dashboard/analytics` · `reports/:kind?format=json\|csv\|xlsx` · `notifications` |

## 7. Waiting on MARS

| Item | Status in code |
|---|---|
| MARS SSO (SAML/OAuth2) | The button is ready. Needs the IdP metadata from MARS IT. |
| SMTP server | Emails are logged until `SMTP_*` is set. |
| Weighbridge indicator feed | Weights are typed in for now. A serial or API feed can post to `POST /weighbridge`. |
| SAP integration | Out of scope per the Scope Document. Masters can be synced into the master tables later. |
| Real master data | Load it through the Master Data screens, or bulk-insert into `vendors` and `materials`. |
| Domain, server, EA review | Needed before production deployment. |
| Office cabs, Vehicle Master, 2-level approval | Not built. Waiting for a scope decision. |
