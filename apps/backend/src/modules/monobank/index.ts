import { Module } from "@medusajs/framework/utils"

import MonobankModuleService from "./service"

export const MONOBANK_MODULE = "monobank"

export default Module(MONOBANK_MODULE, {
  service: MonobankModuleService,
})
