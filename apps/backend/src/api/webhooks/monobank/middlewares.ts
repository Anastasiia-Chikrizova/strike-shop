import { MiddlewareRoute } from "@medusajs/framework/http"

export const monobankWebhookMiddlewares: MiddlewareRoute[] = [
  {
    // Підпис Monobank рахується від СИРИХ байтів тіла запиту,
    // тому для цього роуту зберігаємо req.rawBody.
    matcher: "/webhooks/monobank",
    method: ["POST"],
    bodyParser: { preserveRawBody: true },
  },
]
