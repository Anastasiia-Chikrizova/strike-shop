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

  private get token(): string {
    const token = this.options.token ?? process.env.MONO_KEY

    if (!token) {
      throw new MonobankError(
        "MONO_KEY is not set. Get a token at https://web.monobank.ua/ (or a test one at https://api.monobank.ua/).",
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
        `Monobank ${method} ${path} is unavailable: ${(e as Error).message}`,
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

  createInvoice(input: CreateInvoiceInput): Promise<CreateInvoiceResponse> {
    return this.request<CreateInvoiceResponse>({
      method: "POST",
      path: "/api/merchant/invoice/create",
      body: input,
    })
  }

  getInvoiceStatus(invoiceId: string): Promise<InvoiceStatusResponse> {
    return this.request<InvoiceStatusResponse>({
      method: "GET",
      path: "/api/merchant/invoice/status",
      query: { invoiceId },
    })
  }

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

  removeInvoice(invoiceId: string): Promise<Record<string, never>> {
    return this.request({
      method: "POST",
      path: "/api/merchant/invoice/remove",
      body: { invoiceId },
    })
  }

  getPublicKey(): Promise<{ key: string }> {
    return this.request<{ key: string }>({
      method: "GET",
      path: "/api/merchant/pubkey",
    })
  }

  listMonoPayKeys(): Promise<MonoPayKey[]> {
    return this.request<{ list?: MonoPayKey[] } | MonoPayKey[]>({
      method: "GET",
      path: "/api/merchant/monopay/pubkey-list",
    }).then((response) =>
      Array.isArray(response) ? response : (response.list ?? [])
    )
  }

  importMonoPayKey(input: {
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

export const monobank = new MonobankClient()
