import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { monobank } from "../../../../../lib/monobank/client"
import { toMedusaError } from "../../../../../lib/monobank/to-medusa-error"
import { toPaymentOutcome } from "../../../../../lib/monobank/types"

/**
 * GET /store/monobank/payments/:invoiceId
 *
 * Перевірка статусу платежу. Використовується сторінкою повернення,
 * щоб одразу показати результат, не чекаючи на вебхук.
 *
 * invoiceId непередбачуваний, тож ендпоінт публічний, але віддає
 * тільки те, що потрібно UI — без даних картки та реквізитів.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { invoiceId } = req.params

  try {
    const invoice = await monobank.getInvoiceStatus(invoiceId)

    res.json({
      invoice_id: invoice.invoiceId,
      /** pending | paid | hold | failed | canceled */
      outcome: toPaymentOutcome(invoice.status),
      status: invoice.status,
      amount: invoice.amount,
      final_amount: invoice.finalAmount,
      ccy: invoice.ccy,
      reference: invoice.reference,
      failure_reason: invoice.failureReason,
      err_code: invoice.errCode,
      modified_date: invoice.modifiedDate,
    })
  } catch (e) {
    throw toMedusaError(e)
  }
}
