import {
  AuthorizePaymentInput,
  AuthorizePaymentOutput,
  BigNumberInput,
  CancelPaymentInput,
  CancelPaymentOutput,
  CapturePaymentInput,
  CapturePaymentOutput,
  DeletePaymentInput,
  DeletePaymentOutput,
  GetPaymentStatusInput,
  GetPaymentStatusOutput,
  InitiatePaymentInput,
  InitiatePaymentOutput,
  Logger,
  ProviderWebhookPayload,
  RefundPaymentInput,
  RefundPaymentOutput,
  RetrievePaymentInput,
  RetrievePaymentOutput,
  UpdatePaymentInput,
  UpdatePaymentOutput,
  WebhookActionResult,
} from "@medusajs/framework/types"
import {
  AbstractPaymentProvider,
  BigNumber,
  MedusaError,
} from "@medusajs/framework/utils"

import { MonobankClient, MonobankError } from "../../lib/monobank/client"
import {
  InvoiceStatusResponse,
  MonobankInvoiceStatus,
  MonobankPaymentType,
} from "../../lib/monobank/types"
import { verifyMonobankSignature } from "../../lib/monobank/webhook"

type Options = {
  /** Токен мерчанта. За замовчуванням береться з MONO_KEY. */
  apiKey?: string
  apiUrl?: string
  /** "debit" — кошти списуються одразу, "hold" — блокуються до capture. */
  paymentType?: MonobankPaymentType
  /** Куди Monobank поверне користувача, якщо сторефронт не передав своє. */
  redirectUrl?: string
  /** Публічний URL вебхука Medusa: /hooks/payment/monobank_monobank */
  webhookUrl?: string
  /** Час життя рахунку в секундах. */
  validity?: number
}

type SessionData = {
  invoice_id: string
  page_url?: string
  amount: number
  ccy: number
  session_id?: string
}

const CCY_BY_CURRENCY_CODE: Record<string, number> = {
  uah: 980,
  usd: 840,
  eur: 978,
}

/**
 * Платіжний провайдер Monobank Acquiring.
 *
 * Завдяки йому Medusa веде життєвий цикл платежу сама: сесія оплати
 * створює рахунок, cart.complete() перевіряє його статус, а кнопки
 * «Capture» і «Refund» в адмінці ходять у реальний Monobank.
 *
 * https://monobank.ua/api-docs/acquiring/
 */
class MonobankPaymentProviderService extends AbstractPaymentProvider<Options> {
  static identifier = "monobank"

  protected readonly client_: MonobankClient
  protected readonly options_: Options
  protected readonly logger_: Logger

  constructor(container: { logger: Logger }, options: Options) {
    super(container as unknown as Record<string, unknown>, options)

    this.options_ = options ?? {}
    this.logger_ = container.logger
    this.client_ = new MonobankClient({
      token: this.options_.apiKey,
      baseUrl: this.options_.apiUrl,
    })
  }

  static validateOptions(options: Options): void {
    if (!options?.apiKey && !process.env.MONO_KEY) {
      throw new MedusaError(
        MedusaError.Types.INVALID_ARGUMENT,
        "Monobank: потрібен apiKey в опціях провайдера або MONO_KEY в оточенні."
      )
    }
  }

  /**
   * Створює рахунок у Monobank. `page_url` із відповіді потрапляє в
   * `data` сесії — сторефронт бере його звідти й робить redirect.
   */
  async initiatePayment(
    input: InitiatePaymentInput
  ): Promise<InitiatePaymentOutput> {
    const amount = this.toMinorUnits(input.amount)
    const ccy = this.toCcy(input.currency_code)
    const sessionId = input.data?.session_id as string | undefined
    const context = input.data as Record<string, unknown> | undefined

    try {
      const invoice = await this.client_.createInvoice({
        amount,
        ccy,
        merchantPaymInfo: {
          // reference повертається у вебхуці — так знаходимо сесію Medusa.
          reference: sessionId,
          destination:
            (context?.destination as string) ?? "Оплата замовлення",
          comment: context?.comment as string | undefined,
        },
        redirectUrl:
          (context?.redirect_url as string) ??
          this.options_.redirectUrl ??
          process.env.MONO_REDIRECT_URL,
        webHookUrl: this.options_.webhookUrl ?? process.env.MONO_WEBHOOK_URL,
        validity: this.options_.validity,
        paymentType: this.options_.paymentType,
      })

      const data: SessionData = {
        invoice_id: invoice.invoiceId,
        page_url: invoice.pageUrl,
        amount,
        ccy,
        session_id: sessionId,
      }

      return { id: invoice.invoiceId, data: data as unknown as Record<string, unknown> }
    } catch (e) {
      throw this.toMedusaError(e)
    }
  }

