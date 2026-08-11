import { ProductStatus } from "@medusajs/framework/utils";
import { SeedProduct } from "./types";

export function buildGearProducts(params: {
  categoryId: string;
  shippingProfileId: string;
  salesChannelId: string;
  colorOptionId: string;
  standardOptionId: string;
}): SeedProduct[] {
  const {
    categoryId,
    shippingProfileId,
    salesChannelId,
    colorOptionId,
    standardOptionId,
  } = params;
  return [
        {
          title: "Підсумок Tasmanian Tiger IFAK Pouch",
          category_ids: [categoryId],
          description:
            "Медичний підсумок для розміщення аптечки першої допомоги (IFAK) з системою кріплення MOLLE.",
          handle: "tasmanian-tiger-ifak-pouch-black",
          weight: 200,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfileId,
          options: [{ id: colorOptionId }],
          variants: [
            {
              title: "Чорний",
              sku: "IBIS-TT-IFAK-BLK",
              options: { Колір: "Чорний" },
              prices: [{ amount: 1350, currency_code: "uah" }],
            },
          ],
          sales_channels: [{ id: salesChannelId }],
        },
        {
          title: "Кобура Front Line FL30 поясна",
          category_ids: [categoryId],
          description:
            "Поясна кобура для пістолета ПМ з фіксацією та зручним оперативним доступом.",
          handle: "front-line-fl30-holster-pm",
          weight: 150,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfileId,
          options: [{ id: colorOptionId }],
          variants: [
            {
              title: "Чорний",
              sku: "IBIS-FL30-BLK",
              options: { Колір: "Чорний" },
              prices: [{ amount: 324, currency_code: "uah" }],
            },
          ],
          sales_channels: [{ id: salesChannelId }],
        },
        {
          title: "Навушники Walker's Razor Carbon активні",
          category_ids: [categoryId],
          description:
            "Активні навушники для захисту слуху з підсиленням навколишніх звуків та карбоновим корпусом.",
          handle: "walkers-razor-carbon",
          weight: 300,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfileId,
          options: [{ id: colorOptionId }],
          variants: [
            {
              title: "Чорний",
              sku: "IBIS-WALKRAZOR",
              options: { Колір: "Чорний" },
              prices: [{ amount: 4840, currency_code: "uah" }],
            },
          ],
          sales_channels: [{ id: salesChannelId }],
        },
        {
          title: "Чохол для зброї Norica 133 см",
          category_ids: [categoryId],
          description:
            "Транспортувальний чохол для зброї довжиною 133 см з м'якою прокладкою.",
          handle: "norica-gun-case-133",
          weight: 900,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfileId,
          options: [{ id: colorOptionId }],
          variants: [
            {
              title: "Чорний",
              sku: "IBIS-NORICA-133",
              options: { Колір: "Чорний" },
              prices: [{ amount: 1430, currency_code: "uah" }],
            },
          ],
          sales_channels: [{ id: salesChannelId }],
        },
        {
          title: "Кавер Defcon 5 Helmet Cover mod.Fast",
          category_ids: [categoryId],
          description:
            "Кавер на шолом стандарту FAST з кріпленнями для додаткових аксесуарів.",
          handle: "defcon5-helmet-cover-fast-coyote",
          weight: 120,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfileId,
          options: [{ id: colorOptionId }],
          variants: [
            {
              title: "Койот",
              sku: "IBIS-DEFCON5-HC-COY",
              options: { Колір: "Койот" },
              prices: [{ amount: 370, currency_code: "uah" }],
            },
          ],
          sales_channels: [{ id: salesChannelId }],
        },
        {
          title: "Поясна сумка Defcon 5 Outac Marsupium",
          category_ids: [categoryId],
          description:
            "Компактна поясна сумка для кріплення на тактичний жилет, з відділеннями для дрібного спорядження.",
          handle: "defcon5-outac-marsupium-coyote",
          weight: 180,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfileId,
          options: [{ id: colorOptionId }],
          variants: [
            {
              title: "Койот",
              sku: "IBIS-DEFCON5-MARSUP-COY",
              options: { Колір: "Койот" },
              prices: [{ amount: 1650, currency_code: "uah" }],
            },
          ],
          sales_channels: [{ id: salesChannelId }],
        },
        {
          title: "Намет Tramp Light Fly 2",
          category_ids: [categoryId],
          description:
            "Двомісний туристичний намет з лёгким каркасом, підходить для одноденних та багатоденних походів.",
          handle: "tramp-light-fly-2",
          weight: 2100,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfileId,
          options: [{ id: standardOptionId }],
          variants: [
            {
              title: "Стандарт",
              options: { Варіант: "Стандартний" },
              sku: "IBIS-TRAMP-LIGHTFLY2",
              prices: [{ amount: 2880, currency_code: "uah" }],
            },
          ],
          sales_channels: [{ id: salesChannelId }],
        },
        {
          title: "Каремат надувний Skif Outdoor Scout",
          category_ids: [categoryId],
          description:
            "Надувний каремат для нічлігу в польових умовах, компактно складається в транспортувальний чохол.",
          handle: "skif-outdoor-scout-mat",
          weight: 750,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfileId,
          options: [{ id: colorOptionId }],
          variants: [
            {
              title: "Olive Drab",
              sku: "IBIS-SKIF-SCOUT-MAT-OD",
              options: { Колір: "Olive Drab" },
              prices: [{ amount: 1340, currency_code: "uah" }],
            },
          ],
          sales_channels: [{ id: salesChannelId }],
        },
        {
          title: "Пристрій від комарів Thermacell MR-350",
          category_ids: [categoryId],
          description:
            "Портативний пристрій для захисту від комарів у радіусі кількох метрів, працює на змінних картриджах.",
          handle: "thermacell-mr-350",
          weight: 150,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfileId,
          options: [{ id: standardOptionId }],
          variants: [
            {
              title: "Стандарт",
              options: { Варіант: "Стандартний" },
              sku: "IBIS-THERMACELL-MR350",
              prices: [{ amount: 1670, currency_code: "uah" }],
            },
          ],
          sales_channels: [{ id: salesChannelId }],
        },
        {
          title: "Стіл розкладний Skif Outdoor Compact II",
          category_ids: [categoryId],
          description:
            "Компактний розкладний стіл для табору, легко складається та вміщується у транспортувальний чохол.",
          handle: "skif-outdoor-compact-table",
          weight: 2300,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfileId,
          options: [{ id: standardOptionId }],
          variants: [
            {
              title: "Стандарт",
              options: { Варіант: "Стандартний" },
              sku: "IBIS-SKIF-COMPACT-TABLE",
              prices: [{ amount: 1010, currency_code: "uah" }],
            },
          ],
          sales_channels: [{ id: salesChannelId }],
        },
        {
          title: "Паракорд тактичний C&M Survival",
          category_ids: [categoryId],
          description:
            "Міцний плетений шнур для спорядження та ремонту в польових умовах, 10 метрів у мотку.",
          handle: "cm-tactical-survival-paracord",
          weight: 60,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfileId,
          options: [{ id: colorOptionId }],
          variants: [
            {
              title: "Чорний",
              sku: "IBIS-CM-PARACORD-BLK",
              options: { Колір: "Чорний" },
              prices: [{ amount: 186, currency_code: "uah" }],
            },
          ],
          sales_channels: [{ id: salesChannelId }],
        },
  ];
}
