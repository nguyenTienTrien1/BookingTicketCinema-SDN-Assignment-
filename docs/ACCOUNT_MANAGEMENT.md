# Admin account creation and updates

Admin → **Tạo tài khoản** creates an Employee or Admin. The server generates a unique 28-character random password, stores its bcrypt hash and emails the login email, password and login link. New staff can sign in after successful SMTP acceptance and change their password in Profile. There is no activation confirmation step for new accounts.

Email uses the configured `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE`, `EMAIL_FROM`, `CLIENT_URL`, or supported Gmail aliases. It never falls back to a sandbox or JSON transport for credentials. If email fails, the response explicitly reports `emailSent: false`; the saved account remains Pending Activation and cannot sign in. **Gửi lại email** generates a new password and retries delivery. Active accounts cannot be reset through this retry endpoint. Overlapping sends are rejected; an interrupted send can be retried after 60 seconds. No plaintext password is returned to Admin, written to the database, or logged.

Admin → **Cập nhật tài khoản** supports search/filter, editing name/email/phone, staff role and status. **Lưu thay đổi** saves directly without a confirmation popup. Member accounts retain their Member role. Updates check the loaded version and status, reject duplicate emails and protect against concurrent overwrites. Locking or changing roles revokes sessions. Admin cannot disable/demote themselves or remove the last active Admin. An account awaiting credentials/verification cannot be activated through the editor.

Endpoints (Admin session required):

- `POST /api/users`: `{ fullName, email, phone?, role }`; role is `employee` or `admin`. Password/status/points fields are rejected.
- `PATCH /api/users/:id`: `{ fullName, email, phone, role, status, version, expectedStatus }`. The loaded `__v` supplies `version`; this is concurrency metadata, not user confirmation.
- `POST /api/users/:id/credentials-email`: retries a pending staff email. Old invitation endpoints remain compatible with previously issued invitations.

Validation uses 1–100 characters for name, a valid email of at most 254 characters and optional phone with 9–15 digits, optionally prefixed by `+`. Cookie-authenticated writes enforce JSON and trusted origins.

Run `npm run test:accounts -w backend` and `npm run test:accounts:ui -w backend`. Both use isolated random databases and a real loopback SMTP receiver; no messages go to external inboxes. Browser checks include successful create/email/login, updates without dialogs, failed/retried email, duplicate emails, stale updates and desktop/mobile layout. Screenshots are in `.local/qa/accounts/`.
