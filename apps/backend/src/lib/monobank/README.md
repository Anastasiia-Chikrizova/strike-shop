# Monobank Acquiring + MonoPay

Оплата в чекауті йде через **платіжний провайдер Medusa**
(`src/modules/monobank-payment`). Це означає, що Medusa веде життєвий цикл
платежу сама: сесія оплати створює рахунок, `cart.complete()` перевіряє його
статус у Monobank, а кнопки **Capture** і **Refund** в адмінці ходять
у справжній Monobank.

| Метод провайдера | Що робить у Monobank |
| --- | --- |
| `initiatePayment` | `invoice/create` → `page_url` потрапляє в `data` сесії |
| `authorizePayment` | `invoice/status` → `success` = **captured** (при `debit`) |
| `capturePayment` | `debit` — no-op; `hold` — `invoice/finalize` |
| `refundPayment` | `invoice/cancel` (підтримує часткове повернення) |
| `cancelPayment` | неоплачений — `invoice/remove`, оплачений — `invoice/cancel` |
| `getWebhookActionAndData` | перевірка `x-sign` → `captured` / `authorized` / `failed` |

Поруч живуть дві додаткові схеми:

| | **Invoice API (свої роути)** | **MonoPay** |
| --- | --- | --- |
| Хто створює інвойс | бекенд | віджет у браузері |
| Автентифікація | `X-Token` | наш ECDSA-підпис + `keyId` |
| UX | redirect на сторінку Monobank | QR-код → застосунок monobank |
| Ключі | не потрібні | пара P-256, публічний імпортується в Monobank |

## Файли

**Бібліотека**

| Шлях | Що робить |
| --- | --- |
| `src/lib/monobank/client.ts` | HTTP-клієнт: invoice create/status/cancel/remove, pubkey, MonoPay pubkey import/list/delete |
| `src/lib/monobank/webhook.ts` | перевірка ECDSA-підпису вебхука + кеш публічного ключа |
| `src/lib/monobank/monopay.ts` | підпис payload для віджета, кеш `keyId`, читання приватного ключа |
| `src/lib/monobank/types.ts` | типи API + мапінг статусів у `pending / paid / hold / failed / canceled` |

**Модуль (БД)**

| Модель | Навіщо |
| --- | --- |
| `monobank_invoice` | стан платежу: `invoice_id`, `request_id`, `reference`, `cart_id`, сума, статус, `modified_date` |
| `monobank_webhook_log` | кожен вхідний вебхук — разом із сирим тілом і тими, що не пройшли підпис |

**Воркфлоу**

| Воркфлоу | Кроки |
| --- | --- |
| `create-monobank-invoice` | сума з кошика → створення рахунку в Monobank → запис у БД |
| `init-mono-pay-payment` | сума з кошика → підпис payload → запис очікуваного платежу |
| `apply-monobank-webhook` | ідемпотентне оновлення статусу за `modifiedDate` |
| `log-monobank-webhook` | запис у лог |

**Роути**

| Метод | Шлях | Опис |
| --- | --- | --- |
| POST | `/store/monobank/payments` | створити рахунок, повертає `page_url` |
| GET | `/store/monobank/payments/:invoiceId` | статус платежу |
| POST | `/store/monobank/monopay/init` | `keyId`, `signature`, `requestId`, `payloadBase64` для віджета |
| POST | `/hooks/payment/monobank_monobank` | **вебхук провайдера** — вбудований роут Medusa |
| POST | `/webhooks/monobank` | вебхук для власного флоу (сирий body в `middlewares.ts`) |

**Фронтенд:** `lib/data/monobank.ts`, `lib/data/monopay.ts`,
`lib/util/load-monopay-script.ts`, компоненти `monobank-payment-button`,
`monopay-button`, `monopay-status-poller`, сторінка `monobank/return`.

## Змінні оточення (`apps/backend/.env`)

```
MONO_KEY=uJhxxxxxxxxxxxxxxxxxx
MONO_API_URL=https://api.monobank.ua
MONO_WEBHOOK_URL=https://<публічний-домен>/webhooks/monobank
MONO_REDIRECT_URL=http://localhost:8000/ua/monobank/return
# MONO_ALLOW_CLIENT_AMOUNT=true   # лише для тестів, див. нижче

# тільки для MonoPay
MONOPAY_PRIVATE_KEY=<base64(PEM) ECDSA P-256>
# MONOPAY_KEY_ID=pk_test_…
```

Тестовий токен: https://api.monobank.ua/. Бойовий — у кабінеті мерчанта.

## Налаштування MonoPay (одноразово)

```bash
npx medusa exec ./src/scripts/monopay-keys.ts generate   # друкує пару ключів
# покласти MONOPAY_PRIVATE_KEY у .env
npx medusa exec ./src/scripts/monopay-keys.ts import     # вантажить публічний у Monobank
npx medusa exec ./src/scripts/monopay-keys.ts list       # показує keyId
```

`generate` нічого нікуди не надсилає — тільки друкує. Приватний ключ живе
виключно в `.env` бекенда.

## Як рахується підпис MonoPay

```
signature = base64( DER( ECDSA-P256-SHA256( JSON.stringify(payload) + requestId ) ) )
payloadBase64 = base64( той самий JSON )
```

JSON серіалізується **рівно один раз** — і підпис, і `payloadBase64`
робляться з одного рядка. Дві окремі серіалізації колись розійдуться
(порядок ключів, пробіли), і Monobank відхилить підпис.

`crypto.createSign("SHA256")` хешує сам — окремо рахувати SHA-256 і підписувати
дайджест не можна, вийде подвійний хеш.

## Чому сума рахується на сервері

`amount` із клієнта означає, що будь-хто оплатить замовлення за 1 копійку.
Явний `amount` приймається лише при `MONO_ALLOW_CLIENT_AMOUNT=true` —
режим для локальних експериментів.

## Вебхук

- підпис перевіряється від **сирих байтів** тіла (`preserveRawBody`);
- 401 — невалідний підпис, 400 — тіло без `invoiceId`/`status`,
  500 — не вдалося записати в БД. Будь-що, крім 2xx, змушує Monobank
  повторити доставку;
- 200 віддається лише після успішного запису;
- застарілі вебхуки (`modifiedDate` не новіший за збережений) ігноруються,
  щоб ретрай не відкотив `success` назад у `processing`;
- після успішного оновлення емітиться подія
  `monobank.invoice.{paid|hold|failed|canceled|pending}` — вішайте на неї
  підписників у `src/subscribers`.

## Локальне тестування вебхука

```bash
ngrok http 9000
```

Далі `MONO_WEBHOOK_URL=https://<id>.ngrok.io/webhooks/monobank` і рестарт бекенду.

## Увімкнути провайдер у регіоні

Провайдер зареєстровано в `medusa-config.ts`, але кожному регіону його треба
дозволити окремо:

```bash
npx medusa exec ./src/scripts/enable-monobank-provider.ts
```

Те саме руками: Admin → Settings → Regions → Payment providers.

## Що лишилось поза інтеграцією

- **`hold`.** При `MONO_PAYMENT_TYPE=hold` кошти блокуються, і списати
  (`invoice/finalize`) або повернути їх треба протягом 9 днів. Capture в
  адмінці робить саме finalize.
- **MonoPay-кнопка** живе поза провайдером: інвойс створює віджет, тому
  її вебхуки приходять на `/webhooks/monobank` і оновлюють лише таблицю
  `monobank_invoice`, не чіпаючи payment collection.
