# ExamPlat Admin Portal

A role-based MERN admin portal for managing final examinations, mock tests, candidates, student records, result delivery, and admin activity. The backend shares the Student Portal's MongoDB database and keeps final-exam, mock-test, attempt, and allow-list records in dedicated collections.

## Tech stack

- **Frontend:** React 18, Vite 5, React Router 6, Axios, Tailwind CSS
- **Backend:** Node.js, Express 4, Mongoose 8
- **Database:** MongoDB / MongoDB Atlas
- **Authentication:** bcrypt password hashing and JWT bearer authentication
- **Uploads:** Multer with XLSX and JSON parsing
- **Results:** PDFKit for response PDFs and Nodemailer for SMTP/Brevo delivery

## Application structure

```text
client/
  src/pages/       Login, dashboard, exams, mock tests, students, and admin screens
  src/components/  Navigation, protected-route, and access-picker components
  src/context/     Authentication state and role helpers
  src/api/         Shared Axios instance and JWT interceptor
server/
  controllers/     Authentication, admins, final exams, mock tests, and students
  routes/          Express route definitions
  models/          Mongoose models for shared and admin-specific collections
  middleware/      JWT, role, password-change, and active-account checks
  utils/           Upload parsing, audit logging, browser detection, and result delivery
```

Default development ports:

- React/Vite client: `http://localhost:5174`
- Express API: `http://localhost:5020` when using the shipped `.env.example`
- Server fallback port: `5001` if `PORT` is not set

## Roles and access

### Super Admin

- Manages the `superadmin` account seed and other admin accounts
- Creates, deletes, modifies, and controls result publication for final examinations
- Assigns regular admins who may modify an examination
- Sends final-exam result-release notifications
- Views and filters the admin audit log
- Views and exports the student directory

### Regular Admin

- Creates and manages mock tests
- May modify examinations when the Super Admin grants access through `allowAllAdmins` or `allowedAdmins`
- Views the examination dashboard, candidates, and candidate details
- Views and exports the student directory

Every protected route rechecks the account's database state. Disabled accounts receive `401`; accounts that have not changed their initial password receive `403` until password change is complete.

## Implemented features

### Authentication and security

- One login flow for Super Admin and regular Admin roles
- Roles are derived server-side from the `Admin` record, not supplied by the client
- Passwords are stored as bcrypt hashes
- JWT bearer authentication with configurable expiry
- Forced initial password change
- Active-account enforcement on every protected request
- Role middleware and central Express error handling

### Dashboard

- Examination totals and Scheduled / Live / Completed counts
- Filterable recent examination activity
- Super Admin shortcut for creating examinations
- Links to full examination management

### Final examinations

- Super Admin-only creation
- `.xlsx` or `.json` question-bank uploads
- Optional HTTP(S) question image URL for final examinations
- XLSX candidate allow-list uploads
- Configurable start/end date and time, duration, attempts, subject, and exam category (`JEE` or `NEET`)
- Either all eligible students or an explicitly uploaded allow-list
- Per-examination modify access for regular admins
- Searchable, paginated candidate allow-list
- Per-candidate start/end/attempt overrides
- Candidate status, violations, attempts, responses, and score detail
- Examination deletion and result publication restricted to Super Admin
- SMTP/Brevo result-release email delivery
- Startup cleanup for stale indexes left by older/shared portal schemas

### Mock tests

- Regular-Admin-only creation
- `.xlsx` or `.json` question banks
- XLSX candidate allow-list uploads
- Schedule, duration, attempts, category, subject, and selected students
- Candidate operations and result publication
- Dedicated mock-test and mock-attempt collections

### Question and candidate validation

- Question text, four options, and `correctOption` are required
- `correctOption` accepts `A-D`, `1-4`, or `0-3`
- Duplicate question text is rejected
- Image URLs must use `http://` or `https://`
- Candidate Hall Ticket Number is required and duplicate entries are rejected
- Candidate `dob` is optional in XLSX uploads
- Invalid rows are reported by row number and are not silently accepted
- Upload limit: 15 MB per file

### Admin management and audit logs

- List, create, and disable regular admins
- Searchable and filterable admin activity
- Audit entries capture actor, action, target, metadata, IP address, and user agent

### Student directory

- Server-side search and pagination
- Excel export of matching student records

## Upload templates

Sample files are available in `client/public/samples/`:

- `question-bank-template.xlsx`
- `question-bank-template.json`
- `allowed-candidates-template.xlsx`

## MongoDB collections

| Purpose | Collection/model |
|---|---|
| Admin accounts | `admins` / `Admin` |
| Admin audit history | `adminlogs` / `AdminLog` |
| Shared students | `students` / `Student` |
| Final exams | `finalexams` / `FinalExam` |
| Final questions | `finalquestions` / `FinalQuestion` |
| Final candidate allow-list and overrides | `finalallowedcandidates` / `FinalAllowedCandidate` |
| Final attempts | `finalattempts` / `FinalAttempt` |
| Mock exams | `tests` / `Test` |
| Mock questions | `questions` / `Question` |
| Mock candidate allow-list | `allowedcandidates` / `AllowedCandidate` |
| Mock attempts | `mockattempts` / `MockAttempt` |
| Exam registrations | `examregistrations` / `ExamRegistration` |

