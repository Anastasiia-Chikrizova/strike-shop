import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

import { MONOBANK_MODULE } from "../../modules/monobank"
import MonobankModuleService from "../../modules/monobank/service"

const MAX_RAW_BODY_LENGTH = 20_000

export type LogMonobankWebhookInput = {
  invoice_id?: string
  reference?: string
  status?: string
  signature_valid: boolean
  http_status: number
  raw_body?: string
  payload?: Record<string, unknown>
  error?: string
}

export const logMonobankWebhookStep = createStep(
  "log-monobank-webhook",
  async (input: LogMonobankWebhookInput, { container }) => {
    const service: MonobankModuleService = container.resolve(MONOBANK_MODULE)

    const [log] = await service.createMonobankWebhookLogs([
      {
        invoice_id: input.invoice_id ?? null,
        reference: input.reference ?? null,
        status: input.status ?? null,
        signature_valid: input.signature_valid,
        http_status: input.http_status,
        raw_body: input.raw_body?.slice(0, MAX_RAW_BODY_LENGTH) ?? null,
        payload: input.payload ?? null,
        error: input.error ?? null,
      },
    ])

    return new StepResponse(log, log.id)
  },
  async (id, { container }) => {
    if (!id) {
      return
    }

    const service: MonobankModuleService = container.resolve(MONOBANK_MODULE)
    await service.deleteMonobankWebhookLogs(id)
  }
)
