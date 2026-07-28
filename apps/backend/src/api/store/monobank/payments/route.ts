import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { createMonobankInvoiceWorkflow } from "../../../../workflows/create-monobank-invoice"
import { PostMonobankPaymentSchema } from "../middlewares"

/**
 * POST /store/monobank/payments
 *
 * Створює рахунок у Monobank, зберігає його в БД і повертає посилання
 * на сторінку оплати. Далі фронтенд робить redirect на `page_url`.
 */
export async function POST(
  req: MedusaRequest<PostMonobankPaymentSchema>,
  res: MedusaResponse
) {
  const { result } = await createMonobankInvoiceWorkflow(req.scope).run({
    input: req.validatedBody,
  })

  res.status(201).json({
    id: result.id,
    invoice_id: result.invoice_id,
    page_url: result.page_url,
    amount: result.amount,
    ccy: result.ccy,
    reference: result.reference,
  })
}
