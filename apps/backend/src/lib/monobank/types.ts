/**
 * Типи Monobank Acquiring API.
 * Докладніше: https://monobank.ua/api-docs/acquiring/
 *
 * Усі суми — у мінімальних одиницях валюти (копійках): 10000 === 100.00 грн.
 */

/** ISO 4217. 980 — UAH (за замовчуванням), 840 — USD, 978 — EUR. */
export const CCY_UAH = 980

export type MonobankInvoiceStatus =
  | "created" // рахунок створено, користувач ще не платив
  | "processing" // оплата в обробці
  | "hold" // кошти заблоковані (paymentType: "hold")
  | "success" // успішна оплата
  | "failure" // неуспішна оплата
  | "reversed" // кошти повернуто (повністю або частково)
  | "expired" // час життя рахунку вичерпано

export type MonobankPaymentType = "debit" | "hold"

export type MonobankBasketItem = {
  /** Назва товару */
  name: string
  /** Кількість */
  qty: number
  /** Вартість позиції в копійках (за всю кількість) */
  sum: number
  /** Артикул / унікальний код товару */
  code: string
  /** Посилання на зображення або base64 */
  icon?: string
  /** Одиниця виміру, напр. "шт." */
  unit?: string
  barcode?: string
  header?: string
  footer?: string
  /** Коди податкових ставок */
  tax?: number[]
  uktzed?: string
}

export type MonobankMerchantPaymInfo = {
  /** Ваш ідентифікатор замовлення — повертається у вебхуці */
  reference?: string
  /** Призначення платежу, показується користувачу */
  destination?: string
  comment?: string
  basketOrder?: MonobankBasketItem[]
}

export type CreateInvoiceInput = {
  /** Сума в копійках */
  amount: number
  ccy?: number
  merchantPaymInfo?: MonobankMerchantPaymInfo
  /** Куди повернути користувача після оплати (GET) */
  redirectUrl?: string
  /** Куди Monobank надішле POST зі зміною статусу */
  webHookUrl?: string
  /** Час життя рахунку в секундах, за замовчуванням 24 години */
  validity?: number
  paymentType?: MonobankPaymentType
  /** true — у відповіді буде deeplink monobank:// */
  withAppUrl?: boolean
  saveCardData?: {
    saveCard: boolean
    walletId?: string
  }
}

export type CreateInvoiceResponse = {
  invoiceId: string
  /** Сторінка оплати — саме сюди перенаправляємо користувача */
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
  /** Код помилки, якщо оплата не пройшла */
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

/** Тіло вебхука збігається зі структурою відповіді status. */
export type MonobankWebhookPayload = InvoiceStatusResponse

/**
 * Нормалізований результат для фронтенду, щоб не тягнути
 * сирі статуси Monobank у UI.
 */
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
      // користувач не завершив оплату у відведений час — трактуємо як відміну
      return "canceled"
    default:
      return "pending"
  }
}
