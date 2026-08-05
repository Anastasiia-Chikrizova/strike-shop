import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"

import {
  logMonobankWebhookStep,
  LogMonobankWebhookInput,
} from "./steps/log-monobank-webhook"

export const logMonobankWebhookWorkflow = createWorkflow(
  "log-monobank-webhook",
  function (input: LogMonobankWebhookInput) {
    const log = logMonobankWebhookStep(input)

    return new WorkflowResponse(log)
  }
)

export default logMonobankWebhookWorkflow
