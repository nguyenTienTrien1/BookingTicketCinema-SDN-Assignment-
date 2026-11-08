# Role permissions

Reference: RDS-SWD391-Assignment.pdf, use-case actors and UC-8, UC-9, UC-12.1–12.3.
This table describes implemented endpoints, not every future use case in the RDS.

| Area | Guest | Member | Employee | Admin |
| --- | --- | --- | --- | --- |
| Public movies, showtimes and food catalogue | Read | Read | Read | Read |
| Public registration | Creates Member only | — | — | — |
| Profile and password | — | Own account | Own account | Own account |
| Online bookings, points redemption and payment | — | Own bookings | — | — |
| Member lookup by email/phone | — | — | Limited customer fields | Limited customer fields |
| Counter bookings and payment | — | — | Sales created by this employee | All counter sales |
| Staff account creation | — | — | — | Employee/Admin roles only |
| Account details/status and manual member point correction | — | — | — | Allowed; cannot disable/demote self/last active Admin |
| Movie administration | — | — | — | Allowed |

Guests have no stored role. Public registration never accepts a privileged role from the client.
All accounts now sign in at `/login` using `POST /api/auth/login`; no role selector or separate staff credentials form is required. The database role determines the destination and permissions. The legacy `/admin/login` page redirects to `/login`, and `/api/auth/admin/login` remains a compatibility alias. This replaces the previous portal separation at the user's request, without changing API role restrictions.
The navigation has a single Account entry, with Profile as a section inside it. After a normal login every role opens `/account`; a permitted return page still takes priority. Legacy Profile and dashboard URLs redirect to `/account?section=profile`. Every role can view/edit its own personal fields and change its own password; role, account status and member points cannot be edited through the profile API. Account includes logout. Only Members see the personal ticket section; staff accounts do not request the Member booking-history API.
API middleware reads the current account role/status from the database for each request.
Unauthenticated calls return 401; a wrong role returns 403; another employee's counter sale returns 404.
The frontend hides unavailable menus and blocks unauthorized tabs; backend checks remain authoritative.
Admin access to counter sales follows the user's updated requirement and extends the original Employee-only RDS actor.
Disabling an account increments its session version, so reactivation does not restore old tokens.

## Existing feature limits

- Counter sales default to walk-in Guests: no account, name, phone or email is required or stored. These bookings have `user: null` and retain only the acting Admin/Employee for access checks. Guests receive their ticket directly at the counter and cannot redeem Member points. Selecting Member requires an active registered account; online booking still requires a Member session.
- Payment remains the project's existing demo simulation; it does not collect real money.
- Staff provisioning generates a cryptographically random password, stores only its bcrypt hash and sends it using configured SMTP. Accounts become Active after SMTP accepts the recipient; a delivery failure leaves the account pending with an Admin retry action. API responses and the Admin UI never contain the password. Existing legacy activation invitations remain compatible. See [account management](ACCOUNT_MANAGEMENT.md).
- Ticket check-in, refunds, room/showtime management and revenue reports are outside this role-permission change.
- No existing account role or password is changed by this implementation.

## Counter points and manual corrections

1. Admin or Employee chooses a walk-in Guest (no personal details) or selects a registered active Member by email or phone, then movie, seats and food. Member identification is optional unless points are being redeemed.
2. Redemption is limited to `floor(min(member balance, floor(order subtotal / 1000)) / step) * step`, with default step 1; one point reduces the price by 1,000 VND. A 20-point balance can redeem 20 points on a 229,000 VND order, leaving 209,000 VND. Set `POINT_REDEEM_STEP=100` and restart the backend to enable the optional BR-4 groups of 100; the profile, public configuration and all checkout screens use that setting.
3. Creating the hold validates the chosen points before claiming seats. A pending hold does not deduct points.
4. Payment rechecks the current balance and deducts points once. A MongoDB transaction updates the booking, receipt, stock, seats, points and tickets together. Failed finalization aborts all changes; retrying a paid sale returns the paid result.
5. Manual Adjust Member Points remains Admin-only. It requires a nonzero signed integer, a 5–500 character reason and a request ID. Balance and an audit entry (before/after, delta, reason, Admin, time) update atomically in the Member document. Negative balances and stale balance snapshots are rejected. Repeating a request ID does not apply it again.
6. Admin can view the latest 20 manual corrections. These entries describe manual corrections; redemptions are recorded on bookings and a separate redemption ledger. No automatic earning rate is introduced.

These are explicitly labeled demo payments, using the local MongoDB replica set and multi-document transactions. Real-money gateway processing is not part of the requested simulation. See UC_COMPLETION.md for current setup and acceptance results.

## Online Member redemption

Members can apply/remove a promotion on their own pending online order at `PATCH /api/bookings/:id/promotion`. The payment screen includes code suggestions and the accepted discount. Ticket/food/all scopes, minimums, caps, dates, usage limits and point stacking use the same server calculation and atomic redemption as counter bookings. Online Members cannot edit codes on counter orders through this endpoint. See [online promotions](ONLINE_PROMOTIONS.md).

Members can choose redemption points in the online confirmation step, use the maximum permitted amount or choose zero. The preview shows the discount and remaining amount. The same server-side limits apply to online and counter bookings. Points remain unchanged while seats are held; successful demo payment deducts them once. Members can change/remove applied points on a pending payment screen, but cannot modify points after payment or use another Member's balance.

Online booking and payment refresh the profile balance on entry, browser focus and manual refresh. Successful payment updates the shared account balance and pending booking. If Admin changes the balance before payment, the server rechecks it; the Member can refresh and reduce/remove redemption before retrying. No automatic point earning is included.

## Checks

- Online promotions: `npm run test:online-promotions -w backend` and `npm run test:online-promotions:ui -w backend` cover ownership, code validity, price calculations, point stacking, food edits, last-use concurrency, VNPay callback retries and zero-total orders in isolated databases.
- Counter age-check UI: `npm run test:counter-age:ui -w backend`. At order confirmation, restricted movies show an explicit required age/guardian checkbox next to the hold button. Unchecked confirmation disables submission; P movies without an age limit proceed normally. Selecting different screenings, seats or customers clears the check. Browser regression covers P/T13/T16/T18/K and legacy age limits with real holds and navigation to payment in an isolated database.
- Member points browser regression: `npm run test:member-points:ui -w backend`. Uses an isolated random database and verifies a 20-point balance on a 229,000 VND order, typing, refresh failures, mobile, changing/removing points, VNPay-only online checkout, signed test callback settlement, retry without double deduction, zero balance, and explicitly configured step 100. Gateway navigation is intercepted; no external payment is made. Screenshots: `.local/qa/member-points/`.
- Backend: `npm test -w backend` (isolated temporary databases).
- Frontend permission matrix: `npm test -w frontend`.
- Production frontend: `npm run build`.
