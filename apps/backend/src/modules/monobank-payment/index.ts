import { ModuleProvider, Modules } from "@medusajs/framework/utils"

import MonobankPaymentProviderService from "./service"

export default ModuleProvider(Modules.PAYMENT, {
  services: [MonobankPaymentProviderService],
})
