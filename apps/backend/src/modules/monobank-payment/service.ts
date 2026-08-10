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
  apiKey?: string
  apiUrl?: string
  paymentType?: MonobankPaymentType
  redirectUrl?: string
  webhookUrl?: string
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
        "Monobank: apiKey is required in the provider options, or MONO_KEY in the environment."
      )
    }
  }

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

  async authorizePayment(
    input: AuthorizePaymentInput
  ): Promise<AuthorizePaymentOutput> {
    const invoice = await this.retrieveInvoice(input.data)

    return {
      status: this.toSessionStatus(invoice.status),
      data: this.mergeData(input.data, invoice),
    }
  }

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

  async refundPayment(
    input: RefundPaymentInput
  ): Promise<RefundPaymentOutput> {
    const data = input.data as unknown as SessionData

    if (!data?.invoice_id) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Monobank: the payment has no invoice_id, a refund is not possible."
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
      this.logger_.warn(
        `[monobank] Failed to cancel invoice ${data.invoice_id}: ${(e as Error).message}`
      )
    }

    return { data: input.data ?? {} }
  }

  async deletePayment(
    input: DeletePaymentInput
  ): Promise<DeletePaymentOutput> {
    const data = input.data as unknown as SessionData

    if (data?.invoice_id) {
      try {
        await this.client_.removeInvoice(data.invoice_id)
      } catch (e) {
        this.logger_.warn(
          `[monobank] Invoice ${data.invoice_id} was not deleted: ${(e as Error).message}`
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
      this.logger_.warn("[monobank] Webhook with an invalid signature — rejected")
      return { action: "not_supported" }
    }

    const sessionId = body?.reference

    if (!sessionId) {
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
        this.logger_.info(
          `[monobank] Invoice ${body.invoiceId} reversed, amount ${body.finalAmount ?? 0}`
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
        "Monobank: the payment session has no invoice_id."
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
        return "pending_authorization"
    }
  }

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
        `Monobank: invalid amount ${JSON.stringify(amount)}.`
      )
    }

    return Math.round(value * 100)
  }

  private toCcy(currencyCode: string): number {
    const ccy = CCY_BY_CURRENCY_CODE[currencyCode?.toLowerCase()]

    if (!ccy) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Monobank does not support the currency ${currencyCode}.`
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
