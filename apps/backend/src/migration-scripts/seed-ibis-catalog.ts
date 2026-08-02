import { MedusaContainer } from "@medusajs/framework";
import {
  ContainerRegistrationKeys,
  ProductStatus,
} from "@medusajs/framework/utils";
import {
  createInventoryLevelsWorkflow,
  createProductCategoriesWorkflow,
  createProductOptionsWorkflow,
  createProductsWorkflow,
  deleteProductCategoriesWorkflow,
  deleteProductsWorkflow,
} from "@medusajs/medusa/core-flows";

export default async function seed_ibis_catalog({
  container,
}: {
  container: MedusaContainer;
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);

  logger.info("Removing demo Medusa catalog...");

  const demoHandles = ["t-shirt", "sweatshirt", "sweatpants", "shorts"];
  const { data: demoProducts } = await query.graph({
    entity: "product",
    fields: ["id", "handle"],
    filters: { handle: demoHandles },
  });
  if (demoProducts.length) {
    await deleteProductsWorkflow(container).run({
      input: { ids: demoProducts.map((p) => p.id) },
    });
  }

  const demoCategoryNames = ["Shirts", "Sweatshirts", "Pants", "Merch"];
  const { data: demoCategories } = await query.graph({
    entity: "product_category",
    fields: ["id", "name"],
    filters: { name: demoCategoryNames },
  });
  if (demoCategories.length) {
    await deleteProductCategoriesWorkflow(container).run({
      input: demoCategories.map((c) => c.id),
    });
  }
  logger.info("Finished removing demo Medusa catalog.");

  const { data: salesChannels } = await query.graph({
    entity: "sales_channel",
    fields: ["id"],
  });
  const defaultSalesChannel = salesChannels[0];

  const { data: shippingProfiles } = await query.graph({
    entity: "shipping_profile",
    fields: ["id"],
  });
  const shippingProfile = shippingProfiles[0];

  logger.info("Seeding ІБІС product catalog...");

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

  const newHandles = [
    "howa-1500-hs-precision-308win",
    "savage-110-ultralite-ss-308win",
    "savage-impulse-big-game-308win",
    "optima-invader-auto-pcp-45",
    "umarex-glock-19-45bb",
    "tasmanian-tiger-ifak-pouch-black",
    "front-line-fl30-holster-pm",
    "walkers-razor-carbon",
    "norica-gun-case-133",
    "defcon5-helmet-cover-fast-coyote",
    "mechanix-original-m-olive",
    "pentagon-orpheus-tshirts-m",
    "defcon5-sniper-vest-pants-kit-m",
    "pentagon-hybrid-2-shoes-41",
    "aku-griffon-combat-gtx-7-brown",
  ];

  await createProductsWorkflow(container).run({
    input: {
      products: [
        // Зброя
        {
          title: "Карабін Howa 1500 HS Precision",
          category_ids: [weaponsCategory.id],
          description:
            "Болтова гвинтівка з алюмінієвим шасі HS Precision, ствол 22\", калібр .308 Win. Призначена для точної стрільби на середні дистанції.",
          handle: newHandles[0],
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
          handle: newHandles[1],
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
          handle: newHandles[2],
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
          handle: newHandles[3],
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
          handle: newHandles[4],
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
          handle: newHandles[5],
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
          handle: newHandles[6],
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
          handle: newHandles[7],
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
          handle: newHandles[8],
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
          handle: newHandles[9],
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
          handle: newHandles[10],
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
          handle: newHandles[11],
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
          handle: newHandles[12],
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
          handle: newHandles[13],
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
          handle: newHandles[14],
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
  logger.info("Finished seeding ІБІС product catalog.");

  logger.info("Seeding inventory levels for the new products...");

  const { data: stockLocations } = await query.graph({
    entity: "stock_location",
    fields: ["id"],
  });
  const stockLocation = stockLocations[0];

  const { data: newVariants } = await query.graph({
    entity: "product_variant",
    fields: ["id", "inventory_items.inventory_item_id"],
    filters: { product: { handle: newHandles } },
  });
  const inventoryItemIds = newVariants.flatMap(
    (variant) =>
      variant.inventory_items
        ?.filter((item): item is NonNullable<typeof item> => !!item)
        .map((item) => item.inventory_item_id) ?? []
  );

  await createInventoryLevelsWorkflow(container).run({
    input: {
      inventory_levels: inventoryItemIds.map((inventoryItemId) => ({
        location_id: stockLocation.id,
        stocked_quantity: 1000000,
        inventory_item_id: inventoryItemId,
      })),
    },
  });

  logger.info("Finished seeding inventory levels.");
}
