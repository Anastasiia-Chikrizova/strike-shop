import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { initMonoPayPaymentWorkflow } from "../../../../../workflows/init-monopay-payment"
import { PostMonoPayInitSchema } from "../../middlewares"

/**
 * POST /store/monobank/monopay/init
 *
 * Віддає віджету MonoPay чотири параметри для window.MonoPay.init().
 * Термін життя requestId — 10 хвилин, після цього треба питати заново.
 */
export async function POST(
  req: MedusaRequest<PostMonoPayInitSchema>,
  res: MedusaResponse
) {
  const { result } = await initMonoPayPaymentWorkflow(req.scope).run({
    input: req.validatedBody,
  })

  res.status(201).json({
    keyId: result.keyId,
    signature: result.signature,
    requestId: result.requestId,
    payloadBase64: result.payloadBase64,
    amount: result.amount,
    ccy: result.ccy,
    reference: result.reference,
    /** Скільки секунд ці дані ще дійсні. */
    expires_in: 600,
  })
}
