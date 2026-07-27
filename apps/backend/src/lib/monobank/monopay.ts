import crypto from "crypto"

import { monobank, MonobankClient, MonobankError } from "./client"
import { CreateInvoiceInput } from "./types"

/**
 * MonoPay — платіжна кнопка, яку віджет ініціалізує прямо в браузері.
 *
 * На відміну від класичного invoice/create, тут інвойс створює фронтенд,
 * тому дані замовлення підписуються нашим приватним ключем ECDSA P-256,
 * а Monobank перевіряє підпис публічним ключем, який ми туди імпортували.
 *
 * https://monobank.ua/api-docs/acquiring/methods/monopay/docs--signature-example
 */

/** keyId живе довго, але тримати кеш вічно не варто. */
const KEY_ID_TTL_MS = 60 * 60 * 1000

export type MonoPayRequest = {
  /** Ідентифікатор нашого публічного ключа в Monobank (pk_test_…). */
  keyId: string
  /** base64(DER ECDSA-підпис від JSON.stringify(payload) + requestId). */
  signature: string
  /** Унікальний ідентифікатор запиту, TTL 10 хвилин. */
  requestId: string
  /** base64 від того самого JSON, який підписано. */
  payloadBase64: string
}

let keyIdCache: { keyId: string; fetchedAt: number } | null = null

/**
 * Підписує дані замовлення.
 *
 * КРИТИЧНО: JSON серіалізується РІВНО ОДИН раз — і підпис, і payloadBase64
 * робляться з одного рядка. Дві окремі серіалізації колись розійдуться
 * (інший порядок ключів, інші пробіли), і Monobank відхилить підпис.
 */
export function signMonoPayPayload(
  payload: CreateInvoiceInput,
  options: { requestId?: string; privateKeyPem?: string } = {}
): Omit<MonoPayRequest, "keyId"> {
  const json = JSON.stringify(payload)
  const requestId = options.requestId ?? crypto.randomUUID()
  const privateKey = loadPrivateKey(options.privateKeyPem)

  // createSign сам хеширує SHA-256 — окремо хешувати не треба,
  // інакше вийде подвійний хеш і невалідний підпис.
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

/**
 * Приватний ключ ніколи не виходить за межі бекенда.
 * Приймаємо як звичайний PEM, так і PEM у base64 або з екранованими \n —
 * усе це трапляється залежно від того, як ключ поклали в оточення.
 */
export function loadPrivateKey(pem?: string): crypto.KeyObject {
  const raw = pem ?? process.env.MONOPAY_PRIVATE_KEY

  if (!raw) {
    throw new MonobankError(
      "MONOPAY_PRIVATE_KEY is not set. Згенеруйте пару ключів: npx medusa exec ./src/scripts/monopay-keys.ts",
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
      `MONOPAY_PRIVATE_KEY не читається як PEM: ${(e as Error).message}`,
      500
    )
  }

  const curve = key.asymmetricKeyDetails?.namedCurve

  if (key.asymmetricKeyType !== "ec" || curve !== "prime256v1") {
    throw new MonobankError(
      `MonoPay вимагає ECDSA P-256, а ключ — ${key.asymmetricKeyType}/${curve ?? "?"}.`,
      500
    )
  }

  return key
}

/**
 * keyId нашого публічного ключа. Явний MONOPAY_KEY_ID має пріоритет,
 * інакше беремо перший активний зі списку і кешуємо на годину.
 */
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
      "У мерчанта немає жодного публічного ключа MonoPay. Імпортуйте його: npx medusa exec ./src/scripts/monopay-keys.ts",
      500
    )
  }

  keyIdCache = { keyId, fetchedAt: Date.now() }

  return keyId
}

/** Для тестів і після видалення ключа. */
export function resetKeyIdCache(): void {
  keyIdCache = null
}
