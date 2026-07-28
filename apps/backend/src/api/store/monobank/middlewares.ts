import {
  MiddlewareRoute,
  validateAndTransformBody,
} from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"

export const PostMonobankPaymentSchema = z.object({
  /** Рекомендований шлях: суму рахуємо на сервері з кошика. */
  cart_id: z.string().optional(),
  /** Сума в копійках. Дозволена лише якщо MONO_ALLOW_CLIENT_AMOUNT=true. */
  amount: z.number().int().positive().optional(),
  ccy: z.number().int().optional(),
  /** Наш ідентифікатор замовлення — повернеться у вебхуці. */
  reference: z.string().max(255).optional(),
  destination: z.string().max(280).optional(),
  comment: z.string().max(280).optional(),
  redirect_url: z.url().optional(),
  /** Час життя рахунку в секундах (за замовчуванням у Monobank — 24 год). */
  validity: z.number().int().positive().optional(),
  payment_type: z.enum(["debit", "hold"]).optional(),
})

export type PostMonobankPaymentSchema = z.infer<
  typeof PostMonobankPaymentSchema
>

export const PostMonoPayInitSchema = z.object({
  cart_id: z.string().optional(),
  amount: z.number().int().positive().optional(),
  ccy: z.number().int().optional(),
  reference: z.string().max(255).optional(),
  destination: z.string().max(280).optional(),
  comment: z.string().max(280).optional(),
  redirect_url: z.url().optional(),
  success_url: z.url().optional(),
  fail_url: z.url().optional(),
  validity: z.number().int().positive().optional(),
})

export type PostMonoPayInitSchema = z.infer<typeof PostMonoPayInitSchema>

export const monobankStoreMiddlewares: MiddlewareRoute[] = [
  {
    matcher: "/store/monobank/payments",
    method: "POST",
    middlewares: [validateAndTransformBody(PostMonobankPaymentSchema)],
  },
  {
    matcher: "/store/monobank/monopay/init",
    method: "POST",
    middlewares: [validateAndTransformBody(PostMonoPayInitSchema)],
  },
]
