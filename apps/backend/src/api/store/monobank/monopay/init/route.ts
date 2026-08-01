import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { initMonoPayPaymentWorkflow } from "../../../../../workflows/init-monopay-payment"
import { PostMonoPayInitSchema } from "../../middlewares"

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
    expires_in: 600,
  })
}
