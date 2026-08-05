import crypto from "crypto"

import { monobank, MonobankClient } from "./client"

const KEY_TTL_MS = 24 * 60 * 60 * 1000
const MIN_REFETCH_INTERVAL_MS = 60_000

type KeyCache = { pem: Buffer; fetchedAt: number }

let cache: KeyCache | null = null
let inflight: Promise<KeyCache> | null = null

async function loadPublicKey(
  client: MonobankClient,
  force = false
): Promise<KeyCache | null> {
  const now = Date.now()

  if (!force && cache && now - cache.fetchedAt < KEY_TTL_MS) {
    return cache
  }

  if (force && cache && now - cache.fetchedAt < MIN_REFETCH_INTERVAL_MS) {
    return null
  }

  inflight ??= client.getPublicKey().then(({ key }) => {
    const entry: KeyCache = {
      pem: Buffer.from(key, "base64"),
      fetchedAt: Date.now(),
    }
    cache = entry
    return entry
  })

  try {
    return await inflight
  } finally {
    inflight = null
  }
}

function verifyWithKey(
  body: Buffer | string,
  signature: Buffer,
  pem: Buffer
): boolean {
  try {
    return crypto.createVerify("SHA256").update(body).verify(pem, signature)
  } catch {
    return false
  }
}

export async function verifyMonobankSignature(
  rawBody: Buffer | string | undefined,
  xSign: string | string[] | undefined,
  client: MonobankClient = monobank
): Promise<boolean> {
  const sign = Array.isArray(xSign) ? xSign[0] : xSign

  if (!rawBody?.length || !sign) {
    return false
  }

  const signature = Buffer.from(sign, "base64")

  if (!signature.length) {
    return false
  }

  const cached = await loadPublicKey(client)

  if (cached && verifyWithKey(rawBody, signature, cached.pem)) {
    return true
  }

  const refreshed = await loadPublicKey(client, true)

  return !!refreshed && verifyWithKey(rawBody, signature, refreshed.pem)
}

export function resetPublicKeyCache(): void {
  cache = null
  inflight = null
}
