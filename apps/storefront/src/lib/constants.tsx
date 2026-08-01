import { CreditCard } from "@medusajs/icons"
import React from "react"

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
}

export const getPaymentInfo = (providerId?: string) =>
  paymentInfoMap[providerId ?? ""] ?? {
    title: providerId ?? "Unknown",
    icon: <CreditCard />,
  }

export const isManual = (providerId?: string) => {
  return providerId?.startsWith("pp_system_default")
}

export const MONOBANK_PROVIDER_ID = "pp_monobank_monobank"

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
