# BookingTicketCinema-SDN-Assignment

## UC-16.1 / UC-16.2: Revenue dashboard and CSV report
- Based on `docs/RDS-SWD391-Assignment.docx` (UC-16, UC-16.1, UC-16.2; BR-11, BR-13, BR-14) and `SDN302_AI_Coding_Rules.md`.
- Sign in as Admin, choose **Thống kê doanh thu** or open `/admin/revenue`. Filter an inclusive date range (up to 366 days), source, payment method, and daily/monthly grouping. Empty periods show zeros; failed calculations show an error without partial totals.
- Confirmed reporting convention: CSV with UTF-8 BOM for Excel, VND, `Asia/Ho_Chi_Minh` (UTC+07:00). Payments belong to their confirmation date and refunds to their completion date. `payments = gross - discounts + fees - points`; `net = payments - refunds`. `points` is the redeemed VND value, not the number of points, and is not counted as cash. Fees are included in money collected. A refund-only period may have negative net revenue.
- **Current source coverage:** finalized `FoodSale` cash receipts with confirmation, matching line totals and received cash/change are included. Pending, cancelled, reconciliation, and unconfirmed sales are excluded. Ticket revenue (including food bundled with a ticket) comes only from trusted `RevenueEntry` settlement/refund records. Existing `Booking.status = paid`, `paymentStatus = paid`, browser returns and mock payments are not proof and are never automatically converted into receipts. No historical ticket revenue or refunds are guessed from current catalogue prices or mutable booking timestamps.
- The current ticket payment/refund modules do not yet produce verified entries. Their producer integration remains required when those settlement UCs are implemented; existing demo ticket bookings therefore do not appear as verified ticket revenue. The dashboard and CSV both disclose this source limitation.
- `RevenueEntry` is an append-only reporting contract with **no public write endpoint**. Trusted ticket finalization must write a record in the same transaction as settlement, once per booking: `booking`, globally unique `reference`, `kind: payment`, `confirmedAt`, `currency: VND`, `method`, `evidence`, and integer `gross`, `discounts`, `fees`, `points`, `amount`. Cash uses `employee-receipt`, gateways use `provider-confirmation`, and zero-cash points-only settlements use `points-ledger`. Store the accepted price snapshot, never current movie/food prices. Only finalized evidence may enter this collection.
- A verified full refund creates a separate `kind: refund` entry for the original `booking`, method and entire cash `amount`, with `originalReference` pointing to its payment and the refund's actual confirmation date/evidence. Do not modify/remove the original payment. Unique booking/kind and reference indexes prevent duplicate final records; unconfirmed/failed refunds create no entry. Reporting rejects mismatched originals, partial cash refunds and invalid amount breakdowns.
- `POST /api/revenue/reports` takes `{ from, to, source, method, groupBy }` and returns a server-owned snapshot. `source`: `all|tickets|food`; `method`: `all|cash|vnpay|momo|credit-card|points`; `groupBy`: `day|month`. Both dates are `YYYY-MM-DD`. Confirmed entries and arrival timestamps are bounded by `dataTimestamp`.
- `POST /api/revenue/reports/:id/export` takes the same filters and returns a complete CSV from that stored result, without recalculating transactions. Only the creating Admin can export it; changed filters require refreshing, and snapshots expire after 30 minutes. CSV includes filters, timezone, data/export timestamps, basis, source coverage, totals, source breakdown and each period. All endpoints verify active Admin sessions; JSON/Origin checks protect requests, responses use `no-store`, and report creation/export log acting Admin and report IDs.
- Uses existing Express/Mongoose/React and a native SVG chart with a visible data table; no additional packages. New files: revenue route/controller/service, `RevenueEntry` and `RevenueReport` models, Admin page/CSS, frontend service, and `backend/test_revenue.js`.
- Checks: `npm run test:revenue -w backend`, `npm test -w backend`, `npm run build`. Integration tests create/remove their own unique temporary database and leave cinema data unchanged.

## UC-7.3 View Booking History (NhaNTK)
- Members open `/bookings` from their dashboard or the account area's "Lịch sử đặt vé" section.
- `GET /api/bookings` uses the authenticated Member, ignores client-supplied user IDs, and returns owned orders newest first, including cancelled and expired orders.
- History shows order/payment statuses, showtime, seats, food quantities, points discount and totals. Reading history never changes a booking, seat hold or points balance. Missing catalogue references do not remove historical orders.
- Run `npm run test:booking-history -w backend`. Tests use and remove their own temporary database, leaving `booking_cinema` unchanged.

## UC-8 Search Member Information (NhaNTK)
- Employees open `/employee/members`; Admins open `/admin/members` from their dashboard. Both search by a complete email or phone number, then select a result for current Member information.
- `GET /api/members/search?q=...` matches email case-insensitively or phone formatting (`0901 234 567`, `+84 901 234 567`, `0084901234567`). It returns up to 20 matching Members with `hasMore` for ambiguous numbers. `GET /api/members/:id` rereads the selected Member.
- Both endpoints require an active Employee or Admin session. Employees receive only `_id`, `fullName`, `email`, `phone`, `status`, `memberPoints`, and `isVIP`; Admins additionally receive `age`, `gender`, `role`, `createdAt`, `updatedAt`, and `lastLogin`. Permissions use the authenticated database role, never client-supplied roles or field lists. Staff accounts, password hashes, tokens and security counters are excluded for both roles. Lookups do not change accounts; audit messages contain actor IDs/roles and result counts, without search terms.
- Run `npm run test:member-search -w backend`. Tests use and remove a dedicated temporary database.

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

