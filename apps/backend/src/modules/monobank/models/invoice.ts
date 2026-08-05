import { model } from "@medusajs/framework/utils"

export const MonobankInvoice = model
  .define("monobank_invoice", {
    id: model.id().primaryKey(),

    invoice_id: model.text().nullable(),
    request_id: model.text().nullable(),
    reference: model.text().nullable(),

    flow: model.enum(["invoice", "monopay"]).default("invoice"),

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
