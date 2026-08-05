"use server"

import { sdk } from "@lib/config"

import { getAuthHeaders, getCartId } from "./cookies"
import { getOrigin } from "./monobank"

export type MonoPayInitData = {
  keyId: string
  signature: string
  requestId: string
  payloadBase64: string
  amount: number
  ccy: number
  reference?: string
  expires_in: number
}

export async function initMonoPay(input?: {
  cartId?: string
  countryCode?: string
  destination?: string
  comment?: string
  redirectUrl?: string
  successUrl?: string
  failUrl?: string
}): Promise<MonoPayInitData> {
  const cartId = input?.cartId ?? (await getCartId())

  if (!cartId) {
    throw new Error("Немає кошика для оплати")
  }

  const returnUrl = input?.countryCode
    ? `${await getOrigin()}/${input.countryCode}/monobank/return`
    : undefined

  return sdk.client.fetch<MonoPayInitData>("/store/monobank/monopay/init", {
    method: "POST",
    headers: { ...(await getAuthHeaders()) },
    body: {
      cart_id: cartId,
      destination: input?.destination,
      comment: input?.comment,
      redirect_url: input?.redirectUrl ?? returnUrl,
      success_url: input?.successUrl,
      fail_url: input?.failUrl,
    },
    cache: "no-store",
  })
}
