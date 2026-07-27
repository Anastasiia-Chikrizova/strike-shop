import { MedusaService } from "@medusajs/framework/utils"

import MonobankInvoice from "./models/invoice"
import MonobankWebhookLog from "./models/webhook-log"

class MonobankModuleService extends MedusaService({
  MonobankInvoice,
  MonobankWebhookLog,
}) {}

export default MonobankModuleService
