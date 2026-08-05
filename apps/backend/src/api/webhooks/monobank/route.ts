import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

import {
  MonobankWebhookPayload,
  toPaymentOutcome,
} from "../../../lib/monobank/types"
import { verifyMonobankSignature } from "../../../lib/monobank/webhook"
import { applyMonobankWebhookWorkflow } from "../../../workflows/apply-monobank-webhook"
import { logMonobankWebhookWorkflow } from "../../../workflows/log-monobank-webhook"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)

  const rawBody =
    req.rawBody instanceof Buffer ? req.rawBody.toString("utf8") : req.rawBody
  const payload = req.body as MonobankWebhookPayload | undefined

  const isValid = await verifyMonobankSignature(
    req.rawBody,
    req.headers["x-sign"]
  )

  let httpStatus = 200
  let error: string | undefined

  if (!isValid) {
    httpStatus = 401
    error = "Невалідний підпис x-sign"
    logger.warn("[monobank] Вебхук з невалідним підписом — відхилено")
  } else if (!payload?.invoiceId || !payload?.status) {
    httpStatus = 400
    error = "Тіло вебхука без invoiceId або status"
  } else {
    const outcome = toPaymentOutcome(payload.status)

    logger.info(
      `[monobank] invoice ${payload.invoiceId}: ${payload.status} (${outcome}), reference=${payload.reference ?? "-"}`
    )

    try {
      const { result } = await applyMonobankWebhookWorkflow(req.scope).run({
        input: {
          invoice_id: payload.invoiceId,
          status: payload.status,
          outcome,
          amount: payload.amount,
          final_amount: payload.finalAmount,
          ccy: payload.ccy,
          reference: payload.reference,
          modified_date: payload.modifiedDate,
          failure_reason: payload.failureReason,
          err_code: payload.errCode,
        },
      })

      if (!result.applied) {
        logger.info(
          `[monobank] Пропущено застарілий вебхук для ${payload.invoiceId}`
        )
      } else {
        const eventBus = req.scope.resolve(Modules.EVENT_BUS)

        await eventBus.emit({
          name: `monobank.invoice.${outcome}`,
          data: {
            id: result.id,
            invoice_id: payload.invoiceId,
            status: payload.status,
            reference: payload.reference,
            amount: payload.amount,
            final_amount: payload.finalAmount,
            ccy: payload.ccy,
            modified_date: payload.modifiedDate,
            failure_reason: payload.failureReason,
            err_code: payload.errCode,
          },
        })
      }
    } catch (e) {
      httpStatus = 500
      error = (e as Error).message
      logger.error(
        `[monobank] Не вдалося обробити вебхук для ${payload.invoiceId}: ${error}`
      )
    }
  }

  try {
    await logMonobankWebhookWorkflow(req.scope).run({
      input: {
        invoice_id: payload?.invoiceId,
        reference: payload?.reference,
        status: payload?.status,
        signature_valid: isValid,
        http_status: httpStatus,
        raw_body: rawBody,
        payload: payload as Record<string, unknown> | undefined,
        error,
      },
    })
  } catch (e) {
    httpStatus = 500
    error = (e as Error).message
    logger.error(`[monobank] Не вдалося записати лог вебхука: ${error}`)
  }

  res.status(httpStatus).json(
    httpStatus === 200 ? { received: true } : { message: error }
  )
}
