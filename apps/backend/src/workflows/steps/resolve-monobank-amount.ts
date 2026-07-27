import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

import { CCY_UAH } from "../../lib/monobank/types"

/** ISO 4217 для валют, з якими працює Monobank. */
const CCY_BY_CURRENCY_CODE: Record<string, number> = {
  uah: 980,
  usd: 840,
  eur: 978,
}

export type ResolveMonobankAmountInput = {
  cart_id?: string
  /** Сума в копійках. Приймається лише при MONO_ALLOW_CLIENT_AMOUNT=true. */
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

/**
 * Визначає, скільки саме списувати. Сума береться з кошика на сервері —
 * інакше клієнт може оплатити замовлення за одну копійку.
 */
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
          `Кошик ${input.cart_id} не знайдено.`
        )
      }

      if (cart.completed_at) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          `Кошик ${input.cart_id} вже оформлено.`
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
        "Потрібен `cart_id` або `amount`."
      )
    }

    if (process.env.MONO_ALLOW_CLIENT_AMOUNT !== "true") {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Передавайте `cart_id` — сума рахується на сервері. Щоб дозволити явний `amount`, увімкніть MONO_ALLOW_CLIENT_AMOUNT=true."
      )
    }

    return new StepResponse({
      amount: input.amount,
      ccy: input.ccy ?? CCY_UAH,
      reference: input.reference,
    })
  }
)

/**
 * Medusa зберігає суми в основних одиницях (100.5 = 100 грн 50 коп),
 * Monobank приймає тільки копійки.
 */
function toMinorUnits(total: unknown): number {
  const value = Number(total)

  if (!Number.isFinite(value) || value <= 0) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Сума до оплати має бути більшою за нуль."
    )
  }

  return Math.round(value * 100)
}