### Implemented CE190580 scope (Khai)
- UC-13.1: Add Movie — Admin form with server validation and creator tracking.
- UC-13.2: View Movies — Admin catalogue with title search, pagination and movie details.
- UC-13.3: Update Movie — use **Sửa** in the Admin catalogue. The editor shares validation with Add Movie, checks the loaded version to reject stale writes and records `updatedBy`. Movies with any showtime lock title, duration, classification and release date; other descriptive fields remain editable.
- UC-13.4: Delete Movie — use **Xóa** and confirm. Movies referenced by any showtime are blocked. Other movies are soft deleted with `deletedAt`/`deletedBy`; references and audit history are retained, and the movie is hidden from public/Admin catalogues and cannot be booked.
- UC-15.1 / UC-15.5: Add F&B / Promotion — Admin-only forms at `/admin/foods/new` and `/admin/promotions/new`.
- UC-15.2 / UC-15.6: View F&B / Promotions — Admin lists at `/admin/foods` and `/admin/promotions` include inactive/expired records, details, literal title/code search and pagination.
- UC-15.3 / UC-15.7: Update F&B / Promotion — use **Sửa**. Version checks reject stale edits; sales increment the Food version so an old Admin form cannot overwrite freshly deducted stock.
- UC-15.4 / UC-15.8: Delete F&B / Promotion — use **Xóa** and confirm. Soft deletion hides records from sale/eligibility while preserving references, recorded sale prices, audit fields and historical promotion codes.
- Sign in at `/admin/login`, then choose **Quản lý phim** or open `/admin/movies`.
- Choose **Thêm phim** to open `/admin/movies/new`; Cancel returns without saving.
- Movie media uses existing local asset paths or HTTP(S) URLs; file upload is not included.
- Existing seeded movies keep their `ageLimit`; new movies also store the classification (`P`, `K`, `T13`, `T16`, `T18`, `C`). C movies are excluded from the public catalogue and rejected at booking.
- API: `GET /api/movies/admin?search=&page=1&limit=10` and `POST /api/movies` require an active Admin session. Public `GET /api/movies` keeps its array response.
- Run `npm run test:movies -w backend` with MongoDB running. Tests create and remove their own temporary database and do not change `booking_cinema`.

### UC-15: F&B and promotion configuration

- In the Admin dashboard, choose **Quản lý F&B** or **Quản lý khuyến mãi**. Both lists support Add, details, Edit, Cancel, confirmed Delete, empty states and retry after retrieval failures.
- F&B fields: name, description, image URL/local path, whole-VND price, integer stock and availability. Active names must be unique, ignoring case. Legacy items without stock can be edited to establish their starting inventory.
- Open counter orders (pending, payment received or reconciliation) and unexpired pending ticket orders protect products from deletion. Such products cannot change price/availability or reduce stock; replenishment and descriptive edits are allowed. Completed counter receipts retain their original item names and prices.
- Promotion fields: unique uppercase code, name/description, percentage (1–100) or fixed VND discount, minimum order value, optional percentage discount cap, scope (food/ticket/all), explicit stacking choice, start/end, optional total usage limit and activation flag. Empty usage limit/cap means unlimited. Codes remain reserved after deletion for historical traceability.
- Start/end fields are entered/displayed in Vietnam time (UTC+7), sent with an explicit offset and stored as UTC. End must be after start. Admin can manage past/future campaigns; the public eligibility list excludes paused, future, expired, exhausted and deleted records.
- `usedCount` is server-owned and cannot be changed through Admin requests. A usage limit cannot be lowered below usage already recorded. After use, code, discount type/value and scope are locked. Creates/updates/deletes record the acting Admin; failed or cancelled requests do not change financial history.
- API for each resource (`foods` or `promotions`): protected `GET /api/<resource>/admin`, `GET /api/<resource>/admin/:id`, `POST /api/<resource>`, `PUT /api/<resource>/:id`, `DELETE /api/<resource>/:id`. Update/Delete require the loaded `version` (`__v`). Writes require JSON and reject cross-site/untrusted-origin requests.
- Public `GET /api/foods` keeps its array response and returns only non-deleted available items. `GET /api/promotions?scope=food` returns currently eligible campaign candidates (also supports `ticket` or `all`). These endpoints configure/expose campaign rules; they do not apply or redeem a discount.
- Checkout integration (UC-9.2/UC-9.3) must calculate discounts against eligible items, clamp discounts to the eligible amount, enforce stacking and atomically recheck dates/limits and increment `usedCount` plus `__v` with paid settlement. Existing point payments and the cash-only F&B screen do not automatically apply promotion codes in this change.
- Run `npm run test:catalogue -w backend` or `npm test -w backend`. Tests cover all eight Admin operations, authorization, validation, duplicate/concurrent creates, stale inventory, protected orders, campaign eligibility, preserved history and safe errors in temporary databases.

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

### Implemented CE190006 scope
- Trang chủ trải nghiệm điện ảnh chuẩn Netflix (Hero Banner, Phim Đang Chiếu, Phim Sắp Chiếu, Footer)
- Chi tiết phim (Movie Detail) phong cách Netflix cinematic
- Book Movie Ticket
- Add Food & Drink
- Reserve Seat (10-minute hold)
- Payment Process
- Apply Member Point
- Payment via VNPay (demo flow; real merchant credentials can be plugged in later)
- Create Account
- Update Account Status
- Adjust Member Points
