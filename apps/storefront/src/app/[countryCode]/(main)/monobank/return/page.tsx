import { retrieveMonobankPayment } from "@lib/data/monobank"
import { Heading, Text } from "@modules/common/components/ui"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import MonobankOrderCompleter from "@modules/checkout/components/monobank-order-completer"
import MonobankStatusPoller from "@modules/checkout/components/monobank-status-poller"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Результат оплати",
  description: "Результат оплати через Monobank",
}

export const dynamic = "force-dynamic"

export default async function MonobankReturnPage() {
  const payment = await retrieveMonobankPayment()

  if (!payment) {
    return (
      <Container>
        <Heading level="h1">Платіж не знайдено</Heading>
        <Text className="text-ui-fg-subtle">
          Ми не змогли знайти інформацію про цей платіж. Якщо кошти списано —
          напишіть нам, ми перевіримо вручну.
        </Text>
        <BackToCart />
      </Container>
    )
  }

  const amount = formatAmount(payment.final_amount ?? payment.amount, payment.ccy)

  switch (payment.outcome) {
    case "paid":
      return (
        <Container>
          <Heading level="h1">Оплату отримано ✅</Heading>
          <Text>Дякуємо! Ми отримали {amount} і вже готуємо замовлення.</Text>
          <Text className="text-ui-fg-subtle text-small-regular">
            Рахунок: {payment.invoice_id}
          </Text>
          <MonobankOrderCompleter />
          <LocalizedClientLink href="/account/orders" className="underline">
            Мої замовлення
          </LocalizedClientLink>
        </Container>
      )

    case "hold":
      return (
        <Container>
          <Heading level="h1">Кошти заблоковано</Heading>
          <Text>
            {amount} заблоковано на вашій картці. Ми спишемо їх, щойно
            підтвердимо замовлення.
          </Text>
        </Container>
      )

    case "failed":
      return (
        <Container>
          <Heading level="h1">Оплата не пройшла ❌</Heading>
          <Text>
            {payment.failure_reason ??
              "Банк відхилив платіж. Спробуйте іншу картку."}
          </Text>
          {payment.err_code ? (
            <Text className="text-ui-fg-subtle text-small-regular">
              Код помилки: {payment.err_code}
            </Text>
          ) : null}
          <BackToCart label="Спробувати ще раз" />
        </Container>
      )

    case "canceled":
      return (
        <Container>
          <Heading level="h1">Платіж скасовано</Heading>
          <Text>
            {payment.status === "expired"
              ? "Час на оплату вичерпано — створіть замовлення ще раз."
              : `Кошти (${amount}) повернуто на вашу картку.`}
          </Text>
          <BackToCart />
        </Container>
      )

    default:
      return (
        <Container>
          <MonobankStatusPoller />
          <Heading level="h1">Перевіряємо оплату…</Heading>
          <Text>
            Банк ще обробляє платіж на {amount}. Сторінка оновиться сама.
          </Text>
        </Container>
      )
  }
}

function Container({ children }: { children: React.ReactNode }) {
  return (
    <div className="content-container flex flex-col gap-y-4 py-16 max-w-2xl">
      {children}
    </div>
  )
}

function BackToCart({ label = "Повернутись до кошика" }: { label?: string }) {
  return (
    <LocalizedClientLink href="/cart" className="underline">
      {label}
    </LocalizedClientLink>
  )
}

function formatAmount(amount: number, ccy: number): string {
  const currency = { 980: "UAH", 840: "USD", 978: "EUR" }[ccy] ?? "UAH"

  return new Intl.NumberFormat("uk-UA", {
    style: "currency",
    currency,
  }).format(amount / 100)
}
