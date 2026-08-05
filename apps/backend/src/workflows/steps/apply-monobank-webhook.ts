import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

import { MonobankInvoiceStatus, PaymentOutcome } from "../../lib/monobank/types"
import { MONOBANK_MODULE } from "../../modules/monobank"
import MonobankModuleService from "../../modules/monobank/service"

export type ApplyMonobankWebhookInput = {
  invoice_id: string
  status: MonobankInvoiceStatus
  outcome: PaymentOutcome
  amount?: number
  final_amount?: number
  ccy?: number
  reference?: string
  modified_date?: string
  failure_reason?: string
  err_code?: string
}

export type ApplyMonobankWebhookOutput = {
  id: string
  applied: boolean
  created: boolean
}

type Snapshot = {
  id: string
  status: MonobankInvoiceStatus
  outcome: PaymentOutcome
  final_amount: number | null
  modified_date: Date | null
  failure_reason: string | null
  err_code: string | null
  invoice_id: string | null
} | null

export const applyMonobankWebhookStep = createStep(
  "apply-monobank-webhook",
  async (
    input: ApplyMonobankWebhookInput,
    { container }
  ): Promise<StepResponse<ApplyMonobankWebhookOutput, Snapshot>> => {
    const service: MonobankModuleService = container.resolve(MONOBANK_MODULE)

    const existing = await findInvoice(service, input)

    if (!existing) {
      const [created] = await service.createMonobankInvoices([
        {
          invoice_id: input.invoice_id,
          reference: input.reference ?? null,
          flow: "monopay",
          amount: input.amount ?? 0,
          ccy: input.ccy ?? 980,
          final_amount: input.final_amount ?? null,
          status: input.status,
          outcome: input.outcome,
          modified_date: toDate(input.modified_date),
          failure_reason: input.failure_reason ?? null,
          err_code: input.err_code ?? null,
        },
      ])

      return new StepResponse(
        { id: created.id, applied: true, created: true },
        null
      )
    }

    if (isStale(existing.modified_date, input.modified_date)) {
      return new StepResponse(
        { id: existing.id, applied: false, created: false },
        null
      )
    }

    const snapshot: Snapshot = {
      id: existing.id,
      status: existing.status,
      outcome: existing.outcome,
      final_amount: existing.final_amount,
      modified_date: existing.modified_date,
      failure_reason: existing.failure_reason,
      err_code: existing.err_code,
      invoice_id: existing.invoice_id,
    }

    await service.updateMonobankInvoices({
      id: existing.id,
      invoice_id: input.invoice_id,
      status: input.status,
      outcome: input.outcome,
      final_amount: input.final_amount ?? existing.final_amount,
      modified_date: toDate(input.modified_date) ?? existing.modified_date,
      failure_reason: input.failure_reason ?? null,
      err_code: input.err_code ?? null,
    })

    return new StepResponse(
      { id: existing.id, applied: true, created: false },
      snapshot
    )
  },
  async (snapshot, { container }) => {
    if (!snapshot) {
      return
    }

    const service: MonobankModuleService = container.resolve(MONOBANK_MODULE)
    await service.updateMonobankInvoices(snapshot)
  }
)

async function findInvoice(
  service: MonobankModuleService,
  input: ApplyMonobankWebhookInput
) {
  const [byInvoiceId] = await service.listMonobankInvoices({
    invoice_id: input.invoice_id,
  })

  if (byInvoiceId) {
    return byInvoiceId
  }

  if (!input.reference) {
    return undefined
  }

  const byReference = await service.listMonobankInvoices({
    reference: input.reference,
  })

  return byReference.find((row) => !row.invoice_id) ?? byReference[0]
}

function isStale(current: Date | null, incoming?: string): boolean {
  if (!current || !incoming) {
    return false
  }

  const incomingDate = toDate(incoming)

  return !!incomingDate && incomingDate.getTime() <= current.getTime()
}

function toDate(value?: string): Date | null {
  if (!value) {
    return null
  }

  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? null : date
}
