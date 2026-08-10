import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

import { monobank } from "../../lib/monobank/client"
import { toMedusaError } from "../../lib/monobank/to-medusa-error"
import { MonobankPaymentType } from "../../lib/monobank/types"

export type CreateInvoiceAtMonobankInput = {
  amount: number
  ccy: number
  reference?: string
  destination?: string
  comment?: string
  redirect_url?: string
  validity?: number
  payment_type?: MonobankPaymentType
}

export type CreateInvoiceAtMonobankOutput = {
  invoice_id: string
  page_url: string
}

export const createInvoiceAtMonobankStep = createStep(
  "create-invoice-at-monobank",
  async (
    input: CreateInvoiceAtMonobankInput
  ): Promise<StepResponse<CreateInvoiceAtMonobankOutput, string>> => {
    try {
      const invoice = await monobank.createInvoice({
        amount: input.amount,
        ccy: input.ccy,
        merchantPaymInfo: {
          reference: input.reference,
          destination: input.destination ?? "Оплата замовлення",
          comment: input.comment,
        },
        redirectUrl: input.redirect_url ?? process.env.MONO_REDIRECT_URL,
        webHookUrl: process.env.MONO_WEBHOOK_URL,
        validity: input.validity,
        paymentType: input.payment_type,
      })

      return new StepResponse(
        { invoice_id: invoice.invoiceId, page_url: invoice.pageUrl },
        invoice.invoiceId
      )
    } catch (e) {
      throw toMedusaError(e)
    }
  },
  async (invoiceId, { container }) => {
    if (!invoiceId) {
      return
    }

    const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

    try {
      await monobank.removeInvoice(invoiceId)
    } catch (e) {
      logger.warn(
        `[monobank] Failed to cancel invoice ${invoiceId}: ${(e as Error).message}`
      )
    }
  }
)
