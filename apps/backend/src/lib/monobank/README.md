# Monobank Acquiring + MonoPay

Checkout payment goes through a **Medusa payment provider**
(`src/modules/monobank-payment`). That means Medusa itself drives the
payment lifecycle: the payment session creates an invoice, `cart.complete()`
checks its status with Monobank, and the **Capture** and **Refund** buttons
in the admin talk to real Monobank.

| Provider method | What it does in Monobank |
| --- | --- |
| `initiatePayment` | `invoice/create` → `page_url` goes into the session `data` |
| `authorizePayment` | `invoice/status` → `success` = **captured** (for `debit`) |
| `capturePayment` | `debit` — no-op; `hold` — `invoice/finalize` |
| `refundPayment` | `invoice/cancel` (supports partial refunds) |
| `cancelPayment` | unpaid → `invoice/remove`, paid → `invoice/cancel` |
| `getWebhookActionAndData` | verifies `x-sign` → `captured` / `authorized` / `failed` |

There are two additional schemes alongside it:

| | **Invoice API (own routes)** | **MonoPay** |
| --- | --- | --- |
| Who creates the invoice | the backend | the widget in the browser |
| Authentication | `X-Token` | our ECDSA signature + `keyId` |
| UX | redirect to a Monobank page | QR code → monobank app |
| Keys | none needed | a P-256 pair, public key imported into Monobank |

## Files

**Library**

| Path | What it does |
| --- | --- |
| `src/lib/monobank/client.ts` | HTTP client: invoice create/status/cancel/remove, pubkey, MonoPay pubkey import/list/delete |
| `src/lib/monobank/webhook.ts` | verifies the webhook's ECDSA signature + caches the public key |
| `src/lib/monobank/monopay.ts` | signs the widget payload, caches `keyId`, reads the private key |
| `src/lib/monobank/types.ts` | API types + status mapping to `pending / paid / hold / failed / canceled` |

**Module (DB)**

| Model | Purpose |
| --- | --- |
| `monobank_invoice` | payment state: `invoice_id`, `request_id`, `reference`, `cart_id`, amount, status, `modified_date` |
| `monobank_webhook_log` | every incoming webhook — including the raw body and ones that failed signature verification |

**Workflows**

| Workflow | Steps |
| --- | --- |
| `create-monobank-invoice` | cart total → create invoice in Monobank → write to DB |
| `init-mono-pay-payment` | cart total → sign payload → record the expected payment |
| `apply-monobank-webhook` | idempotent status update keyed on `modifiedDate` |
| `log-monobank-webhook` | write to the log |

**Routes**

| Method | Path | Description |
| --- | --- | --- |
| POST | `/store/monobank/payments` | create an invoice, returns `page_url` |
| GET | `/store/monobank/payments/:invoiceId` | payment status |
| POST | `/store/monobank/monopay/init` | `keyId`, `signature`, `requestId`, `payloadBase64` for the widget |
| POST | `/hooks/payment/monobank_monobank` | **provider webhook** — Medusa's built-in route |
| POST | `/webhooks/monobank` | webhook for the custom flow (raw body in `middlewares.ts`) |

**Frontend:** `lib/data/monobank.ts`, `lib/data/monopay.ts`,
`lib/util/load-monopay-script.ts`, the `monobank-payment-button`,
`monopay-button`, `monopay-status-poller` components, and the
`monobank/return` page.

## Environment variables (`apps/backend/.env`)

```
MONO_KEY=uJhxxxxxxxxxxxxxxxxxx
MONO_API_URL=https://api.monobank.ua
MONO_WEBHOOK_URL=https://<public-domain>/webhooks/monobank
MONO_REDIRECT_URL=http://localhost:8000/ua/monobank/return
# MONO_ALLOW_CLIENT_AMOUNT=true   # testing only, see below

# MonoPay only
MONOPAY_PRIVATE_KEY=<base64(PEM) ECDSA P-256>
# MONOPAY_KEY_ID=pk_test_…
```

Sandbox token: https://api.monobank.ua/. Production token is in the merchant
dashboard.

## Setting up MonoPay (one-time)

```bash
npx medusa exec ./src/scripts/monopay-keys.ts generate   # prints a key pair
# put MONOPAY_PRIVATE_KEY into .env
npx medusa exec ./src/scripts/monopay-keys.ts import     # uploads the public key to Monobank
npx medusa exec ./src/scripts/monopay-keys.ts list       # shows the keyId
```

`generate` doesn't send anything anywhere — it only prints. The private key
lives only in the backend's `.env`.

## How the MonoPay signature is computed

```
signature = base64( DER( ECDSA-P256-SHA256( JSON.stringify(payload) + requestId ) ) )
payloadBase64 = base64( that same JSON )
```

The JSON is serialized **exactly once** — both the signature and
`payloadBase64` are built from the same string. Two separate serializations
would eventually drift (key order, whitespace), and Monobank would reject the
signature.

`crypto.createSign("SHA256")` hashes internally — don't hash with SHA-256
separately and sign the digest, that would double-hash it.

## Why the amount is computed on the server

An `amount` coming from the client would mean anyone could pay for an order
with one kopeck. An explicit `amount` is only accepted when
`MONO_ALLOW_CLIENT_AMOUNT=true` — a mode for local experimentation only.

## Webhook

- the signature is verified against the **raw bytes** of the body
  (`preserveRawBody`);
- 401 — invalid signature, 400 — body missing `invoiceId`/`status`,
  500 — failed to write to the DB. Anything other than 2xx makes Monobank
  retry delivery;
- 200 is only returned after a successful write;
- stale webhooks (`modifiedDate` not newer than what's stored) are ignored,
  so a retry can't roll `success` back to `processing`;
- after a successful update, a `monobank.invoice.{paid|hold|failed|canceled|pending}`
  event is emitted — attach subscribers to it in `src/subscribers`.

## Testing the webhook locally

```bash
ngrok http 9000
```

Then set `MONO_WEBHOOK_URL=https://<id>.ngrok.io/webhooks/monobank` and
restart the backend.

## Enabling the provider for a region

The provider is registered in `medusa-config.ts`, but each region needs it
enabled separately:

```bash
npx medusa exec ./src/scripts/enable-monobank-provider.ts
```

Or manually: Admin → Settings → Regions → Payment providers.

## What's deliberately not covered by the integration

- **`hold`.** With `MONO_PAYMENT_TYPE=hold`, funds are blocked, and they must
  be captured (`invoice/finalize`) or released within 9 days. Capture in the
  admin does exactly that finalize call.
- **The MonoPay button** lives outside the provider: the invoice is created
  by the widget, so its webhooks land on `/webhooks/monobank` and only update
  the `monobank_invoice` table, without touching the payment collection.
