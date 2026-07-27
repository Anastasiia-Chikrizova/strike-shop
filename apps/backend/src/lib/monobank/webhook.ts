import crypto from "crypto"

import { monobank, MonobankClient } from "./client"

/**
 * Перевірка підпису вебхука Monobank.
 *
 * Monobank підписує СИРЕ тіло запиту (ECDSA + SHA256) і кладе підпис
 * у заголовок `x-sign` у base64. Публічний ключ (base64 x.509 PEM)
 * віддає GET /api/merchant/pubkey.
 *
 * Документація:
 * https://monobank.ua/api-docs/acquiring/dev/webhooks/verify
 * https://monobank.ua/api-docs/acquiring/dev/webhooks/get--api--merchant--pubkey
 */

/** Ключ змінюється рідко — тримаємо в пам'яті добу. */
const KEY_TTL_MS = 24 * 60 * 60 * 1000
/** Захист від DoS по ендпоінту ключа: не частіше ніж раз на хвилину. */
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
    // Ключ щойно оновлювали — підпис справді невалідний, не довбимо API.
    return null
  }

  // Кілька одночасних вебхуків не повинні дати кілька запитів по ключ.
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
    // Побитий ключ або підпис — OpenSSL кидає виняток замість false.
    return false
  }
}

/**
 * @param rawBody сире тіло запиту (Buffer або рядок ДО JSON.parse)
 * @param xSign значення заголовка `x-sign`
 */
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

  // Ключ міг змінитися (ротація) — пробуємо один раз зі свіжим ключем.
  const refreshed = await loadPublicKey(client, true)

  return !!refreshed && verifyWithKey(rawBody, signature, refreshed.pem)
}

/** Для тестів. */
export function resetPublicKeyCache(): void {
  cache = null
  inflight = null
}
