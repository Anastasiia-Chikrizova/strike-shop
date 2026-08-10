import { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"

const PROVIDER_ID = "pp_monobank_monobank"

export default async function enableMonobankProvider({
  args,
  container,
}: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const link = container.resolve(ContainerRegistrationKeys.LINK)

  const { data: regions } = await query.graph({
    entity: "region",
    fields: ["id", "name", "currency_code"],
    ...(args[0] ? { filters: { id: args[0] } } : {}),
  })

  if (!regions.length) {
    logger.error("No regions found.")
    return
  }

  for (const region of regions) {
    const { data: existing } = await query.graph({
      entity: "region_payment_provider",
      fields: ["payment_provider_id"],
      filters: { region_id: region.id },
    })

    if (
      existing.some(
        (row: { payment_provider_id: string }) =>
          row.payment_provider_id === PROVIDER_ID
      )
    ) {
      logger.info(`[monobank] ${region.name}: provider already enabled`)
      continue
    }

    await link.create({
      [Modules.REGION]: { region_id: region.id },
      [Modules.PAYMENT]: { payment_provider_id: PROVIDER_ID },
    })

    logger.info(`[monobank] ${region.name}: provider enabled`)
  }
}
