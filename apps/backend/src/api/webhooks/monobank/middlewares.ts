import { MiddlewareRoute } from "@medusajs/framework/http"

export const monobankWebhookMiddlewares: MiddlewareRoute[] = [
  {
    matcher: "/webhooks/monobank",
    method: ["POST"],
    bodyParser: { preserveRawBody: true },
  },
]
