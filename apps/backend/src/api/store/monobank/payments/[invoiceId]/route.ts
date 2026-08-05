import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { monobank } from "../../../../../lib/monobank/client"
import { toMedusaError } from "../../../../../lib/monobank/to-medusa-error"
import { toPaymentOutcome } from "../../../../../lib/monobank/types"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { invoiceId } = req.params

  try {
    const invoice = await monobank.getInvoiceStatus(invoiceId)

    res.json({
      invoice_id: invoice.invoiceId,
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
