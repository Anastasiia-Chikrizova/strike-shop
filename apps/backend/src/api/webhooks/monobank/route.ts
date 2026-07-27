import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

import {
  MonobankWebhookPayload,
  toPaymentOutcome,
} from "../../../lib/monobank/types"
import { verifyMonobankSignature } from "../../../lib/monobank/webhook"
import { applyMonobankWebhookWorkflow } from "../../../workflows/apply-monobank-webhook"
import { logMonobankWebhookWorkflow } from "../../../workflows/log-monobank-webhook"

/**
 * POST /webhooks/monobank
 *
 * Monobank шле сюди POST при кожній зміні статусу рахунку.
 * Це — єдине джерело правди про оплату: сторінці повернення довіряти не можна,
 * користувач може закрити вкладку або підмінити URL.
 *
 * Будь-яка відповідь, крім 2xx, змушує Monobank повторити доставку —
 * тому 200 віддаємо тільки коли стан справді записано в БД.
 *
 * Сирий body для перевірки підпису вмикається в
 * src/api/webhooks/monobank/middlewares.ts (`preserveRawBody: true`).
 */
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
        // Бізнес-логіку виносимо в підписників (src/subscribers), щоб не
        // тримати Monobank у стані очікування.
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
      // Стан не записано — віддаємо 500, щоб Monobank прислав вебхук ще раз.
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
    // Якщо не пишеться навіть лог — БД недоступна, просимо ретрай.
    httpStatus = 500
    error = (e as Error).message
    logger.error(`[monobank] Не вдалося записати лог вебхука: ${error}`)
  }

  res.status(httpStatus).json(
    httpStatus === 200 ? { received: true } : { message: error }
  )
}
