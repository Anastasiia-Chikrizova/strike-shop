import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"

import {
  logMonobankWebhookStep,
  LogMonobankWebhookInput,
} from "./steps/log-monobank-webhook"

/** Окремий воркфлоу: лог пишеться і тоді, коли обробка вебхука впала. */
export const logMonobankWebhookWorkflow = createWorkflow(
  "log-monobank-webhook",
  function (input: LogMonobankWebhookInput) {
    const log = logMonobankWebhookStep(input)

    return new WorkflowResponse(log)
  }
)

export default logMonobankWebhookWorkflow
