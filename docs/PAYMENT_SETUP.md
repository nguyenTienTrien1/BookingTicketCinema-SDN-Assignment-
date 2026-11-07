# Booking and payment

Seats are reserved when the booking is created, for 10 minutes. Selecting a
seat in the browser does not reserve it. The server claims all requested seats
atomically in a MongoDB transaction. Another request for a held or booked seat
receives HTTP 409. Cancellation releases held seats; expired bookings are cleaned
every 15 seconds and before new bookings/public schedule reads.

## Run locally

From the repository root:

```sh
npm ci
npm run setup:local
npm run dev:backend
# In a second terminal:
npm run dev:frontend
```

MongoDB must support transactions (replica set). The local database script creates
the `cinemaLocal` replica set on port 27019.

Stop the backend before `setup:local` if switching from standalone MongoDB on
27017. Setup preserves the original database, saves private backups under
`.local/backups`, copies and verifies local data, then changes only the database
URI in `backend/.env`. An existing target with different data is not overwritten.
On Windows, the normal MongoDB Server install is discovered automatically; set
`MONGOD_BINARY` for a custom installation. A fresh clone gets a private `.env`
from `.env.example`; seed demo data only when the database is empty. The same
replica set also enables atomic saving of automatically suggested showtimes.

## VNPay Sandbox

Set these values in `backend/.env`, using your own Sandbox merchant credentials:

```dotenv
VNPAY_TMN_CODE=<sandbox merchant code>
VNPAY_HASH_SECRET=<sandbox signing secret>
VNPAY_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
VNPAY_RETURN_URL=https://<public backend>/api/payments/vnpay/return
CLIENT_URL=http://localhost:5173
```

Register `https://<public backend>/api/payments/vnpay/ipn` as the IPN URL with
VNPay. A localhost URL cannot receive their server callback; expose the backend
through an HTTPS tunnel or deployed host. Set CORS_ORIGIN to the frontend origin.
Keep credentials private. No real merchant credentials are included in tests.

The checkout redirects to VNPay. The return page loads the authenticated user's
booking and polls the server. Only a verified IPN with matching merchant, amount,
reference and successful transaction status issues tickets. A browser return
alone cannot mark a booking paid. Failed transactions may be retried while seats
are held. Duplicate success callbacks do not issue additional tickets. A payment
received after expiry is marked unresolved for staff reconciliation; seats are
not reclaimed from another customer.

Official integration reference:
https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html

## Pay at the counter

The member selects cash and presents the booking ID before the hold expires.
An active Employee or Admin opens `/staff/tools` and can collect payment for any
online or counter booking. Cash may exceed the accepted total: the Employee
confirms the amount received and returns the displayed change. The server records
the gross cash, change, net amount, collector and collection time. Members cannot
confirm their own cash receipt. Staff may also create a VNPay request, including
for Guest orders; zero-amount orders need no cash or gateway charge.

The cash receipt is saved before finalizing the sale. A failed finalization keeps
that receipt unresolved and prevents another collection or repricing. Both staff
roles may retry the same receipt within its original hold deadline, record a
reasoned note, or confirm return of the net cash for an unfinalized order. VNPay
refunds require provider verification; a note does not mark money refunded.
Successful verified settlement writes revenue, seats, stock, points, promotion
usage and tickets in one transaction. Demo settlements create no revenue.

### UC9.3 backlog review — 08/11/2026

The original Product Backlog assigns **UC-9.3 — Process Payment**, under **Sell
Ticket**, to **Nguyễn Thị Kim Nhã (CE190530)**, with **Employee** as the actor.
This is separate from Member payment UC-6.3. Admin access, shared staff processing,
VNPay and cash change follow the user's subsequent agreed requirements.

| Requirement | Current result |
| --- | --- |
| Accepted total, deadline and payment method before collection | Implemented |
| Trusted cash receipt or verified gateway confirmation | Implemented; gateway tests use signed test callbacks |
| Recheck amount, holds, stock, promotion and points | Implemented |
| Finalize once; payment, revenue, seats, stock and tickets stay consistent | Implemented and tested with transactional MongoDB |
| Change method or cancel before collection; reject failed/late payment | Implemented; recorded collections stay locked for reconciliation |
| Preserve collected funds when finalization fails; retry without collecting twice | Implemented with audited reconciliation |
| Real VNPay Sandbox merchant transaction and reachable IPN | Pending environment configuration and provider acceptance test |

Code and local integration checks are complete for this UC. Full provider
acceptance remains pending the final row; it is not claimed as verified by local
tests. Ticket refunds after successful payment belong to UC7.1.

Simulation APIs remain available only when explicitly enabled for development.
The regular checkout uses VNPay Sandbox or cash, not simulation.

## Verification

```sh
npm test --prefix backend
npm test --prefix frontend
npm run build --prefix frontend
```

Backend tests use isolated test databases. Coverage includes concurrent seat
claims, paid seats, hold expiry/cancellation, signed VNPay URLs, invalid callbacks,
amount mismatch, callback retry/idempotency, cash permissions and QR issuance.
Signed test callbacks validate the local integration; a live Sandbox transaction
still requires configured merchant credentials and a reachable IPN URL.
