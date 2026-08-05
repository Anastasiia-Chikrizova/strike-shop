import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"

import {
  applyMonobankWebhookStep,
  ApplyMonobankWebhookInput,
} from "./steps/apply-monobank-webhook"

export const applyMonobankWebhookWorkflow = createWorkflow(
  "apply-monobank-webhook",
  function (input: ApplyMonobankWebhookInput) {
    const result = applyMonobankWebhookStep(input)

    return new WorkflowResponse(result)
  }
)

export default applyMonobankWebhookWorkflow