Startup logic removes known stale unique indexes that may be created by the separately running Student Portal. It also ensures allow-list indexes used for uniqueness and Hall Ticket search.

## API overview

Base URL: `/api`

| Area | Main endpoints |
|---|---|
| Health | `GET /health` |
| Authentication | `POST /auth/login`, `GET /auth/me`, `PUT /auth/change-password` |
| Admin management | `GET /admins`, `POST /admins`, `PUT /admins/:id/disable`, `GET /admins/logs` |
| Students | `GET /students`, `GET /students/export` |
| Final exams | `GET/POST /tests`, `GET/PUT/DELETE /tests/:id`, `GET /tests/eligible-count` |
| Final exam access/results | `PUT /tests/:id/managers`, `PATCH /tests/:id/results-published`, `POST /tests/:id/send-result-notification` |
| Final candidates | `GET/POST /tests/:id/candidates`, `GET/PUT /tests/:testId/candidates/:candidateId` |
| Mock tests | `GET/POST /mock-tests`, `GET/PUT/DELETE /mock-tests/:id`, `GET /mock-tests/eligible-count`, `POST /mock-tests/:id/publish-results` |
| Mock candidates | `GET/POST /mock-tests/:id/candidates`, `GET/PUT /mock-tests/:testId/candidates/:candidateId` |

Protected endpoints require `Authorization: Bearer <JWT>`.

## Backend setup

Requirements:

- Node.js 18 or newer
- npm
- MongoDB URI shared with the Student Portal
- An SMTP/Brevo account for result emails

```bash
cd server
npm install
cp .env.example .env
npm run seed
npm run dev
```

`npm start` runs the server without Nodemon. `npm run seed` creates or reuses the configured Super Admin account.

The seed is idempotent. The shipped defaults are:

- Email: `super.admin@examplat.com`
- Password: `superAdmin@123`

Change both values through `SUPERADMIN_EMAIL` and `SUPERADMIN_PASSWORD`, and change the default password immediately after the first login. The seeded account must change its password before it can use protected portal routes.

## Frontend setup

```bash
cd client
npm install
cp .env.example .env
npm run dev
```

The Vite server runs on port `5174` and proxies `/api` to `http://localhost:5020` in development. `VITE_API_URL` defaults to `/api` in the browser if it is not set.

```bash
npm run build
npm run preview
```

## Environment variables

### Server `server/.env`

| Variable | Required | Purpose |
|---|---|---|
| `MONGO_URI` | Yes | MongoDB connection string for the shared database |
| `JWT_SECRET` | Yes | Secret used to sign and verify JWTs |
| `JWT_EXPIRES_IN` | No | JWT lifetime, default `8h` |
| `PORT` | No | API port, default `5001` |
| `CLIENT_ORIGIN` | Recommended | Comma-separated allowed browser origins; `5173` and `5174` are accepted locally |
| `SUPERADMIN_EMAIL` | For seed | Seeded Super Admin email, default `super.admin@examplat.com` |
| `SUPERADMIN_PASSWORD` | For seed | Initial seed password, default `superAdmin@123` |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `EMAIL_FROM` | For email | SMTP provider settings |
| `BREVO_SMTP_HOST` / `BREVO_SMTP_PORT` / `BREVO_SMTP_USER` / `BREVO_SMTP_PASS` / `BREVO_FROM_EMAIL` | Alternative | Brevo SMTP settings; supported by the result delivery utilities |

Do not commit `.env` or real credentials. Keep `JWT_SECRET` long, random, and stable across server restarts.

### Client `client/.env`

| Variable | Required | Purpose |
|---|---|---|
| `VITE_API_URL` | No | API base URL, for example `http://localhost:5020/api` |

If deployed separately, set `VITE_API_URL` to the deployed API URL and add the browser origin to `CLIENT_ORIGIN`.

## Result delivery

The Super Admin can publish final-exam results and send release emails. When email is configured, delivery utilities:

- Generate a PDF response summary for each candidate
- Include score, browser, attempt count, correct/wrong/unanswered counts, and responses
- Send an attendance/result email for attempted and not-attempted candidates
- Record delivery status and errors on the candidate record

Result release emails currently link to `https://examplatstudent.vercel.app/final-result`.

## Development notes

- The client stores the JWT and basic admin profile in `localStorage`; logout removes both.
- A `401` response clears local credentials and redirects to `/login`.
- The `requirePasswordChange` middleware blocks protected operations until the password is changed.
- Final exams and mock tests use separate IDs and collections to avoid cross-type collisions.
- No automated test suite is currently included in the repository.
- Run `npm run build` in `client/` as the primary frontend validation step.
