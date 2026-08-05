import { MedusaContainer } from "@medusajs/framework";
import {
  ContainerRegistrationKeys,
  ModuleRegistrationName,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils";
import {
  createApiKeysWorkflow,
  createCollectionsWorkflow,
  createInventoryLevelsWorkflow,
  createProductCategoriesWorkflow,
  createProductOptionsWorkflow,
  createProductsWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  createShippingOptionsWorkflow,
  createShippingProfilesWorkflow,
  createStockLocationsWorkflow,
  createStoresWorkflow,
  createTaxRegionsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
} from "@medusajs/medusa/core-flows";

export default async function initial_data_seed({
  container,
}: {
  container: MedusaContainer;
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const link = container.resolve(ContainerRegistrationKeys.LINK);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const fulfillmentModuleService = container.resolve(
    ModuleRegistrationName.FULFILLMENT
  );

  const countries = ["ua"];

  logger.info("Seeding store data...");
  const {
    result: [defaultSalesChannel],
  } = await createSalesChannelsWorkflow(container).run({
    input: {
      salesChannelsData: [
        {
          name: "Default Sales Channel",
          description: "Created by Strike Shop",
        },
      ],
    },
  });

  const {
    result: [publishableApiKey],
  } = await createApiKeysWorkflow(container).run({
    input: {
      api_keys: [
        {
          title: "Default Publishable API Key",
          type: "publishable",
          created_by: "",
        },
      ],
    },
  });

  await linkSalesChannelsToApiKeyWorkflow(container).run({
    input: {
      id: publishableApiKey.id,
      add: [defaultSalesChannel.id],
    },
  });

  const {
    result: [store],
  } = await createStoresWorkflow(container).run({
    input: {
      stores: [
        {
          name: "Default Store",
          supported_currencies: [
            {
              currency_code: "uah",
              is_default: true,
            },
          ],
          default_sales_channel_id: defaultSalesChannel.id,
        },
      ],
    },
  });

  logger.info("Seeding region data...");
  const { result: regionResult } = await createRegionsWorkflow(container).run({
    input: {
      regions: [
        {
          name: "Ukraine",
          currency_code: "uah",
          countries,
          payment_providers: ["pp_system_default"],
        },
      ],
    },
  });
  const region = regionResult[0];
  logger.info("Finished seeding regions.");

  logger.info("Seeding tax regions...");
  await createTaxRegionsWorkflow(container).run({
    input: countries.map((country_code) => ({
      country_code,
      provider_id: "tp_system",
    })),
  });
  logger.info("Finished seeding tax regions.");

  logger.info("Seeding stock location data...");
  const { result: stockLocationResult } = await createStockLocationsWorkflow(
    container
  ).run({
    input: {
      locations: [
        {
          name: "Ukrainian Warehouse",
          address: {
            city: "Kyiv",
            country_code: "UA",
            address_1: "",
          },
        },
      ],
    },
  });
  const stockLocation = stockLocationResult[0];

  await link.create({
    [Modules.STOCK_LOCATION]: {
      stock_location_id: stockLocation.id,
    },
    [Modules.FULFILLMENT]: {
      fulfillment_provider_id: "manual_manual",
    },
  });

  logger.info("Seeding fulfillment data...");
  const { data: shippingProfileResult } = await query.graph({
    entity: "shipping_profile",
    fields: ["id"],
  });
  const shippingProfile = shippingProfileResult[0];

  const fulfillmentSet = await fulfillmentModuleService.createFulfillmentSets({
    name: "Ukrainian Warehouse delivery",
    type: "shipping",
    service_zones: [
      {
        name: "Ukraine",
        geo_zones: [
          {
            country_code: "ua",
            type: "country",
          },
        ],
      },
    ],
  });

  await link.create({
    [Modules.STOCK_LOCATION]: {
      stock_location_id: stockLocation.id,
    },
    [Modules.FULFILLMENT]: {
      fulfillment_set_id: fulfillmentSet.id,
    },
  });

  await createShippingOptionsWorkflow(container).run({
    input: [
      {
        name: "Standard Shipping",
        price_type: "flat",
        provider_id: "manual_manual",
        service_zone_id: fulfillmentSet.service_zones[0].id,
        shipping_profile_id: shippingProfile.id,
        type: {
          label: "Standard",
          description: "Ship in 2-3 days.",
          code: "standard",
        },
        prices: [
          {
            currency_code: "uah",
            amount: 10,
          },
          {
            region_id: region.id,
            amount: 10,
          },
        ],
        rules: [
          {
            attribute: "enabled_in_store",
            value: "true",
            operator: "eq",
          },
          {
            attribute: "is_return",
            value: "false",
            operator: "eq",
          },
        ],
      },
      {
        name: "Express Shipping",
        price_type: "flat",
        provider_id: "manual_manual",
        service_zone_id: fulfillmentSet.service_zones[0].id,
        shipping_profile_id: shippingProfile.id,
        type: {
          label: "Express",
          description: "Ship in 24 hours.",
          code: "express",
        },
        prices: [
          {
            currency_code: "uah",
            amount: 10,
          },
          {
            region_id: region.id,
            amount: 10,
          },
        ],
        rules: [
          {
            attribute: "enabled_in_store",
            value: "true",
            operator: "eq",
          },
          {
            attribute: "is_return",
            value: "false",
            operator: "eq",
          },
        ],
      },
    ],
  });
  logger.info("Finished seeding fulfillment data.");

  await linkSalesChannelsToStockLocationWorkflow(container).run({
    input: {
      id: stockLocation.id,
      add: [defaultSalesChannel.id],
    },
  });
  logger.info("Finished seeding stock location data.");

  logger.info("Seeding product data...");

  const { result: categoryResult } = await createProductCategoriesWorkflow(
    container
  ).run({
    input: {
      product_categories: [
        {
          name: "Зброя",
          is_active: true,
        },
        {
          name: "Спорядження",
          is_active: true,
        },
        {
          name: "Одяг та взуття",
          is_active: true,
        },
      ],
    },
  });

  const weaponsCategory = categoryResult.find((cat) => cat.name === "Зброя")!;
  const gearCategory = categoryResult.find(
    (cat) => cat.name === "Спорядження"
  )!;
  const apparelCategory = categoryResult.find(
    (cat) => cat.name === "Одяг та взуття"
  )!;

  const { result: productOptionsResult } = await createProductOptionsWorkflow(
    container
  ).run({
    input: {
      product_options: [
        {
          title: "Калібр",
          values: [".308 Win", "4,5 мм"],
        },
        {
          title: "Розмір",
          values: ["M", "41", "7"],
        },
        {
          title: "Колір",
          values: [
            "Чорний",
            "Койот",
            "Olive Drab",
            "Білий",
            "Синій",
            "Камуфляж",
            "Сірий",
            "Brown",
          ],
        },
      ],
    },
  });
  const caliberOption = productOptionsResult.find(
    (o) => o.title === "Калібр"
  )!;
  const sizeOption = productOptionsResult.find((o) => o.title === "Розмір")!;
  const colorOption = productOptionsResult.find((o) => o.title === "Колір")!;

  await createProductsWorkflow(container).run({
    input: {
      products: [
        // Зброя
        {
          title: "Карабін Howa 1500 HS Precision",
          category_ids: [weaponsCategory.id],
          description:
            "Болтова гвинтівка з алюмінієвим шасі HS Precision, ствол 22\", калібр .308 Win. Призначена для точної стрільби на середні дистанції.",
          handle: "howa-1500-hs-precision-308win",
          weight: 3800,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          options: [{ id: caliberOption.id }],
          variants: [
            {
              title: ".308 Win",
              sku: "IBIS-HOWA1500-308",
              options: { Калібр: ".308 Win" },
              prices: [{ amount: 62930, currency_code: "uah" }],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel.id }],
        },
        {
          title: "Карабін Savage 110 Ultralite SS",
          category_ids: [weaponsCategory.id],
          description:
            'Полегшена болтова гвинтівка з карбоновим стволом та титановою ствольною коробкою, ствол 22", різьба 5/8"-24.',
          handle: "savage-110-ultralite-ss-308win",
          weight: 2900,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          options: [{ id: caliberOption.id }],
          variants: [
            {
              title: ".308 Win",
              sku: "IBIS-SAV110-308",
              options: { Калібр: ".308 Win" },
              prices: [{ amount: 70500, currency_code: "uah" }],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel.id }],
        },
        {
          title: "Карабін Savage Impulse Big Game",
          category_ids: [weaponsCategory.id],
          description:
            'Гвинтівка з прямим ходом затвора (straight-pull) для швидкої повторної стрільби, ствол 22", різьба 5/8"-24.',
          handle: "savage-impulse-big-game-308win",
          weight: 3400,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          options: [{ id: caliberOption.id }],
          variants: [
            {
              title: ".308 Win",
              sku: "IBIS-SAVIMP-308",
              options: { Калібр: ".308 Win" },
              prices: [{ amount: 64860, currency_code: "uah" }],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel.id }],
        },
        {
          title: "Гвинтівка пневматична Optima Invader Auto PCP",
          category_ids: [weaponsCategory.id],
          description:
            "Напівавтоматична PCP-гвинтівка калібру 4,5 мм з попереднім накачуванням повітря.",
          handle: "optima-invader-auto-pcp-45",
          weight: 3100,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          options: [{ id: caliberOption.id }],
          variants: [
            {
              title: "4,5 мм",
              sku: "IBIS-OPTINV-45",
              options: { Калібр: "4,5 мм" },
              prices: [{ amount: 19180, currency_code: "uah" }],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel.id }],
        },
        {
          title: "Пістолет пневматичний Umarex Glock 19",
          category_ids: [weaponsCategory.id],
          description:
            "Пневматичний пістолет-репліка Glock 19 калібру 4,5 мм ВВ із системою Blowback.",
          handle: "umarex-glock-19-45bb",
          weight: 650,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          options: [{ id: caliberOption.id }],
          variants: [
            {
              title: "4,5 мм",
              sku: "IBIS-UMGLOCK19-45",
              options: { Калібр: "4,5 мм" },
              prices: [{ amount: 6530, currency_code: "uah" }],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel.id }],
        },
        // Спорядження
        {
          title: "Підсумок Tasmanian Tiger IFAK Pouch",
          category_ids: [gearCategory.id],
          description:
            "Медичний підсумок для розміщення аптечки першої допомоги (IFAK) з системою кріплення MOLLE.",
          handle: "tasmanian-tiger-ifak-pouch-black",
          weight: 200,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          options: [{ id: colorOption.id }],
          variants: [
            {
              title: "Чорний",
              sku: "IBIS-TT-IFAK-BLK",
              options: { Колір: "Чорний" },
              prices: [{ amount: 1350, currency_code: "uah" }],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel.id }],
        },
        {
          title: "Кобура Front Line FL30 поясна",
          category_ids: [gearCategory.id],
          description:
            "Поясна кобура для пістолета ПМ з фіксацією та зручним оперативним доступом.",
          handle: "front-line-fl30-holster-pm",
          weight: 150,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          options: [{ id: colorOption.id }],
          variants: [
            {
              title: "Чорний",
              sku: "IBIS-FL30-BLK",
              options: { Колір: "Чорний" },
              prices: [{ amount: 324, currency_code: "uah" }],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel.id }],
        },
        {
          title: "Навушники Walker's Razor Carbon активні",
          category_ids: [gearCategory.id],
          description:
            "Активні навушники для захисту слуху з підсиленням навколишніх звуків та карбоновим корпусом.",
          handle: "walkers-razor-carbon",
          weight: 300,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          options: [{ id: colorOption.id }],
          variants: [
            {
              title: "Чорний",
              sku: "IBIS-WALKRAZOR",
              options: { Колір: "Чорний" },
              prices: [{ amount: 4840, currency_code: "uah" }],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel.id }],
        },
        {
          title: "Чохол для зброї Norica 133 см",
          category_ids: [gearCategory.id],
          description:
            "Транспортувальний чохол для зброї довжиною 133 см з м'якою прокладкою.",
          handle: "norica-gun-case-133",
          weight: 900,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          options: [{ id: colorOption.id }],
          variants: [
            {
              title: "Чорний",
              sku: "IBIS-NORICA-133",
              options: { Колір: "Чорний" },
              prices: [{ amount: 1430, currency_code: "uah" }],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel.id }],
        },
        {
          title: "Кавер Defcon 5 Helmet Cover mod.Fast",
          category_ids: [gearCategory.id],
          description:
            "Кавер на шолом стандарту FAST з кріпленнями для додаткових аксесуарів.",
          handle: "defcon5-helmet-cover-fast-coyote",
          weight: 120,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          options: [{ id: colorOption.id }],
          variants: [
            {
              title: "Койот",
              sku: "IBIS-DEFCON5-HC-COY",
              options: { Колір: "Койот" },
              prices: [{ amount: 370, currency_code: "uah" }],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel.id }],
        },
        // Одяг та взуття
        {
          title: "Рукавички Mechanix Original",
          category_ids: [apparelCategory.id],
          description:
            "Тактичні рукавички з еластичними вставками та посиленою долонею для щоденного використання.",
          handle: "mechanix-original-m-olive",
          weight: 150,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          options: [{ id: sizeOption.id }, { id: colorOption.id }],
          variants: [
            {
              title: "M / Olive Drab",
              sku: "IBIS-MECH-ORIG-M-OD",
              options: { Розмір: "M", Колір: "Olive Drab" },
              prices: [{ amount: 1170, currency_code: "uah" }],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel.id }],
        },
        {
          title: "Набір футболок Pentagon Orpheus",
          category_ids: [apparelCategory.id],
          description:
            "Комплект бавовняних футболок повсякденного крою, розмір M.",
          handle: "pentagon-orpheus-tshirts-m",
          weight: 450,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          options: [{ id: sizeOption.id }, { id: colorOption.id }],
          variants: [
            {
              title: "M / Чорний",
              sku: "IBIS-PENT-ORPH-M-BLK",
              options: { Розмір: "M", Колір: "Чорний" },
              prices: [{ amount: 1290, currency_code: "uah" }],
            },
            {
              title: "M / Білий",
              sku: "IBIS-PENT-ORPH-M-WHT",
              options: { Розмір: "M", Колір: "Білий" },
              prices: [{ amount: 1290, currency_code: "uah" }],
            },
            {
              title: "M / Синій",
              sku: "IBIS-PENT-ORPH-M-BLU",
              options: { Розмір: "M", Колір: "Синій" },
              prices: [{ amount: 1290, currency_code: "uah" }],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel.id }],
        },
        {
          title: "Костюм Defcon 5 Sniper Vest+Pants Kit",
          category_ids: [apparelCategory.id],
          description:
            "Камуфльований костюм для маскування: жилет і штани, розмір M.",
          handle: "defcon5-sniper-vest-pants-kit-m",
          weight: 1200,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          options: [{ id: sizeOption.id }, { id: colorOption.id }],
          variants: [
            {
              title: "M / Камуфляж",
              sku: "IBIS-DEFCON5-SNIPER-M",
              options: { Розмір: "M", Колір: "Камуфляж" },
              prices: [{ amount: 19320, currency_code: "uah" }],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel.id }],
        },
        {
          title: "Кросівки Pentagon Hybrid 2.0",
          category_ids: [apparelCategory.id],
          description:
            "Тактичні кросівки з дихаючим верхом та зносостійкою підошвою, розмір 41.",
          handle: "pentagon-hybrid-2-shoes-41",
          weight: 800,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          options: [{ id: sizeOption.id }, { id: colorOption.id }],
          variants: [
            {
              title: "41 / Сірий",
              sku: "IBIS-PENT-HYBRID2-41",
              options: { Розмір: "41", Колір: "Сірий" },
              prices: [{ amount: 3630, currency_code: "uah" }],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel.id }],
        },
        {
          title: "Черевики AKU Griffon Combat GTX",
          category_ids: [apparelCategory.id],
          description:
            "Бойові черевики з мембраною GORE-TEX для захисту від вологи, розмір 7 (US).",
          handle: "aku-griffon-combat-gtx-7-brown",
          weight: 1100,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          options: [{ id: sizeOption.id }, { id: colorOption.id }],
          variants: [
            {
              title: "7 / Brown",
              sku: "IBIS-AKU-GRIFFON-7-BRN",
              options: { Розмір: "7", Колір: "Brown" },
              prices: [{ amount: 8640, currency_code: "uah" }],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel.id }],
        },
      ],
    },
  });
  logger.info("Finished seeding product data.");

  logger.info("Seeding inventory levels.");

  const { data: inventoryItems } = await query.graph({
    entity: "inventory_item",
    fields: ["id"],
  });

  await createInventoryLevelsWorkflow(container).run({
    input: {
      inventory_levels: inventoryItems.map((item) => ({
        location_id: stockLocation.id,
        stocked_quantity: 1000000,
        inventory_item_id: item.id,
      })),
    },
  });

  logger.info("Finished seeding inventory levels data.");
}
