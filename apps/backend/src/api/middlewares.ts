import { defineMiddlewares } from "@medusajs/framework/http"

import { monobankStoreMiddlewares } from "./store/monobank/middlewares"
import { monobankWebhookMiddlewares } from "./webhooks/monobank/middlewares"

export default defineMiddlewares({
  routes: [...monobankStoreMiddlewares, ...monobankWebhookMiddlewares],
})
