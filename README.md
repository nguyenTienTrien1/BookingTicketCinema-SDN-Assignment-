# BookingTicketCinema-SDN-Assignment

## Run backend
1. Install MongoDB Server and make sure `mongod` is on PATH.
2. `cd backend`
3. Copy `.env.example` to `.env`.
4. `npm install`
5. `npm run db:local` (starts the local replica set required for booking transactions).
6. `npm run seed` (initial demo data only).
7. `npm run dev`

Payment uses an explicitly labelled simulation; no real money is collected. See [completed use cases and local setup](docs/UC_COMPLETION.md) for test results, points rules, inventory and staff activation.

## Run frontend
1. `cd frontend`
2. `npm install`
3. `npm run dev`
4. Open the Vite URL.

## Demo accounts
Member: `member@cinema.com` / `123456`
Admin: `admin@cinema.com` / `admin123`

## UC-5: Member profile
- Sign in as a Member, then open `/profile` or **Tài khoản → Hồ sơ**.
- UC-5.1: Update full name (1–100 characters), optional phone (9–15 digits with optional `+`), optional age (0–120), and gender. Cancel discards unsaved changes.
- UC-5.2: Supply the current password and matching new password confirmation. The new password must differ, contain at least 6 characters and fit within bcrypt's 72-byte UTF-8 limit. Five incorrect current passwords lock password attempts for 15 minutes. Success signs out all existing sessions.
- UC-5.3: Read the latest profile from the database. Email, membership points, VIP tier and account status are read-only.
- These fields follow the existing User model; the supplied UC list does not include additional field-level business rules.
- APIs: `GET /api/users/me`, `PATCH /api/users/me`, `PATCH /api/users/me/password`. All require an active Member session; writes accept JSON from the configured `CORS_ORIGIN`.
- Test with `npm run test:profile -w backend` while MongoDB is running. Tests use and remove a separate temporary database without changing existing cinema data.

## Implemented CE190580 scope (Khai)
- UC-13.1: Add Movie — Admin form with server validation and creator tracking.
- UC-13.2: View Movies — Admin catalogue with title search, pagination and movie details.
- Sign in at `/admin/login`, then choose **Quản lý phim** or open `/admin/movies`.
- Choose **Thêm phim** to open `/admin/movies/new`; Cancel returns without saving.
- Movie media uses existing local asset paths or HTTP(S) URLs; file upload is not included.
- Existing seeded movies keep their `ageLimit`; new movies also store the classification (`P`, `K`, `T13`, `T16`, `T18`, `C`). C movies are excluded from the public catalogue and rejected at booking.
- API: `GET /api/movies/admin?search=&page=1&limit=10` and `POST /api/movies` require an active Admin session. Public `GET /api/movies` keeps its array response.
- Run `npm run test:movies -w backend` with MongoDB running. Tests create and remove their own temporary database and do not change `booking_cinema`.

## Implemented CE190006 scope
- Book Movie Ticket
- Add Food & Drink
- Reserve Seat (10-minute hold)
- Payment Process
- Apply Member Point
- Payment via VNPay (demo flow; real merchant credentials can be plugged in later)
- Create Account
- Update Account Status
- Adjust Member Points
