import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

import { CCY_UAH } from "../../lib/monobank/types"

const CCY_BY_CURRENCY_CODE: Record<string, number> = {
  uah: 980,
  usd: 840,
  eur: 978,
}

export type ResolveMonobankAmountInput = {
  cart_id?: string
  amount?: number
  ccy?: number
  reference?: string
}

export type ResolveMonobankAmountOutput = {
  amount: number
  ccy: number
  reference?: string
  cart_id?: string
}

export const resolveMonobankAmountStep = createStep(
  "resolve-monobank-amount",
  async (
    input: ResolveMonobankAmountInput,
    { container }
  ): Promise<StepResponse<ResolveMonobankAmountOutput>> => {
    if (input.cart_id) {
      const query = container.resolve(ContainerRegistrationKeys.QUERY)

      const { data } = await query.graph({
        entity: "cart",
        fields: ["id", "currency_code", "total", "completed_at"],
        filters: { id: input.cart_id },
      })

      const cart = data[0]

      if (!cart) {
        throw new MedusaError(
          MedusaError.Types.NOT_FOUND,
          `Cart ${input.cart_id} was not found.`
        )
      }

      if (cart.completed_at) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          `Cart ${input.cart_id} has already been completed.`
        )
      }

      return new StepResponse({
        amount: toMinorUnits(cart.total),
        ccy:
          CCY_BY_CURRENCY_CODE[cart.currency_code?.toLowerCase()] ??
          input.ccy ??
          CCY_UAH,
        reference: input.reference ?? cart.id,
        cart_id: cart.id,
      })
    }

    if (!input.amount) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Either `cart_id` or `amount` is required."
      )
    }

    if (process.env.MONO_ALLOW_CLIENT_AMOUNT !== "true") {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Pass `cart_id` — the amount is calculated on the server. To allow an explicit `amount`, set MONO_ALLOW_CLIENT_AMOUNT=true."
      )
    }

    return new StepResponse({
      amount: input.amount,
      ccy: input.ccy ?? CCY_UAH,
      reference: input.reference,
    })
  }
)

function toMinorUnits(total: unknown): number {
  const value = Number(total)

  if (!Number.isFinite(value) || value <= 0) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "The amount to pay must be greater than zero."
    )
  }

  return Math.round(value * 100)
}
