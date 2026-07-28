import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"

import { persistMonobankInvoiceStep } from "./steps/persist-monobank-invoice"
import { prepareMonoPayRequestStep } from "./steps/prepare-monopay-request"
import { resolveMonobankAmountStep } from "./steps/resolve-monobank-amount"

export type InitMonoPayPaymentInput = {
  cart_id?: string
  amount?: number
  ccy?: number
  reference?: string
  destination?: string
  comment?: string
  redirect_url?: string
  success_url?: string
  fail_url?: string
  validity?: number
}

/**
 * Рахуємо суму → підписуємо payload → зберігаємо очікуваний платіж.
 *
 * invoice_id тут ще невідомий: інвойс створює віджет у браузері.
 * Запис знаходимо по reference, коли прийде вебхук.
 */
export const initMonoPayPaymentWorkflow = createWorkflow(
  "init-mono-pay-payment",
  function (input: InitMonoPayPaymentInput) {
    const resolved = resolveMonobankAmountStep(input)

    const prepareInput = transform({ input, resolved }, (data) => ({
      amount: data.resolved.amount,
      ccy: data.resolved.ccy,
      reference: data.resolved.reference,
      destination: data.input.destination,
      comment: data.input.comment,
      redirect_url: data.input.redirect_url,
      success_url: data.input.success_url,
      fail_url: data.input.fail_url,
      validity: data.input.validity,
    }))

    const prepared = prepareMonoPayRequestStep(prepareInput)

    const persistInput = transform({ resolved, prepared }, (data) => ({
      request_id: data.prepared.requestId,
      reference: data.resolved.reference,
      flow: "monopay" as const,
      amount: data.resolved.amount,
      ccy: data.resolved.ccy,
      cart_id: data.resolved.cart_id,
    }))

    const record = persistMonobankInvoiceStep(persistInput)

    const result = transform({ prepared, record, resolved }, (data) => ({
      id: data.record.id,
      keyId: data.prepared.keyId,
      signature: data.prepared.signature,
      requestId: data.prepared.requestId,
      payloadBase64: data.prepared.payloadBase64,
      amount: data.resolved.amount,
      ccy: data.resolved.ccy,
      reference: data.resolved.reference,
    }))

    return new WorkflowResponse(result)
  }
)

export default initMonoPayPaymentWorkflow