  /**
   * Викликається під час cart.complete(). Питаємо Monobank, чи гроші дійшли.
   *
   * При paymentType "debit" кошти вже списані, тому повертаємо `captured` —
   * Medusa створить платіж і одразу закриє його як захоплений.
   */
  async authorizePayment(
    input: AuthorizePaymentInput
  ): Promise<AuthorizePaymentOutput> {
    const invoice = await this.retrieveInvoice(input.data)

    return {
      status: this.toSessionStatus(invoice.status),
      data: this.mergeData(input.data, invoice),
    }
  }

  /**
   * Для "debit" кошти вже в мерчанта — списувати нічого.
   * Для "hold" довершуємо блокування через finalize.
   */
  async capturePayment(
    input: CapturePaymentInput
  ): Promise<CapturePaymentOutput> {
    const data = input.data as unknown as SessionData

    if (!data?.invoice_id) {
      return { data: input.data ?? {} }
    }

    const invoice = await this.retrieveInvoice(input.data)

    if (invoice.status !== "hold") {
      return { data: this.mergeData(input.data, invoice) }
    }

    try {
      await this.client_.finalizeInvoice({
        invoiceId: data.invoice_id,
        amount: invoice.amount,
      })
    } catch (e) {
      throw this.toMedusaError(e)
    }

    return { data: this.mergeData(input.data, await this.retrieveInvoice(input.data)) }
  }

