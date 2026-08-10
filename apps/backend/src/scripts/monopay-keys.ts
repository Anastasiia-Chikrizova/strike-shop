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
          "=== PRIVATE KEY — backend .env only, never the frontend ===",
          "",
          "MONOPAY_PRIVATE_KEY=" +
            Buffer.from(privateKey).toString("base64") +
            "  # base64(PEM), so the line breaks survive",
          "",
          "=== PUBLIC KEY (PEM) ===",
          "",
          publicKey.trim(),
          "",
          "Next: put MONOPAY_PRIVATE_KEY into .env and run",
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

      logger.info("[monopay] Public key imported. Key list:")
      await printKeys(logger)
      break
    }

    case "delete": {
      if (!argument) {
        logger.error("Specify a keyId: ... monopay-keys.ts delete pk_test_…")
        return
      }

      await monobank.deleteMonoPayKey(argument)
      logger.info(`[monopay] Key ${argument} deleted.`)
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
      "[monopay] No keys found. Create one: ... monopay-keys.ts generate"
    )
    return
  }

  for (const key of keys) {
    logger.info(
      `[monopay] keyId=${key.keyId ?? key.id} name=${key.keyName ?? "-"} created=${key.dateTime ?? "-"}`
    )
  }
}
