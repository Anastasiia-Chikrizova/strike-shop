import { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import {
  createApiKeysWorkflow,
  createSalesChannelsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
} from "@medusajs/medusa/core-flows";
import { writeFileSync } from "fs";

export default async function ensurePublishableKey({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const outputFile = process.env.PUBLISHABLE_KEY_FILE;

  const { data: existingKeys } = await query.graph({
    entity: "api_key",
    fields: ["token"],
    filters: { type: "publishable" },
  });

  let token = existingKeys[0]?.token;

  if (!token) {
    const { data: salesChannels } = await query.graph({
      entity: "sales_channel",
      fields: ["id"],
    });

    let salesChannelId = salesChannels[0]?.id;
    if (!salesChannelId) {
      const {
        result: [salesChannel],
      } = await createSalesChannelsWorkflow(container).run({
        input: { salesChannelsData: [{ name: "Default Sales Channel" }] },
      });
      salesChannelId = salesChannel.id;
    }

    const {
      result: [apiKey],
    } = await createApiKeysWorkflow(container).run({
      input: {
        api_keys: [
          { title: "Local Dev Key", type: "publishable", created_by: "" },
        ],
      },
    });

    await linkSalesChannelsToApiKeyWorkflow(container).run({
      input: { id: apiKey.id, add: [salesChannelId] },
    });

    token = apiKey.token;
    logger.info(`Created publishable key: ${token}`);
  } else {
    logger.info(`Publishable key already exists: ${token}`);
  }

  if (outputFile) {
    writeFileSync(outputFile, token);
  }
}
