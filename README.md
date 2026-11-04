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
- UC-13.3: Update Movie — use **Sửa** in the Admin catalogue. The editor shares validation with Add Movie, checks the loaded version to reject stale writes and records `updatedBy`. Movies with any showtime lock title, duration, classification and release date; other descriptive fields remain editable.
- UC-13.4: Delete Movie — use **Xóa** and confirm. Movies referenced by any showtime are blocked. Other movies are soft deleted with `deletedAt`/`deletedBy`; references and audit history are retained, and the movie is hidden from public/Admin catalogues and cannot be booked.
- Sign in at `/admin/login`, then choose **Quản lý phim** or open `/admin/movies`.
- Choose **Thêm phim** to open `/admin/movies/new`; Cancel returns without saving.
- Movie media uses existing local asset paths or HTTP(S) URLs; file upload is not included.
- Existing seeded movies keep their `ageLimit`; new movies also store the classification (`P`, `K`, `T13`, `T16`, `T18`, `C`). C movies are excluded from the public catalogue and rejected at booking.
- API: `GET /api/movies/admin?search=&page=1&limit=10` and `POST /api/movies` require an active Admin session. Public `GET /api/movies` keeps its array response.
- Run `npm run test:movies -w backend` with MongoDB running. Tests create and remove their own temporary database and do not change `booking_cinema`.

### UC-11: Standalone food and drink sales

- Sign in as an Employee, then open **Bán đồ ăn & thức uống** at `/employee/food-sales`.
- Select quantities, request the server-generated quote, confirm the total with the customer, enter the cash received and confirm receipt. The final receipt retains the item names, unit prices, quantities, total, employee, payment time and change.
- Only cash is implemented. This flow creates no booking, seat hold or movie ticket. VNPay, promotions, membership points and revenue dashboard integration are separate work.
- The `Food.stock` field is a non-negative integer. Existing products without stock cannot be sold at this counter until inventory is set. Optional local demo: `npm run seed:food-counter -w backend` adds three products with 30 units each **only if their names do not already exist**; it does not clear data or replenish existing items.
- API base `/api/food-sales`: Employee-only `GET /catalogue`, `POST /` (items and `requestId`), `GET /:id`, `POST /:id/cancel`, `POST /:id/pay`. An Employee can only access their own orders.
- Creating a quote snapshots server prices without deducting stock. Cancelling is allowed before cash confirmation. Request IDs and paid-order retries prevent duplicate orders or duplicate stock deductions.
- Finalization runs in a MongoDB transaction, so stock and the Paid receipt commit together. Cash receipt evidence is persisted first. If price/stock changed or finalization fails, the payment stays traceable for staff reconciliation; never collect cash again for that order. Reconciliation/refund resolution requires the cinema's operating procedure; there is no automatic second charge or manual Paid override in this screen.
- An order ID is retained in the browser session for refresh/recovery. If the response is lost, reopen the order and retry finalization of the existing payment, rather than creating a new payment.

#### MongoDB requirement for counter payment

Transactions need a replica set (a single-node replica set is sufficient locally). The agreed database and application ports remain `booking_cinema`, backend 3000 and frontend 5173. On standalone MongoDB, the UI disables payment and the API returns 503 before recording cash; quoting and cancellation still work.

To enable transactions on the local MongoDB service, add this top-level configuration to its `mongod.cfg`, restart the MongoDB service, then initialize the replica set once from `mongosh`:

```yaml
replication:
  replSetName: rs0
```

```javascript
rs.initiate({ _id: 'rs0', members: [{ _id: 0, host: '127.0.0.1:27017' }] })
```

Keep `MONGODB_URI=mongodb://127.0.0.1:27017/booking_cinema`. Do not initialize again if the service already belongs to a replica set. This repository does not change or restart the installed MongoDB service automatically.

Run `npm test -w backend` for regression tests. For the complete transaction/concurrency suite, point `TEST_MONGODB_URI` to a test-capable replica set and run `npm run test:food-sales -w backend`. All tests create their own temporary databases and remove only those databases.

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
