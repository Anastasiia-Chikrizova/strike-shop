import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

import { MONOBANK_MODULE } from "../../modules/monobank"
import MonobankModuleService from "../../modules/monobank/service"

export type PersistMonobankInvoiceInput = {
  invoice_id?: string
  request_id?: string
  reference?: string
  flow: "invoice" | "monopay"
  amount: number
  ccy: number
  page_url?: string
  cart_id?: string
}

/** Зберігає рахунок у нашій БД, щоб вебхук потім мав що оновлювати. */
export const persistMonobankInvoiceStep = createStep(
  "persist-monobank-invoice",
  async (input: PersistMonobankInvoiceInput, { container }) => {
    const service: MonobankModuleService = container.resolve(MONOBANK_MODULE)

    const [invoice] = await service.createMonobankInvoices([
      {
        invoice_id: input.invoice_id ?? null,
        request_id: input.request_id ?? null,
        reference: input.reference ?? null,
        flow: input.flow,
        amount: input.amount,
        ccy: input.ccy,
        page_url: input.page_url ?? null,
        cart_id: input.cart_id ?? null,
        status: "created",
        outcome: "pending",
      },
    ])

    return new StepResponse(invoice, invoice.id)
  },
  async (id, { container }) => {
    if (!id) {
      return
    }

    const service: MonobankModuleService = container.resolve(MONOBANK_MODULE)
    await service.deleteMonobankInvoices(id)
  }
)
