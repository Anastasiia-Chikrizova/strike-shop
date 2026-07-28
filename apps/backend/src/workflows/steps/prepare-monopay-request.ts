import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

import { getMonoPayKeyId, signMonoPayPayload } from "../../lib/monobank/monopay"
import { toMedusaError } from "../../lib/monobank/to-medusa-error"
import { CreateInvoiceInput } from "../../lib/monobank/types"

export type PrepareMonoPayRequestInput = {
  amount: number
  ccy: number
  reference?: string
  destination?: string
  comment?: string
  redirect_url?: string
  success_url?: string
  fail_url?: string
  validity?: number
}

export type PrepareMonoPayRequestOutput = {
  keyId: string
  signature: string
  requestId: string
  payloadBase64: string
}

/**
 * Готує дані для віджета MonoPay: payload замовлення, його підпис
 * і keyId нашого публічного ключа. Приватний ключ лишається на бекенді.
 *
 * Мутацій немає — компенсація не потрібна.
 */
export const prepareMonoPayRequestStep = createStep(
  "prepare-mono-pay-request",
  async (
    input: PrepareMonoPayRequestInput
  ): Promise<StepResponse<PrepareMonoPayRequestOutput>> => {
    try {
      const keyId = await getMonoPayKeyId()

      const payload: CreateInvoiceInput & {
        successUrl?: string
        failUrl?: string
      } = {
        amount: input.amount,
        ccy: input.ccy,
        merchantPaymInfo: {
          reference: input.reference,
          destination: input.destination ?? "Оплата замовлення",
          comment: input.comment,
        },
        redirectUrl: input.redirect_url ?? process.env.MONO_REDIRECT_URL,
        successUrl: input.success_url,
        failUrl: input.fail_url,
        webHookUrl: process.env.MONO_WEBHOOK_URL,
        validity: input.validity,
      }

      const signed = signMonoPayPayload(payload)

      return new StepResponse({ keyId, ...signed })
    } catch (e) {
      throw toMedusaError(e)
    }
  }
)
