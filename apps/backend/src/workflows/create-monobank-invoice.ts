import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"

import { MonobankPaymentType } from "../lib/monobank/types"
import { createInvoiceAtMonobankStep } from "./steps/create-invoice-at-monobank"
import { persistMonobankInvoiceStep } from "./steps/persist-monobank-invoice"
import { resolveMonobankAmountStep } from "./steps/resolve-monobank-amount"

export type CreateMonobankInvoiceInput = {
  cart_id?: string
  amount?: number
  ccy?: number
  reference?: string
  destination?: string
  comment?: string
  redirect_url?: string
  validity?: number
  payment_type?: MonobankPaymentType
}

/**
 * Рахуємо суму → створюємо рахунок у Monobank → зберігаємо його в БД.
 * Якщо запис у БД впаде, компенсація зніме рахунок у Monobank, щоб не
 * лишалося посилань на оплату, про які ми нічого не знаємо.
 */
export const createMonobankInvoiceWorkflow = createWorkflow(
  "create-monobank-invoice",
  function (input: CreateMonobankInvoiceInput) {
    const resolved = resolveMonobankAmountStep(input)

    const createInput = transform({ input, resolved }, (data) => ({
      amount: data.resolved.amount,
      ccy: data.resolved.ccy,
      reference: data.resolved.reference,
      destination: data.input.destination,
      comment: data.input.comment,
      redirect_url: data.input.redirect_url,
      validity: data.input.validity,
      payment_type: data.input.payment_type,
    }))

    const invoice = createInvoiceAtMonobankStep(createInput)

    const persistInput = transform({ resolved, invoice }, (data) => ({
      invoice_id: data.invoice.invoice_id,
      reference: data.resolved.reference,
      flow: "invoice" as const,
      amount: data.resolved.amount,
      ccy: data.resolved.ccy,
      page_url: data.invoice.page_url,
      cart_id: data.resolved.cart_id,
    }))

    const record = persistMonobankInvoiceStep(persistInput)

    const result = transform({ resolved, invoice, record }, (data) => ({
      id: data.record.id,
      invoice_id: data.invoice.invoice_id,
      page_url: data.invoice.page_url,
      amount: data.resolved.amount,
      ccy: data.resolved.ccy,
      reference: data.resolved.reference,
    }))

    return new WorkflowResponse(result)
  }
)

export default createMonobankInvoiceWorkflow
