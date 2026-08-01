"use server"

import { sdk } from "@lib/config"
import { MONOBANK_PROVIDER_ID } from "@lib/constants"
import { cookies as nextCookies, headers as nextHeaders } from "next/headers"
import { redirect } from "next/navigation"

import { initiatePaymentSession, retrieveCart } from "./cart"
import { getAuthHeaders, getCartId } from "./cookies"

const INVOICE_COOKIE = "_monobank_invoice"

export type MonobankInvoice = {
  invoice_id: string
  page_url: string
  amount: number
  ccy: number
  reference?: string
}

export type MonobankPaymentOutcome =
  | "pending"
  | "paid"
  | "hold"
  | "failed"
  | "canceled"

export type MonobankPaymentStatus = {
  invoice_id: string
  outcome: MonobankPaymentOutcome
  status: string
  amount: number
  final_amount?: number
  ccy: number
  reference?: string
  failure_reason?: string
  err_code?: string
  modified_date?: string
}

export async function createMonobankPayment(input?: {
  cartId?: string
  destination?: string
  comment?: string
  redirectUrl?: string
}): Promise<MonobankInvoice> {
  const cartId = input?.cartId ?? (await getCartId())

  if (!cartId) {
    throw new Error("Немає кошика для оплати")
  }

  return sdk.client.fetch<MonobankInvoice>("/store/monobank/payments", {
    method: "POST",
    headers: { ...(await getAuthHeaders()) },
    body: {
      cart_id: cartId,
      destination: input?.destination,
      comment: input?.comment,
      redirect_url: input?.redirectUrl,
    },
  })
}

export async function startMonobankPayment(
  countryCode: string,
  cartId?: string
): Promise<void> {
  const cart = await retrieveCart(cartId)

  if (!cart) {
    throw new Error("Немає кошика для оплати")
  }

  const origin = await getOrigin()

  const collection = await initiatePaymentSession(cart, {
    provider_id: MONOBANK_PROVIDER_ID,
    data: {
      redirect_url: `${origin}/${countryCode}/monobank/return`,
    },
  })

  const session = collection.payment_collection?.payment_sessions?.find(
    (paymentSession) => paymentSession.provider_id === MONOBANK_PROVIDER_ID
  )

  const data = session?.data as
    | { page_url?: string; invoice_id?: string }
    | undefined

  if (!data?.page_url) {
    throw new Error(
      "Monobank не повернув посилання на оплату. Перевірте MONO_KEY на бекенді."
    )
  }

  if (data.invoice_id) {
    const cookies = await nextCookies()

    cookies.set(INVOICE_COOKIE, data.invoice_id, {
      maxAge: 60 * 60 * 24,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    })
  }

  redirect(data.page_url)
}

export async function getOrigin(): Promise<string> {
  try {
    const headers = await nextHeaders()
    const host = headers.get("x-forwarded-host") ?? headers.get("host")

    if (host) {
      const forwardedProto = headers.get("x-forwarded-proto")?.split(",")[0]
      const protocol = forwardedProto ?? (isLocalHost(host) ? "http" : "https")

      return `${protocol}://${host}`
    }
  } catch {
  }

  return process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:8000"
}

function isLocalHost(host: string): boolean {
  const hostname = host.split(":")[0]

  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname.endsWith(".local")
  )
}

export async function getMonobankInvoiceId(): Promise<string | undefined> {
  const cookies = await nextCookies()
  return cookies.get(INVOICE_COOKIE)?.value
}

export async function clearMonobankInvoice(): Promise<void> {
  const cookies = await nextCookies()
  cookies.set(INVOICE_COOKIE, "", { maxAge: -1 })
}

export async function retrieveMonobankPayment(
  invoiceId?: string
): Promise<MonobankPaymentStatus | null> {
  const id = invoiceId ?? (await getMonobankInvoiceId())

  if (!id) {
    return null
  }

  return sdk.client
    .fetch<MonobankPaymentStatus>(`/store/monobank/payments/${id}`, {
      method: "GET",
      headers: { ...(await getAuthHeaders()) },
      cache: "no-store",
    })
    .catch(() => null)
}
