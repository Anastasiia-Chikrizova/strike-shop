import { CreditCard } from "@medusajs/icons"
import React from "react"

/* Map of payment provider_id to their title and icon. Add in any payment providers you want to use. */
export const paymentInfoMap: Record<
  string,
  { title: string; icon: React.JSX.Element }
> = {
  pp_system_default: {
    title: "Manual Payment",
    icon: <CreditCard />,
  },
  pp_monobank_monobank: {
    title: "monobank",
    icon: <CreditCard />,
  },
  // Add more payment providers here
}

/**
 * Провайдера може не бути в мапі — напр. старе замовлення з провайдером,
 * який уже прибрали. Це не привід валити сторінку замовлення.
 */
export const getPaymentInfo = (providerId?: string) =>
  paymentInfoMap[providerId ?? ""] ?? {
    title: providerId ?? "Unknown",
    icon: <CreditCard />,
  }

export const isManual = (providerId?: string) => {
  return providerId?.startsWith("pp_system_default")
}

/**
 * Платіжний провайдер Monobank у Medusa: `pp_{identifier}_{id}`,
 * де identifier і id задані в medusa-config.ts.
 */
export const MONOBANK_PROVIDER_ID = "pp_monobank_monobank"

// Add currencies that don't need to be divided by 100
export const noDivisionCurrencies = [
  "krw",
  "jpy",
  "vnd",
  "clp",
  "pyg",
  "xaf",
  "xof",
  "bif",
  "djf",
  "gnf",
  "kmf",
  "mga",
  "rwf",
  "xpf",
  "htg",
  "vuv",
  "xag",
  "xdr",
  "xau",
]
