import { model } from "@medusajs/framework/utils"

/**
 * Лог усіх вхідних вебхуків — включно з тими, що не пройшли перевірку підпису.
 * Потрібен для відладки й розбору спірних платежів: Monobank шле ретраї,
 * і без сирого тіла неможливо довести, що саме прийшло.
 */
export const MonobankWebhookLog = model
  .define("monobank_webhook_log", {
    id: model.id().primaryKey(),

    invoice_id: model.text().nullable(),
    reference: model.text().nullable(),
    status: model.text().nullable(),

    /** Чи пройшов ECDSA-підпис із заголовка x-sign. */
    signature_valid: model.boolean().default(false),
    /** Що ми відповіли Monobank — 200/400/401/500. */
    http_status: model.number().default(200),

    /** Сире тіло як прийшло: підпис рахується саме від цих байтів. */
    raw_body: model.text().nullable(),
    payload: model.json().nullable(),

    /** Текст помилки, якщо обробка впала. */
    error: model.text().nullable(),
  })
  .indexes([{ on: ["invoice_id"] }, { on: ["signature_valid"] }])

export default MonobankWebhookLog
