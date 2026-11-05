# BookingTicketCinema-SDN-Assignment

## UC-7.3 View Booking History (NhaNTK)
- Members open `/bookings` from their dashboard or the account area's "Lịch sử đặt vé" section.
- `GET /api/bookings` uses the authenticated Member, ignores client-supplied user IDs, and returns owned orders newest first, including cancelled and expired orders.
- History shows order/payment statuses, showtime, seats, food quantities, points discount and totals. Reading history never changes a booking, seat hold or points balance. Missing catalogue references do not remove historical orders.
- Run `npm run test:booking-history -w backend`. Tests use and remove their own temporary database, leaving `booking_cinema` unchanged.

## UC-8 Search Member Information (NhaNTK)
- Employees open `/employee/members` from their dashboard, search by a complete email or phone number, then select a result for current contact, status and loyalty information.
- `GET /api/members/search?q=...` matches email case-insensitively or phone formatting (`0901 234 567`, `+84 901 234 567`, `0084901234567`). It returns up to 20 matching Members with `hasMore` for ambiguous numbers. `GET /api/members/:id` rereads the selected Member.
- Both endpoints require an active Employee session and expose only `_id`, `fullName`, `email`, `phone`, `status`, `memberPoints`, and `isVIP`. Staff accounts and credentials are excluded. Lookups do not change accounts; audit messages contain IDs and result counts, without search terms.
- Run `npm run test:member-search -w backend`. Tests use and remove a dedicated temporary database.

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
- UC-15.2 / UC-15.6: View F&B / Promotions — Admin lists at `/admin/foods` and `/admin/promotions` include inactive/expired records, details, literal title/code search and pagination.
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

## UC-17.1–17.4: Manage Showtimes (Admin)
- RDS numbering: **UC-17.1 Add Showtime**, **UC-17.2 View Showtimes**, **UC-17.3 Update Showtime**, **UC-17.4 Delete Showtime**. The historical View/Add commit titles used reversed numbers; this correction retains shared Git history.
- Sign in at `/admin/login`, choose **Quản lý suất chiếu**, or open `/admin/showtimes`.
- View the paginated list and filter by movie. Add a showtime, edit it, or review its details and confirm deletion. Cancel leaves the data unchanged.
- Required fields: movie, cinema, room, future start time and a positive whole-number ticket price in VND. All form times use Vietnam time (UTC+7).
- Reuses Express, Mongoose, React and the Admin CSS; adds no packages. `CinemaRoom` holds `cinema`, `name`, `status` (`Active`, `Inactive`, `Maintenance`) and a unique, non-empty seat layout. Admin selects a configured room; the server verifies it independently. New showtimes copy that room's seats instead of a fixed 40-seat layout. An unbooked screening moved to another layout receives the selected room's layout; unchanged layouts keep their seat identifiers. Existing showtimes remain readable without the optional new `roomId` reference.
- Checks room conflicts across movies, including the movie duration plus a 15-minute cleaning buffer (BR-6). Deleted/C-classified movies, inactive/missing rooms, invalid layouts and screenings before the release date are rejected.
- Direct edit/delete is blocked for started screenings, seat holds, sold seats and any booking reference, including cancelled bookings, preserving transaction history (BR-12, BR-17). Controlled cancellation, customer notice and refunds are outside these four use cases.
- API: `GET /api/showtimes?movie=&page=1&limit=10`, `POST /api/showtimes`, `PUT /api/showtimes/:id`, `DELETE /api/showtimes/:id`. All require an active Admin session. Writes require JSON and validate the request origin.
- Admin-only `GET /api/showtimes/rooms` returns active configured rooms; `GET /api/showtimes/:id` retrieves the latest screening for conflict recovery without seat booking identifiers. On a 409 while editing/removing, the UI reloads the current data and asks Admin to review it before another confirmation; it never retries a write automatically.
- POST/PUT fields: `movie`, `cinema`, `room`, `startTime` (ISO timestamp with timezone), `price`. PUT/DELETE also require the `updatedAt` value from the list; stale data returns 409. DELETE sends `{ "updatedAt": "..." }` as JSON.
- Successful writes log the acting Admin and showtime ID to the server audit log. The existing public `/api/movies/showtimes` response remains unchanged and reflects saved changes.
- Room setup: copy `backend/rooms.example.json` to your own JSON file and enter the actual room names, statuses and seat numbers. Run `npm run import:rooms -w backend -- rooms.example.json` from the project root for the explicit demo example, or pass an absolute path to your own configuration. This setup command validates the input and only inserts missing rooms; it never overwrites rooms, layouts, showtimes or bookings. It is not run automatically. The UC-14 room/seat management UI remains a separate use case; this model and read endpoint provide the scheduling dependency.
- Schedule writes are protected against concurrency within the current single Node process; multiple backend instances would need a shared database lock. Audit logs need external retention for deployment. Do not change room names/layouts directly while the server handles scheduling; UC-14 must protect those changes under BR-17 when implemented. Existing ticket price snapshots are not changed by the setup command.
- Run `npm run test:showtimes -w backend` with MongoDB running. Tests create and remove a dedicated temporary database, leaving existing cinema data untouched. Run `npm run build` to verify the frontend build.

The diagram's View → Controller → Service → Model → Database flow maps to:

| RDS use case | React view/client | Controller | Service | Mongoose operation |
| --- | --- | --- | --- | --- |
| 17.1 Add | `ManageShowtimes` / `addShowtime` | `addShowtime` | `validateAndCreate` | `Showtime.create` |
| 17.2 View | `ManageShowtimes` / `getAdminShowtimes` | `viewShowtimes` | `listShowtimes` | `Showtime.find` |
| 17.3 Update | `ManageShowtimes` / `updateShowtime` | `updateShowtime` | `validateAndUpdate` | `Showtime.findOneAndUpdate` |
| 17.4 Delete | `ManageShowtimes` / `deleteShowtime` | `deleteShowtime` | `validateAndRemove` | `Showtime.findOneAndDelete` |

`ShowtimeModel` in the diagrams is the existing Mongoose `Showtime` model. Model/database operation names are expressed using Mongoose APIs rather than an extra wrapper layer. Conditional writes protect against a seat claim or stale version between validation and saving. The code retains basic JavaScript, async/await, Express middleware and the repository's existing service layer, following the SDN302 coding rules.

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
