# ExamPlat — Admin Portal (MERN)

Implements the Admin Portal SRS (Sections 1–10) against the same MongoDB Atlas cluster
already used by the Student Portal, per `Registration_page_DB_info.docx`.

## Structure

```
server/   Express + Mongoose API  (port 5001)
client/   React (Vite) + Tailwind SPA  (port 5174)
```

## Backend setup

```bash
cd server
npm install
cp .env.example .env      # fill in MONGO_URI (same cluster as Student Portal) and JWT_SECRET
npm run seed               # creates the shipped Super Admin (super.admin@examplat.com / superAdmin@123)
npm run dev                 # nodemon, http://localhost:5001
```

The seed script is idempotent — safe to run once per environment. The Super Admin is forced to
change their password on first login (`mustChangePassword` flag, NFR-A-01).

## Frontend setup

```bash
cd client
npm install
cp .env.example .env       # VITE_API_URL=http://localhost:5001/api
npm run dev                 # http://localhost:5174
```

Vite is also configured to proxy `/api` to `localhost:5001` in dev, so `VITE_API_URL` can be
left as `/api` if you prefer same-origin requests.

## What's implemented (mapped to the SRS)

| SRS Section | Feature | Where |
|---|---|---|
| 3.1 | Single login for Admin + Super Admin, server-determined role | `authController.js`, `Login.jsx` |
| 3.2 | Manage Admins: list / create / disable (Super Admin only) | `adminController.js`, `ManageAdmins.jsx` |
| 4 | Create Test: question upload (.xlsx/.json), schedule, candidate allow-list (.xlsx) | `testController.js#createTest`, `CreateTest.jsx` |
| 4.1 | Row-level validation errors on question upload | `utils/parseUploads.js` |
| 5.1 | Test List | `TestList.jsx` |
| 5.2 | Modify Test: edit time-of-day (not date), attempts, add candidate, search | `ModifyTest.jsx`, `testController.js` |
| 5.3 | Per-candidate overrides vs. test defaults | `AllowedCandidate` model (`*Override` fields), `CandidateDetail.jsx` |
| 5.4 | Recurring slots via repeating Create Test | supported naturally — each Create Test call gets its own `testId` |
| 6 | Candidate detail: status, violations, score | `CandidateDetail.jsx`, `getCandidateDetail` |
| 7 | Data model | `server/models/*.js` |
| NFR-A-01 | Salted bcrypt hashes, forced password change | `Admin.js`, `seed.js`, `changePassword` |
| NFR-A-02 | Audit log of schedule/attempt edits | `AdminLog.js`, `utils/helpers.js#logAction` |
| NFR-A-04 | Admin sessions use their own short-lived JWTs | `middleware/auth.js` |
| NFR-A-05 | Server-side search/pagination on candidate list | `listCandidates` (skip/limit + text index) |

## Assumptions made where the SRS/brief left things open (Section 10)

- **Question bank editing**: not implemented as edit-in-place; re-upload via a new test (or a future
  "Clone Test" action) is the supported path for now, per the "recommended" note in Section 8/10.
- **Delete vs. archive**: no hard delete route was built; tests can only be modified, not deleted,
  preserving the audit trail as recommended.
- **Candidate DOB source**: the candidate Excel upload can optionally include a `dob` column;
  if omitted, `dob` is left null pending a future integration with the Student Portal's `Student`
  collection (per `Registration_page_DB_info.docx`, Collection 1: `students`).
- **Admin roles**: the DB-info doc's proposed `Admin` model included a richer
  `role: ["Super Admin","Exam Manager","Support Admin"]` + `permissions[]` scheme. The SRS's
  simpler `superadmin|admin` binary was followed instead since it's the authoritative spec
  document; the richer permission array can be layered on later without a breaking schema change.
- **Notification method** for sending candidates their Test ID/credentials: left out of scope, as
  in Section 10.

## Auth flow

1. `POST /api/auth/login` — returns a JWT (`JWT_EXPIRES_IN`, default 8h) plus the admin's role.
2. Every subsequent request sends `Authorization: Bearer <token>`.
3. `middleware/auth.js` re-checks `active` on the DB record on every request, so disabling an
   Admin (Section 3.2) takes effect immediately without waiting for token expiry.
# ExamPlat-AdminPortal
