
export const CCY_UAH = 980

export type MonobankInvoiceStatus =
  | "created"
  | "processing"
  | "hold"
  | "success"
  | "failure"
  | "reversed"
  | "expired"

export type MonobankPaymentType = "debit" | "hold"

export type MonobankBasketItem = {
  name: string
  qty: number
  sum: number
  code: string
  icon?: string
  unit?: string
  barcode?: string
  header?: string
  footer?: string
  tax?: number[]
  uktzed?: string
}

export type MonobankMerchantPaymInfo = {
  reference?: string
  destination?: string
  comment?: string
  basketOrder?: MonobankBasketItem[]
}

export type CreateInvoiceInput = {
  amount: number
  ccy?: number
  merchantPaymInfo?: MonobankMerchantPaymInfo
  redirectUrl?: string
  webHookUrl?: string
  validity?: number
  paymentType?: MonobankPaymentType
  withAppUrl?: boolean
  saveCardData?: {
    saveCard: boolean
    walletId?: string
  }
}

export type CreateInvoiceResponse = {
  invoiceId: string
  pageUrl: string
  appUrl?: string
}

export type InvoiceStatusResponse = {
  invoiceId: string
  status: MonobankInvoiceStatus
  amount: number
  ccy: number
  finalAmount?: number
  createdDate?: string
  modifiedDate?: string
  reference?: string
  destination?: string
  errCode?: string
  failureReason?: string
  paymentInfo?: {
    rrn?: string
    approvalCode?: string
    tranId?: string
    terminal?: string
    bank?: string
    paymentSystem?: string
    paymentMethod?: string
    maskedPan?: string
    fee?: number
    country?: string
    agentFee?: number
  }
  cancelList?: Array<{
    status: string
    amount: number
    ccy: number
    createdDate?: string
    modifiedDate?: string
    approvalCode?: string
    rrn?: string
    extRef?: string
  }>
}

export type MonobankWebhookPayload = InvoiceStatusResponse

export type PaymentOutcome = "pending" | "paid" | "hold" | "failed" | "canceled"

export function toPaymentOutcome(status: MonobankInvoiceStatus): PaymentOutcome {
  switch (status) {
    case "success":
      return "paid"
    case "hold":
      return "hold"
    case "failure":
      return "failed"
    case "reversed":
      return "canceled"
    case "expired":
      return "canceled"
    default:
      return "pending"
  }
}