  /**
   * Повернення коштів. Саме сюди веде кнопка «Refund» в адмінці.
   * Monobank підтримує часткове повернення — сума в копійках.
   */
  async refundPayment(
    input: RefundPaymentInput
  ): Promise<RefundPaymentOutput> {
    const data = input.data as unknown as SessionData

    if (!data?.invoice_id) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Monobank: у платежі немає invoice_id, повернення неможливе."
      )
    }

    try {
      await this.client_.cancelInvoice({
        invoiceId: data.invoice_id,
        amount: this.toMinorUnits(input.amount),
      })
    } catch (e) {
      throw this.toMedusaError(e)
    }

    return { data: this.mergeData(input.data, await this.retrieveInvoice(input.data)) }
  }

  /**
   * Скасування замовлення: неоплачений рахунок прибираємо,
   * оплачений — повертаємо повністю.
   */
  async cancelPayment(
    input: CancelPaymentInput
  ): Promise<CancelPaymentOutput> {
    const data = input.data as unknown as SessionData

    if (!data?.invoice_id) {
      return { data: input.data ?? {} }
    }

    try {
      const invoice = await this.retrieveInvoice(input.data)

      if (invoice.status === "success" || invoice.status === "hold") {
        await this.client_.cancelInvoice({ invoiceId: data.invoice_id })
      } else {
        await this.client_.removeInvoice(data.invoice_id)
      }
    } catch (e) {
      // Рахунок міг уже протухнути — це не привід ламати скасування замовлення.
      this.logger_.warn(
        `[monobank] Не вдалося скасувати рахунок ${data.invoice_id}: ${(e as Error).message}`
      )
    }

    return { data: input.data ?? {} }
  }

  /** Користувач обрав інший спосіб оплати — прибираємо рахунок. */
  async deletePayment(
    input: DeletePaymentInput
  ): Promise<DeletePaymentOutput> {
    const data = input.data as unknown as SessionData

    if (data?.invoice_id) {
      try {
        await this.client_.removeInvoice(data.invoice_id)
      } catch (e) {
        this.logger_.warn(
          `[monobank] Рахунок ${data.invoice_id} не видалено: ${(e as Error).message}`
        )
      }
    }

    return { data: input.data ?? {} }
  }

  async getPaymentStatus(
    input: GetPaymentStatusInput
  ): Promise<GetPaymentStatusOutput> {
    const invoice = await this.retrieveInvoice(input.data)

    return {
      status: this.toSessionStatus(invoice.status),
      data: this.mergeData(input.data, invoice),
    }
  }

  async retrievePayment(
    input: RetrievePaymentInput
  ): Promise<RetrievePaymentOutput> {
    const invoice = await this.retrieveInvoice(input.data)

    return { data: invoice as unknown as Record<string, unknown> }
  }

  /**
   * Суму рахунку в Monobank змінити не можна — якщо кошик змінився,
   * знімаємо старий рахунок і створюємо новий.
   */
  async updatePayment(
    input: UpdatePaymentInput
  ): Promise<UpdatePaymentOutput> {
    const data = input.data as unknown as SessionData
    const amount = this.toMinorUnits(input.amount)

    if (data?.invoice_id && data.amount === amount) {
      return { data: input.data ?? {} }
    }

    if (data?.invoice_id) {
      await this.deletePayment({ data: input.data })
    }

    const initiated = await this.initiatePayment({
      amount: input.amount,
      currency_code: input.currency_code,
      data: input.data,
      context: input.context,
    })

    return { data: initiated.data ?? {} }
  }

  /**
   * Вебхук Monobank прилітає на /hooks/payment/monobank_monobank.
   * Підпис перевіряємо тим самим ECDSA, що й раніше; `reference` містить
   * id сесії оплати, за яким Medusa знаходить платіж.
   */
  async getWebhookActionAndData(
    payload: ProviderWebhookPayload["payload"]
  ): Promise<WebhookActionResult> {
    const body = payload.data as unknown as InvoiceStatusResponse
    const rawBody = payload.rawData as Buffer | string | undefined
    const signature = payload.headers?.["x-sign"] as string | undefined

    const isValid = await verifyMonobankSignature(
      rawBody,
      signature,
      this.client_
    )

    if (!isValid) {
      this.logger_.warn("[monobank] Вебхук з невалідним підписом — відхилено")
      return { action: "not_supported" }
    }

    const sessionId = body?.reference

    if (!sessionId) {
      // Рахунок створювали не через Medusa (напр. MonoPay-кнопка).
      return { action: "not_supported" }
    }

    const amount = new BigNumber((body.finalAmount ?? body.amount) / 100)

    switch (body.status) {
      case "success":
        return {
          action:
            this.options_.paymentType === "hold" ? "authorized" : "captured",
          data: { session_id: sessionId, amount },
        }

      case "hold":
        return { action: "authorized", data: { session_id: sessionId, amount } }

      case "failure":
      case "expired":
        return { action: "failed", data: { session_id: sessionId, amount } }

      case "reversed":
        // Повернення завжди ініціює Medusa (кнопка Refund), і вона ж його
        // фіксує. Реагувати тут "canceled" не можна: часткове повернення
        // скасувало б увесь платіж. Логуємо на випадок повернення
        // з кабінету Monobank повз Medusa.
        this.logger_.info(
          `[monobank] Рахунок ${body.invoiceId} повернуто (reversed), сума ${body.finalAmount ?? 0}`
        )
        return { action: "not_supported" }

      default:
        return {
          action: "pending",
          data: { session_id: sessionId, amount },
        }
    }
  }

  private async retrieveInvoice(
    data?: Record<string, unknown>
  ): Promise<InvoiceStatusResponse> {
    const invoiceId = (data as unknown as SessionData)?.invoice_id

    if (!invoiceId) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Monobank: у сесії оплати немає invoice_id."
      )
    }

    try {
      return await this.client_.getInvoiceStatus(invoiceId)
    } catch (e) {
      throw this.toMedusaError(e)
    }
  }

  private mergeData(
    data: Record<string, unknown> | undefined,
    invoice: InvoiceStatusResponse
  ): Record<string, unknown> {
    return {
      ...(data ?? {}),
      invoice_id: invoice.invoiceId,
      status: invoice.status,
      final_amount: invoice.finalAmount,
      modified_date: invoice.modifiedDate,
      failure_reason: invoice.failureReason,
      err_code: invoice.errCode,
    }
  }

  /**
   * "debit" списує кошти одразу, тож success = captured. При "hold"
   * success неможливий без finalize, тому там усе через authorized.
   */
  private toSessionStatus(
    status: MonobankInvoiceStatus
  ): AuthorizePaymentOutput["status"] {
    switch (status) {
      case "success":
        return this.options_.paymentType === "hold" ? "authorized" : "captured"
      case "hold":
        return "authorized"
      case "failure":
        return "error"
      case "reversed":
      case "expired":
        return "canceled"
      default:
        // created / processing — користувач ще не завершив оплату.
        return "pending_authorization"
    }
  }

  /**
   * Medusa рахує в основних одиницях, Monobank — тільки в копійках.
   *
   * Сума приходить як BigNumberInput: подекуди це звичайне число, а з
   * адмінки (refund) — сирий об'єкт `{ value: "10" }`. Через BigNumber
   * коректно розбираються всі варіанти.
   */
  private toMinorUnits(amount: BigNumberInput): number {
    let value: number

    try {
      value = new BigNumber(amount).numeric
    } catch {
      value = NaN
    }

    if (!Number.isFinite(value) || value <= 0) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Monobank: некоректна сума ${JSON.stringify(amount)}.`
      )
    }

    return Math.round(value * 100)
  }

  private toCcy(currencyCode: string): number {
    const ccy = CCY_BY_CURRENCY_CODE[currencyCode?.toLowerCase()]

    if (!ccy) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Monobank не працює з валютою ${currencyCode}.`
      )
    }

    return ccy
  }

  private toMedusaError(e: unknown): Error {
    if (e instanceof MonobankError) {
      return new MedusaError(
        e.httpStatus >= 500
          ? MedusaError.Types.UNEXPECTED_STATE
          : MedusaError.Types.INVALID_DATA,
        `Monobank: ${e.message}`,
        e.errCode
      )
    }

    return e as Error
  }
}

export default MonobankPaymentProviderService
