import {
  CreateInvoiceInput,
  CreateInvoiceResponse,
  InvoiceStatusResponse,
} from "./types"

const DEFAULT_BASE_URL = "https://api.monobank.ua"
const DEFAULT_TIMEOUT_MS = 15_000

export class MonobankError extends Error {
  constructor(
    message: string,
    readonly httpStatus: number,
    readonly errCode?: string
  ) {
    super(message)
    this.name = "MonobankError"
  }
}

type RequestOptions = {
  method: "GET" | "POST"
  path: string
  query?: Record<string, string>
  body?: unknown
}

export type MonobankClientOptions = {
  token?: string
  baseUrl?: string
  timeoutMs?: number
}

export class MonobankClient {
  private readonly options: MonobankClientOptions

  constructor(options: MonobankClientOptions = {}) {
    this.options = options
  }

  /**
   * Токен читаємо ліниво, щоб відсутність MONO_KEY валила конкретний
   * запит, а не старт усього застосунку.
   */
  private get token(): string {
    const token = this.options.token ?? process.env.MONO_KEY

    if (!token) {
      throw new MonobankError(
        "MONO_KEY is not set. Отримайте токен на https://web.monobank.ua/ (або тестовий на https://api.monobank.ua/).",
        500
      )
    }

    return token
  }

  private get baseUrl(): string {
    return (
      this.options.baseUrl ?? process.env.MONO_API_URL ?? DEFAULT_BASE_URL
    ).replace(/\/$/, "")
  }

  private async request<T>({
    method,
    path,
    query,
    body,
  }: RequestOptions): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`)

    for (const [key, value] of Object.entries(query ?? {})) {
      url.searchParams.set(key, value)
    }

    let response: Response

    try {
      response = await fetch(url, {
        method,
        headers: {
          "X-Token": this.token,
          "Content-Type": "application/json",
          "X-Cms": "Medusa",
          "X-Cms-Version": "2",
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(
          this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS
        ),
      })
    } catch (e) {
      throw new MonobankError(
        `Monobank ${method} ${path} недоступний: ${(e as Error).message}`,
        503
      )
    }

    const raw = await response.text()
    const payload = raw ? safeJsonParse(raw) : undefined

    if (!response.ok) {
      throw new MonobankError(
        payload?.errText ?? payload?.errorDescription ?? raw ?? response.statusText,
        response.status,
        payload?.errCode
      )
    }

    return payload as T
  }

  /** POST /api/merchant/invoice/create — створення рахунку та посилання на оплату. */
  createInvoice(input: CreateInvoiceInput): Promise<CreateInvoiceResponse> {
    return this.request<CreateInvoiceResponse>({
      method: "POST",
      path: "/api/merchant/invoice/create",
      body: input,
    })
  }

  /** GET /api/merchant/invoice/status — поточний статус рахунку. */
  getInvoiceStatus(invoiceId: string): Promise<InvoiceStatusResponse> {
    return this.request<InvoiceStatusResponse>({
      method: "GET",
      path: "/api/merchant/invoice/status",
      query: { invoiceId },
    })
  }

  /**
   * POST /api/merchant/invoice/cancel — повернення коштів
   * (повне або часткове, якщо передати amount у копійках).
   */
  cancelInvoice(input: {
    invoiceId: string
    amount?: number
    extRef?: string
  }): Promise<{ status: string; createdDate?: string; modifiedDate?: string }> {
    return this.request({
      method: "POST",
      path: "/api/merchant/invoice/cancel",
      body: input,
    })
  }

  /**
   * POST /api/merchant/invoice/finalize — списання заблокованих коштів
   * для рахунків із paymentType: "hold".
   */
  finalizeInvoice(input: {
    invoiceId: string
    amount: number
    items?: unknown[]
  }): Promise<{ status: string }> {
    return this.request({
      method: "POST",
      path: "/api/merchant/invoice/finalize",
      body: input,
    })
  }

  /** POST /api/merchant/invoice/remove — скасування ще не оплаченого рахунку. */
  removeInvoice(invoiceId: string): Promise<Record<string, never>> {
    return this.request({
      method: "POST",
      path: "/api/merchant/invoice/remove",
      body: { invoiceId },
    })
  }

  /**
   * GET /api/merchant/pubkey — публічний ключ для перевірки підпису вебхуків.
   * Ключ треба кешувати (див. ./webhook.ts), ендпоінт має жорсткий rate limit.
   */
  getPublicKey(): Promise<{ key: string }> {
    return this.request<{ key: string }>({
      method: "GET",
      path: "/api/merchant/pubkey",
    })
  }

  /**
   * GET /api/merchant/monopay/pubkey-list — наші публічні ключі для MonoPay.
   * API віддає `{ list: [...] }`; голий масив приймаємо про запас.
   */
  listMonoPayKeys(): Promise<MonoPayKey[]> {
    return this.request<{ list?: MonoPayKey[] } | MonoPayKey[]>({
      method: "GET",
      path: "/api/merchant/monopay/pubkey-list",
    }).then((response) =>
      Array.isArray(response) ? response : (response.list ?? [])
    )
  }

  /** POST /api/merchant/monopay/pubkey-import — завантажити публічний ключ. */
  importMonoPayKey(input: {
    /** Публічний ключ у base64 (base64 від PEM). */
    keyValue: string
    keyName?: string
    expiresAt?: string
  }): Promise<unknown> {
    return this.request({
      method: "POST",
      path: "/api/merchant/monopay/pubkey-import",
      body: input,
    })
  }

  /** POST /api/merchant/monopay/pubkey-delete — прибрати скомпрометований ключ. */
  deleteMonoPayKey(keyId: string): Promise<unknown> {
    return this.request({
      method: "POST",
      path: "/api/merchant/monopay/pubkey-delete",
      body: { keyId },
    })
  }
}

export type MonoPayKey = {
  id?: string
  keyId?: string
  keyName?: string
  dateTime?: string
  expiresAt?: string
}

function safeJsonParse(raw: string): any {
  try {
    return JSON.parse(raw)
  } catch {
    return undefined
  }
}

/** Спільний інстанс для роутів. */
export const monobank = new MonobankClient()
