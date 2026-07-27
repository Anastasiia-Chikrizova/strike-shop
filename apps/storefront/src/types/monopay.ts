/**
 * Типи глобального віджета MonoPay.
 * Скрипт вантажиться з pay.monobank.ua і кладе MonoPay у window.
 *
 * https://monobank.ua/api-docs/acquiring/methods/monopay/docs--js-widget
 */

export type MonoPayUiOptions = {
  buttonType?: "base" | "pay" | "subscribe"
  theme?: "dark" | "light"
  corners?: "none" | "rounded" | "pill"
}

export type MonoPayInvoiceCreated = {
  invoiceId: string
  orderId?: string
  webUrl?: string
  appUrl?: string
}

export type MonoPaySuccess = {
  invoiceId: string
  orderId?: string
  amount?: number
  status?: string
}

export type MonoPayError = {
  code?: string
  message?: string
  description?: string
}

export type MonoPayCallbacks = {
  onButtonReady?: () => void
  onClick?: () => void
  onInvoiceCreate?: (data: MonoPayInvoiceCreated) => void
  onSuccess?: (result: MonoPaySuccess) => void
  onError?: (error: MonoPayError) => void
}

export type MonoPayInitOptions = {
  keyId: string
  signature: string
  requestId: string
  payloadBase64: string
  ui?: MonoPayUiOptions
  callbacks?: MonoPayCallbacks
}

export type MonoPayInstance = {
  init: (options: MonoPayInitOptions) => { button: HTMLElement }
  update: (options: Partial<MonoPayInitOptions>) => void
  destroy: () => void
}

declare global {
  interface Window {
    MonoPay?: MonoPayInstance
  }
}
