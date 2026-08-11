import { ProductStatus } from "@medusajs/framework/utils";
import { SeedProduct } from "./types";

export function buildOpticsProducts(params: {
  categoryId: string;
  shippingProfileId: string;
  salesChannelId: string;
  standardOptionId: string;
}): SeedProduct[] {
  const { categoryId, shippingProfileId, salesChannelId, standardOptionId } =
    params;
  return [
        {
          title: "Приціл коліматорний Vortex Crossfire II 2 MOA",
          category_ids: [categoryId],
          description:
            "Коліматорний приціл з кріпленням Weaver для швидкого наведення на короткій та середній дистанції.",
          handle: "vortex-crossfire-ii-2moa",
          weight: 170,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfileId,
          options: [{ id: standardOptionId }],
          variants: [
            {
              title: "Стандарт",
              options: { Варіант: "Стандартний" },
              sku: "IBIS-VORTEX-CROSSFIRE2",
              prices: [{ amount: 10250, currency_code: "uah" }],
            },
          ],
          sales_channels: [{ id: salesChannelId }],
        },
        {
          title: "Приціл коліматорний Holosun HS510C",
          category_ids: [categoryId],
          description:
            "Коліматорний приціл з комбінованою міткою (точка + коло), відкрита конструкція для швидкого захоплення цілі.",
          handle: "holosun-hs510c",
          weight: 210,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfileId,
          options: [{ id: standardOptionId }],
          variants: [
            {
              title: "Стандарт",
              options: { Варіант: "Стандартний" },
              sku: "IBIS-HOLOSUN-HS510C",
              prices: [{ amount: 23170, currency_code: "uah" }],
            },
          ],
          sales_channels: [{ id: salesChannelId }],
        },
        {
          title: "Приціл оптичний Hawke Fast Mount 3-9x40 AO",
          category_ids: [categoryId],
          description:
            "Оптичний приціл зі сіткою Mil Dot та регульованим фокусом, у комплекті кільця для швидкого монтажу.",
          handle: "hawke-fast-mount-3-9x40",
          weight: 480,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfileId,
          options: [{ id: standardOptionId }],
          variants: [
            {
              title: "Стандарт",
              options: { Варіант: "Стандартний" },
              sku: "IBIS-HAWKE-FASTMOUNT-39X40",
              prices: [{ amount: 6050, currency_code: "uah" }],
            },
          ],
          sales_channels: [{ id: salesChannelId }],
        },
        {
          title: "Приціл оптичний Vortex Strike Eagle 1-8x24",
          category_ids: [categoryId],
          description:
            "Універсальний тактичний приціл змінної кратності з підсвічуваною сіткою для стрільби на різних дистанціях.",
          handle: "vortex-strike-eagle-1-8x24",
          weight: 570,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfileId,
          options: [{ id: standardOptionId }],
          variants: [
            {
              title: "Стандарт",
              options: { Варіант: "Стандартний" },
              sku: "IBIS-VORTEX-STRIKEEAGLE-18",
              prices: [{ amount: 32900, currency_code: "uah" }],
            },
          ],
          sales_channels: [{ id: salesChannelId }],
        },
        {
          title: "Магніфер XD Precision Gain 3x26",
          category_ids: [categoryId],
          description:
            "Магніфер трикратного збільшення з відкидним кріпленням, встановлюється позаду коліматорного прицілу.",
          handle: "xd-precision-gain-3x26",
          weight: 260,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfileId,
          options: [{ id: standardOptionId }],
          variants: [
            {
              title: "Стандарт",
              options: { Варіант: "Стандартний" },
              sku: "IBIS-XD-GAIN-3X26",
              prices: [{ amount: 4320, currency_code: "uah" }],
            },
          ],
          sales_channels: [{ id: salesChannelId }],
        },
        {
          title: "Приціл коліматорний XD Precision RS ADJ 2 MOA",
          category_ids: [categoryId],
          description:
            "Компактний коліматорний приціл з регульованою яскравістю мітки, кріплення Weaver/Picatinny.",
          handle: "xd-precision-rs-adj-2moa",
          weight: 150,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfileId,
          options: [{ id: standardOptionId }],
          variants: [
            {
              title: "Стандарт",
              options: { Варіант: "Стандартний" },
              sku: "IBIS-XD-RSADJ-2MOA",
              prices: [{ amount: 4610, currency_code: "uah" }],
            },
          ],
          sales_channels: [{ id: salesChannelId }],
        },
        {
          title: "Приціл коліматорний Hawke Micro Reflex Sight 3 MOA",
          category_ids: [categoryId],
          description:
            "Мініатюрний рефлекторний приціл для пістолетів та карабінів, кріплення Weaver.",
          handle: "hawke-micro-reflex-3moa",
          weight: 90,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfileId,
          options: [{ id: standardOptionId }],
          variants: [
            {
              title: "Стандарт",
              options: { Варіант: "Стандартний" },
              sku: "IBIS-HAWKE-MICROREFLEX",
              prices: [{ amount: 9990, currency_code: "uah" }],
            },
          ],
          sales_channels: [{ id: salesChannelId }],
        },
        {
          title: "Приціл оптичний Vortex Venom 5-25x56 FFP",
          category_ids: [categoryId],
          description:
            "Далекобійний приціл з першою фокальною площиною сітки для точних поправок на будь-якій кратності.",
          handle: "vortex-venom-5-25x56-ffp",
          weight: 750,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfileId,
          options: [{ id: standardOptionId }],
          variants: [
            {
              title: "Стандарт",
              options: { Варіант: "Стандартний" },
              sku: "IBIS-VORTEX-VENOM-525X56",
              prices: [{ amount: 33890, currency_code: "uah" }],
            },
          ],
          sales_channels: [{ id: salesChannelId }],
        },
        {
          title: "Монокуляр XD Precision Advanced 10x50 WP",
          category_ids: [categoryId],
          description:
            "Вологозахищений монокуляр зі сіткою для оцінки дистанції, зручний для спостереження в польових умовах.",
          handle: "xd-precision-advanced-10x50",
          weight: 340,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfileId,
          options: [{ id: standardOptionId }],
          variants: [
            {
              title: "Стандарт",
              options: { Варіант: "Стандартний" },
              sku: "IBIS-XD-ADVANCED-10X50",
              prices: [{ amount: 5220, currency_code: "uah" }],
            },
          ],
          sales_channels: [{ id: salesChannelId }],
        },
        {
          title: "Приціл оптичний Hawke Vantage 4-12x50",
          category_ids: [categoryId],
          description:
            "Мисливський приціл змінної кратності з підсвічуваною сіткою для стрільби у сутінках.",
          handle: "hawke-vantage-4-12x50",
          weight: 560,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfileId,
          options: [{ id: standardOptionId }],
          variants: [
            {
              title: "Стандарт",
              options: { Варіант: "Стандартний" },
              sku: "IBIS-HAWKE-VANTAGE-412X50",
              prices: [{ amount: 11120, currency_code: "uah" }],
            },
          ],
          sales_channels: [{ id: salesChannelId }],
        },
        {
          title: "Монокуляр цифровий нічного бачення XD Precision Cyclops 1-6x",
          category_ids: [categoryId],
          description:
            "Цифровий монокуляр нічного бачення зі змінним збільшенням для спостереження в темний час доби.",
          handle: "xd-precision-cyclops-1-6x",
          weight: 390,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfileId,
          options: [{ id: standardOptionId }],
          variants: [
            {
              title: "Стандарт",
              options: { Варіант: "Стандартний" },
              sku: "IBIS-XD-CYCLOPS-16X",
              prices: [{ amount: 18800, currency_code: "uah" }],
            },
          ],
          sales_channels: [{ id: salesChannelId }],
        },
  ];
}
