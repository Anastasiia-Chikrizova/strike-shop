import { model } from "@medusajs/framework/utils"

export const MonobankWebhookLog = model
  .define("monobank_webhook_log", {
    id: model.id().primaryKey(),

    invoice_id: model.text().nullable(),
    reference: model.text().nullable(),
    status: model.text().nullable(),

    signature_valid: model.boolean().default(false),
    http_status: model.number().default(200),

    raw_body: model.text().nullable(),
    payload: model.json().nullable(),

    error: model.text().nullable(),
  })
  .indexes([{ on: ["invoice_id"] }, { on: ["signature_valid"] }])

export default MonobankWebhookLog
