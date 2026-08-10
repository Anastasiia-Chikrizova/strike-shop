import crypto from "crypto"

import { monobank, MonobankClient, MonobankError } from "./client"
import { CreateInvoiceInput } from "./types"

const KEY_ID_TTL_MS = 60 * 60 * 1000

export type MonoPayRequest = {
  keyId: string
  signature: string
  requestId: string
  payloadBase64: string
}

let keyIdCache: { keyId: string; fetchedAt: number } | null = null

export function signMonoPayPayload(
  payload: CreateInvoiceInput,
  options: { requestId?: string; privateKeyPem?: string } = {}
): Omit<MonoPayRequest, "keyId"> {
  const json = JSON.stringify(payload)
  const requestId = options.requestId ?? crypto.randomUUID()
  const privateKey = loadPrivateKey(options.privateKeyPem)

  const signature = crypto
    .createSign("SHA256")
    .update(json + requestId)
    .sign(privateKey)

  return {
    requestId,
    signature: signature.toString("base64"),
    payloadBase64: Buffer.from(json, "utf8").toString("base64"),
  }
}

export function loadPrivateKey(pem?: string): crypto.KeyObject {
  const raw = pem ?? process.env.MONOPAY_PRIVATE_KEY

  if (!raw) {
    throw new MonobankError(
      "MONOPAY_PRIVATE_KEY is not set. Generate a key pair: npx medusa exec ./src/scripts/monopay-keys.ts",
      500
    )
  }

  const normalized = raw.includes("BEGIN")
    ? raw.replace(/\\n/g, "\n")
    : Buffer.from(raw, "base64").toString("utf8")

  let key: crypto.KeyObject

  try {
    key = crypto.createPrivateKey(normalized)
  } catch (e) {
    throw new MonobankError(
      `MONOPAY_PRIVATE_KEY cannot be parsed as PEM: ${(e as Error).message}`,
      500
    )
  }

  const curve = key.asymmetricKeyDetails?.namedCurve

  if (key.asymmetricKeyType !== "ec" || curve !== "prime256v1") {
    throw new MonobankError(
      `MonoPay requires ECDSA P-256, but the key is ${key.asymmetricKeyType}/${curve ?? "?"}.`,
      500
    )
  }

  return key
}

export async function getMonoPayKeyId(
  client: MonobankClient = monobank
): Promise<string> {
  if (process.env.MONOPAY_KEY_ID) {
    return process.env.MONOPAY_KEY_ID
  }

  if (keyIdCache && Date.now() - keyIdCache.fetchedAt < KEY_ID_TTL_MS) {
    return keyIdCache.keyId
  }

  const keys = await client.listMonoPayKeys()
  const keyId = keys.map((key) => key.keyId ?? key.id).find(Boolean)

  if (!keyId) {
    throw new MonobankError(
      "The merchant has no MonoPay public key. Import one: npx medusa exec ./src/scripts/monopay-keys.ts",
      500
    )
  }

  keyIdCache = { keyId, fetchedAt: Date.now() }

  return keyId
}

export function resetKeyIdCache(): void {
  keyIdCache = null
}
