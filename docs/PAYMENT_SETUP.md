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
An employee/admin opens `/staff/tools`, looks up the booking, checks the amount
and confirms the exact cash amount collected. The server records method `cash`
and issues QR tickets. Members cannot confirm their own cash receipt. Staff-created
counter bookings use the same seat reservation and cash settlement mechanisms.

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
