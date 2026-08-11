import { ProductStatus } from "@medusajs/framework/utils";
import { SeedProduct } from "./types";

export function buildWeaponsProducts(params: {
  categoryId: string;
  shippingProfileId: string;
  salesChannelId: string;
  caliberOptionId: string;
}): SeedProduct[] {
  const { categoryId, shippingProfileId, salesChannelId, caliberOptionId } =
    params;
  return [
        {
          title: "Карабін Howa 1500 HS Precision",
          category_ids: [categoryId],
          description:
            "Болтова гвинтівка з алюмінієвим шасі HS Precision, ствол 22\", калібр .308 Win. Призначена для точної стрільби на середні дистанції.",
          handle: "howa-1500-hs-precision-308win",
          weight: 3800,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfileId,
          options: [{ id: caliberOptionId }],
          variants: [
            {
              title: ".308 Win",
              sku: "IBIS-HOWA1500-308",
              options: { Калібр: ".308 Win" },
              prices: [{ amount: 62930, currency_code: "uah" }],
            },
          ],
          sales_channels: [{ id: salesChannelId }],
        },
        {
          title: "Карабін Savage 110 Ultralite SS",
          category_ids: [categoryId],
          description:
            'Полегшена болтова гвинтівка з карбоновим стволом та титановою ствольною коробкою, ствол 22", різьба 5/8"-24.',
          handle: "savage-110-ultralite-ss-308win",
          weight: 2900,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfileId,
          options: [{ id: caliberOptionId }],
          variants: [
            {
              title: ".308 Win",
              sku: "IBIS-SAV110-308",
              options: { Калібр: ".308 Win" },
              prices: [{ amount: 70500, currency_code: "uah" }],
            },
          ],
          sales_channels: [{ id: salesChannelId }],
        },
        {
          title: "Карабін Savage Impulse Big Game",
          category_ids: [categoryId],
          description:
            'Гвинтівка з прямим ходом затвора (straight-pull) для швидкої повторної стрільби, ствол 22", різьба 5/8"-24.',
          handle: "savage-impulse-big-game-308win",
          weight: 3400,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfileId,
          options: [{ id: caliberOptionId }],
          variants: [
            {
              title: ".308 Win",
              sku: "IBIS-SAVIMP-308",
              options: { Калібр: ".308 Win" },
              prices: [{ amount: 64860, currency_code: "uah" }],
            },
          ],
          sales_channels: [{ id: salesChannelId }],
        },
        {
          title: "Гвинтівка пневматична Optima Invader Auto PCP",
          category_ids: [categoryId],
          description:
            "Напівавтоматична PCP-гвинтівка калібру 4,5 мм з попереднім накачуванням повітря.",
          handle: "optima-invader-auto-pcp-45",
          weight: 3100,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfileId,
          options: [{ id: caliberOptionId }],
          variants: [
            {
              title: "4,5 мм",
              sku: "IBIS-OPTINV-45",
              options: { Калібр: "4,5 мм" },
              prices: [{ amount: 19180, currency_code: "uah" }],
            },
          ],
          sales_channels: [{ id: salesChannelId }],
        },
        {
          title: "Пістолет пневматичний Umarex Glock 19",
          category_ids: [categoryId],
          description:
            "Пневматичний пістолет-репліка Glock 19 калібру 4,5 мм ВВ із системою Blowback.",
          handle: "umarex-glock-19-45bb",
          weight: 650,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfileId,
          options: [{ id: caliberOptionId }],
          variants: [
            {
              title: "4,5 мм",
              sku: "IBIS-UMGLOCK19-45",
              options: { Калібр: "4,5 мм" },
              prices: [{ amount: 6530, currency_code: "uah" }],
            },
          ],
          sales_channels: [{ id: salesChannelId }],
        },
        {
          title: "Гвинтівка малокаліберна Tikka T1x MTR",
          category_ids: [categoryId],
          description:
            "Спортивно-мисливська гвинтівка під набій кільцевого запалювання з важким стволом для точної стрільби на короткі та середні дистанції.",
          handle: "tikka-t1x-mtr-22lr",
          weight: 3100,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfileId,
          options: [{ id: caliberOptionId }],
          variants: [
            {
              title: ".22 LR",
              sku: "IBIS-TIKKA-T1X-22",
              options: { Калібр: ".22 LR" },
              prices: [{ amount: 47030, currency_code: "uah" }],
            },
          ],
          sales_channels: [{ id: salesChannelId }],
        },
        {
          title: "Рушниця Hatsan Escort Aimguard",
          category_ids: [categoryId],
          description:
            "Помпова мисливська рушниця з надійною механікою подачі патронів, підходить для полювання на пернату дичину.",
          handle: "hatsan-escort-aimguard-1276",
          weight: 3200,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfileId,
          options: [{ id: caliberOptionId }],
          variants: [
            {
              title: "12/76",
              sku: "IBIS-HATSAN-AIMGUARD",
              options: { Калібр: "12/76" },
              prices: [{ amount: 12690, currency_code: "uah" }],
            },
          ],
          sales_channels: [{ id: salesChannelId }],
        },
        {
          title: "Карабін Diamondback DB15",
          category_ids: [categoryId],
          description:
            "Напівавтоматичний карабін платформи AR-15 зі стволом 16 дюймів, збалансований для тактичного застосування.",
          handle: "diamondback-db15-16-223rem",
          weight: 3000,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfileId,
          options: [{ id: caliberOptionId }],
          variants: [
            {
              title: ".223 Rem",
              sku: "IBIS-DB15-223",
              options: { Калібр: ".223 Rem" },
              prices: [{ amount: 56490, currency_code: "uah" }],
            },
          ],
          sales_channels: [{ id: salesChannelId }],
        },
        {
          title: "Пістолет спортивний Glock 19 Gen5 MOS",
          category_ids: [categoryId],
          description:
            "Компактний спортивний пістолет п'ятого покоління з можливістю встановлення коліматорного прицілу.",
          handle: "glock-19-gen5-mos-9mm",
          weight: 670,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfileId,
          options: [{ id: caliberOptionId }],
          variants: [
            {
              title: "9 мм (9х19)",
              sku: "IBIS-GLOCK19-G5MOS",
              options: { Калібр: "9 мм (9х19)" },
              prices: [{ amount: 50290, currency_code: "uah" }],
            },
          ],
          sales_channels: [{ id: salesChannelId }],
        },
        {
          title: "Рушниця Mossberg 590A1",
          category_ids: [categoryId],
          description:
            "Тактична помпова рушниця з посиленою конструкцією, розроблена для інтенсивної експлуатації.",
          handle: "mossberg-590a1-1276-20",
          weight: 3400,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfileId,
          options: [{ id: caliberOptionId }],
          variants: [
            {
              title: "12/76",
              sku: "IBIS-MOSSBERG-590A1",
              options: { Калібр: "12/76" },
              prices: [{ amount: 63450, currency_code: "uah" }],
            },
          ],
          sales_channels: [{ id: salesChannelId }],
        },
        {
          title: "Гвинтівка малокаліберна Savage 64 Precision",
          category_ids: [categoryId],
          description:
            "Гвинтівка початкового рівня для точної стрільби, з різьбою під дульний гальмо-компенсатор.",
          handle: "savage-64-precision-22lr",
          weight: 2900,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfileId,
          options: [{ id: caliberOptionId }],
          variants: [
            {
              title: ".22 LR",
              sku: "IBIS-SAVAGE64-PREC",
              options: { Калібр: ".22 LR" },
              prices: [{ amount: 24770, currency_code: "uah" }],
            },
          ],
          sales_channels: [{ id: salesChannelId }],
        },
  ];
}
