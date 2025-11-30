# Server (Prototype) for WINTER 808STEPS

This is a minimal Node.js/Express prototype to illustrate backend flow for the clothing store.

- Environment variables (recommended):
- SELLER_EMAIL: e.g. 'support@winter808steps.com'
- ADMIN_EMAIL / ADMIN_PASSWORD: default dev credentials for admin UI (support@winter808steps.com / winter808steps.fr)
- SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / SMTP_SECURE: for sending emails
 - WEBHOOK_SECRET: a shared secret used to verify webhook signatures (demo only)
 - STRIPE_SECRET: your Stripe secret key for accepting card payments (sk_test_...)
 - STRIPE_PUBLISHABLE: your Stripe publishable key for front-end (pk_test_...)
 - STRIPE_WEBHOOK_SECRET: Stripe webhook secret for signature verification

For a basic Stripe setup:
1. Create a Stripe account and obtain API keys (test keys) from the dashboard.
2. Set the env vars in your server environment (or .env):

```powershell
setx STRIPE_SECRET "sk_test_..."
setx STRIPE_PUBLISHABLE "pk_test_..."
setx STRIPE_WEBHOOK_SECRET "whsec_..."
```
3. Start the server and follow the logs; use Stripe CLI or Dashboard to forward webhooks if testing locally.

Install & Run (development):

```powershell
cd server
npm install
npm start
```

Endpoints:
- GET /api/products
- GET /api/products/:id
- POST /api/checkout/create-order
- POST /api/checkout/pay
- GET /api/checkout/pay?order_id=...&method=paypal (simulated PayPal redirect for demo)
- POST /api/webhooks/payment
- GET /api/admin/orders (admin auth required)
 - POST /api/auth/login (admin credentials) — returns JWT token
 - POST /api/admin/upload — upload an image (requires JWT token)
 - POST /api/admin/products — create/update product (requires JWT token)
 - POST /api/admin/config — update site config (theme)

Notes:
- The prototype uses in-memory data (no database). For production, replace with a real DB.
- Implement real PayPal / PSP SDK server-side to securely create orders and handle webhooks.
- Make sure to verify all payment webhooks using the provider's recommended method.
- Use real SMTP or a transactional email service for sendMail.

Simulate a webhook call (PowerShell example):

```powershell
$payload = '{"payment_id":"PAYMENTID"}'
$secret = "your-webhook-secret"
$signature = "$(echo $payload | openssl dgst -sha256 -hmac $secret -binary | openssl base64)"
Invoke-RestMethod -Uri "http://localhost:3000/api/webhooks/payment" -Method POST -Body $payload -ContentType "application/json" -Headers @{"x-tpc-signature"=$signature}
```

Replace `PAYMENTID` with the actual ID from `/api/checkout/pay` or from the server logs. In the demo implementation the signature is a simple HMAC sha256 of the JSON payload (hex). Set `WEBHOOK_SECRET` env var on the server to verify the signature.

This server is intended to be a minimal example of how checkout & webhooks could be integrated.
