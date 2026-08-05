import crypto from "crypto"

import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { monobank } from "../lib/monobank/client"
import { loadPrivateKey } from "../lib/monobank/monopay"

export default async function monopayKeys({ args, container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const [command = "list", argument] = args

  switch (command) {
    case "generate": {
      const { privateKey, publicKey } = crypto.generateKeyPairSync("ec", {
        namedCurve: "prime256v1",
        privateKeyEncoding: { type: "pkcs8", format: "pem" },
        publicKeyEncoding: { type: "spki", format: "pem" },
      })

      logger.info(
        [
          "",
          "=== ПРИВАТНИЙ КЛЮЧ — тільки в .env бекенда, ніколи на фронтенд ===",
          "",
          "MONOPAY_PRIVATE_KEY=" +
            Buffer.from(privateKey).toString("base64") +
            "  # base64(PEM), щоб не ламати переноси рядків",
          "",
          "=== ПУБЛІЧНИЙ КЛЮЧ (PEM) ===",
          "",
          publicKey.trim(),
          "",
          "Далі: покладіть MONOPAY_PRIVATE_KEY у .env і виконайте",
          "npx medusa exec ./src/scripts/monopay-keys.ts import",
          "",
        ].join("\n")
      )
      break
    }

    case "import": {
      const publicKeyPem = crypto
        .createPublicKey(loadPrivateKey())
        .export({ type: "spki", format: "pem" })
        .toString()

      await monobank.importMonoPayKey({
        keyValue: Buffer.from(publicKeyPem).toString("base64"),
        keyName: argument ?? "medusa-storefront",
      })

      logger.info("[monopay] Публічний ключ імпортовано. Список ключів:")
      await printKeys(logger)
      break
    }

    case "delete": {
      if (!argument) {
        logger.error("Вкажіть keyId: ... monopay-keys.ts delete pk_test_…")
        return
      }

      await monobank.deleteMonoPayKey(argument)
      logger.info(`[monopay] Ключ ${argument} видалено.`)
      break
    }

    default:
      await printKeys(logger)
  }
}

async function printKeys(logger: { info: (message: string) => void }) {
  const keys = await monobank.listMonoPayKeys()

  if (!keys.length) {
    logger.info(
      "[monopay] Ключів немає. Створіть: ... monopay-keys.ts generate"
    )
    return
  }

  for (const key of keys) {
    logger.info(
      `[monopay] keyId=${key.keyId ?? key.id} name=${key.keyName ?? "-"} created=${key.dateTime ?? "-"}`
    )
  }
}
