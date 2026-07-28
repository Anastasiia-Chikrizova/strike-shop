import { model } from "@medusajs/framework/utils"

/**
 * Стан платежу Monobank на нашому боці.
 *
 * Класичний флоу (invoice/create) створює запис одразу і має invoice_id.
 * MonoPay-кнопка створює інвойс уже в браузері, тому запис спершу існує
 * лише з request_id + reference, а invoice_id приходить із вебхуком.
 */
export const MonobankInvoice = model
  .define("monobank_invoice", {
    id: model.id().primaryKey(),

    /** Ідентифікатор рахунку в Monobank. У MonoPay з'являється після оплати. */
    invoice_id: model.text().nullable(),
    /** Ідентифікатор запиту MonoPay (TTL 10 хв). */
    request_id: model.text().nullable(),
    /** Наш ідентифікатор замовлення — те, що йде в merchantPaymInfo.reference. */
    reference: model.text().nullable(),

    flow: model.enum(["invoice", "monopay"]).default("invoice"),

    /** Сума в копійках — Monobank працює тільки з мінімальними одиницями. */
    amount: model.number(),
    ccy: model.number().default(980),
    final_amount: model.number().nullable(),

    status: model
      .enum([
        "created",
        "processing",
        "hold",
        "success",
        "failure",
        "reversed",
        "expired",
      ])
      .default("created"),
    outcome: model
      .enum(["pending", "paid", "hold", "failed", "canceled"])
      .default("pending"),

    /** Час останньої зміни за версією Monobank — захист від старих вебхуків. */
    modified_date: model.dateTime().nullable(),

    failure_reason: model.text().nullable(),
    err_code: model.text().nullable(),

    page_url: model.text().nullable(),

    cart_id: model.text().nullable(),
    order_id: model.text().nullable(),

    metadata: model.json().nullable(),
  })
  .indexes([
    { on: ["invoice_id"], unique: true, where: "deleted_at IS NULL" },
    { on: ["reference"] },
    { on: ["request_id"] },
    { on: ["cart_id"] },
  ])

export default MonobankInvoice
