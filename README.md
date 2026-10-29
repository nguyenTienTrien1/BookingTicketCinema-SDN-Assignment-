# BookingTicketCinema-SDN-Assignment

## Run backend
1. Install MongoDB and make sure it is running.
2. `cd backend`
3. Copy `.env.example` to `.env`.
4. `npm install`
5. `npm run seed`
6. `npm run dev`

## Run frontend
1. `cd frontend`
2. `npm install`
3. `npm run dev`
4. Open the Vite URL.

## Demo accounts
Member: `member@cinema.com` / `123456`
Admin: `admin@cinema.com` / `admin123`

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
