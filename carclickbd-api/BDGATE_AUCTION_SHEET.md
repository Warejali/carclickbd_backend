# BDGate auction-sheet payment

The public flow is:

1. `POST /api/v1/auction-sheet/order` creates a guest order only after the
   JPCenter PDF has been downloaded, validated and cached in protected storage.
2. `POST /api/v1/payment/bdgate/auction-sheet` creates the BDGate Pay checkout session.
3. BDGate sends the webhook to `/api/v1/payment/bdgate/webhook`; the server also verifies the hosted session status directly.
4. The frontend polls `/api/v1/payment/bdgate/auction-sheet/status/:orderId`.
5. Only a `PAID` order can download the already-prepared report from
   `/api/v1/auction-sheet/download/:orderId`.

The implementation uses BDGate's recommended `/v1/checkout` endpoint and keeps
`/bdgate-pay/create-session` only as a compatibility fallback. Payment status
is checked server-to-server through the authenticated
`/bdgate-pay/sessions/:session_token` endpoint (with the public status endpoint
as a legacy fallback). The browser success redirect is never trusted as proof
of payment.

Set these Hostinger environment variables:

```env
FRONTEND_URL=https://www.carclickbd.com
BACKEND_URL=https://carclickbd-backend.jdmcarworld.com
BDGATE_API_KEY=bd_live_your_key
BDGATE_API_BASE_URL=https://api.bdgate.net/api
BDGATE_WEBHOOK_SECRET=your_webhook_secret_optional
AUCTION_SHEET_PRICE_BDT=800
JPCENTER_API_CODE=your_private_access_code
JPCENTER_API_BASE_URL=https://jpcenter.ru/api/report
AUCTION_SHEET_ROOT=/home/u819018346/carclickbd-auction-sheets
```

The BDGate and JPCenter credentials must be entered in Hostinger only; never
commit them. A payment is never unlocked from the redirect alone.

The chassis lookup uses JPCenter's listing request first. Its private record key
is stored on the order and is not returned to the browser. Before BDGate
checkout is created, the server requests the JPCenter True Report, extracts the
approved PDF URL, validates the PDF signature and size, and saves it atomically.
This intentionally spends a JPCenter report before payment so a successful
payment never depends on JPCenter still being available afterward.

`AUCTION_SHEET_ROOT` must be outside every directory exposed at `/uploads`.
When an old setting points inside the public upload tree, the application
automatically uses a protected sibling directory instead. A previously cached
local file named by the chassis takes priority over a new JPCenter request.
