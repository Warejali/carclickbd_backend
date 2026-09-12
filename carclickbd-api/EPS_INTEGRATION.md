# EPS payment gateway replacement

Updated local code: `E:\Live Projects\carclickbdnew`.

The frontend and backend now use EPS for regular checkout and auction-sheet purchases. No deployment or real-money payment was performed.

## Configuration and deployment

The backend `.env` contains the live EPS credentials decrypted from your supplied document. It is ignored by Git and is NOT included in the update archive. Never put these values in frontend environment variables.

Merge the following keys into the backend's EXISTING hosting environment:

- EPS_USERNAME
- EPS_PASSWORD
- EPS_HASH_KEY
- EPS_MERCHANT_ID
- EPS_STORE_ID
- EPS_API_BASE_URL=https://pgapi.eps.com.bd
- FRONTEND_URL=https://carclickbd.com
- BACKEND_URL=https://carclickbd-backend.jdmcarworld.com

Keep the existing database, JWT, email, JPCenter and persistent-upload settings. The local `.env` only contains the EPS and public-URL settings; do not overwrite the server's full environment with it. DATABASE_URL and JWT_ACCESSTOKEN_SECRET are not configured locally, so a complete application/database checkout was not run locally.

Deploy both codebases together using the normal hosting workflow. Backend build/start commands remain `npm run build` / `npm start`; frontend commands remain `npm run build` / `npm start`. Use Node 20 or later. Ensure the hosting service permits HTTPS requests to pgapi.eps.com.bd and that EPS can return the browser to the public backend URL.

The new Mongoose EPSCheckout model stores checkout reservations. Its deterministic string _id prevents duplicate concurrent initializations. Ensure the EPS reference unique index and the partial unique Payment index for `{ order, paymentMethod: 'eps' }` are created by the normal Mongoose index setup before checkout traffic resumes.

## Flow

1. A regular order receives its price from backend Product records, or its completed auction's winning bid. Browser-supplied prices are ignored. Only the winning bidder can check out an auction.
2. Auction-sheet orders continue using the configured server price and require the report to be prepared before checkout.
3. Backend authenticates to EPS, reserves a unique reference, signs initialization using HMAC-SHA512 with the UTF-8 hash key, and redirects the customer to EPS.
4. EPS returns to `/api/v1/payment/eps/return/:reference`. The backend checks EPS transaction status, reference and amount before fulfillment, then redirects to the frontend. Query-string success claims do not establish payment.
5. The frontend can poll status again; confirmed payments cannot be downgraded, and auction-sheet download remains gated by a paid order.

## Operational details

- EPS enforces a maximum merchant reference length of 30 characters. Generated references are 29 characters.
- Sandbox returned `Cancel` even for a newly opened, still-payable session. Existing hosted URLs are reused regardless of this status, avoiding a second payable checkout.
- A definite initialization rejection is marked REJECTED and can be retried with a new reference. A timeout, malformed response or duplicate/ambiguous error retains the reservation as UNKNOWN. Support should reconcile such references with EPS before permitting another payment; do not simply delete them.
- EPS returns are browser redirects, not a documented webhook. If a customer closes the browser before returning, reconciliation occurs when their checkout/status is revisited. There is no background reconciliation job in this change.
- Old orders without server-verified pricing must be recreated before EPS checkout. Existing paid records are preserved. Resolve outstanding BDGate payments separately before rollout; retired BDGate routes no longer process them.
- Legacy `/payment/create` and Stripe/BDGate initialization endpoints return HTTP 410. Order modifications/deletions require an administrator; new orders always start pending.

## Validation

- EPS live authentication succeeded with the supplied credentials; tokens and secrets were not printed.
- EPS sandbox initialization succeeded and produced an actual hosted checkout page displaying BDT 1.00.
- Sandbox status verification returned the correct reference and amount; `Cancel` maps to FAILED.
- `npm run test:eps` runs backend compilation plus 27 automated tests covering hashing, API requests, ownership, amount/reference checks, retries, duplicates, terminal payment status, callback verification and server pricing.
- Frontend production build and TypeScript validation were checked separately.

No successful real-money transaction, refund, or production database fulfillment has been exercised. After deployment, complete one authorized low-value payment and verify the order/download in the database, then check cancellation and repeat-return behavior.

## Update archive

The archive contains changed/new files relative to the original two folders, not a complete repository. Overlay it at `E:\Live Projects\carclickbdnew`. Remove the old `carclickbd/carclickbd-main/src/components/Cart/BDGate.tsx` after applying; it was replaced with `EPS.tsx`. Preserve server environment settings and uploads. Dependencies, build directories and credentials are excluded.


Final verification: 2026-09-10. Backend build and all 27 tests passed; frontend production build passed (143 pages); live EPS authentication passed again.
