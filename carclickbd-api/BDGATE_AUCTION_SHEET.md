# BDGate auction-sheet payment

The public flow is:

1. `POST /api/v1/auction-sheet/order` creates a guest order.
2. `POST /api/v1/payment/bdgate/auction-sheet` creates the BDGate Pay checkout session.
3. BDGate sends the webhook to `/api/v1/payment/bdgate/webhook`; the server also verifies the hosted session status directly.
4. The frontend polls `/api/v1/payment/bdgate/auction-sheet/status/:orderId`.
5. Only a `PAID` order can request the full JPCenter report and download
   `/api/v1/auction-sheet/download/:orderId`.

The implementation uses BDGate Pay's documented `/bdgate-pay/create-session`
endpoint and falls back to `/v1/checkout` only for legacy accounts. Payment
status is checked through `/public/pay/:session_token/status`. The browser
success redirect is not trusted as proof of payment.

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
AUCTION_SHEET_ROOT=/home/u819018346/carclickbd-uploads/auction-sheets
```

The BDGate and JPCenter credentials must be entered in Hostinger only; never
commit them. A payment is never unlocked from the redirect alone.

The chassis lookup uses JPCenter's listing request first. Its private record key
is stored on the order and is not returned to the browser. After payment is
confirmed, the server requests the JPCenter True Report with that key, extracts
the `pdf.ajes.com` PDF URL, caches the URL on the order, and proxies the PDF as
a download. This avoids spending a JPCenter report before payment and avoids
exposing the JPCenter access code.

`AUCTION_SHEET_ROOT` remains an optional local fallback. A local file named by
the chassis (`.pdf`, `.png`, `.jpg`, `.jpeg`, or `.webp`) takes priority over the
remote JPCenter report.
