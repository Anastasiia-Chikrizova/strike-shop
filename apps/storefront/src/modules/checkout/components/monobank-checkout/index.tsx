"use client"

import { HttpTypes } from "@medusajs/types"
import { Text } from "@modules/common/components/ui"
import { useParams } from "next/navigation"
import React from "react"

import MonobankPaymentButton from "../monobank-payment-button"

type MonobankCheckoutProps = {
  cart: HttpTypes.StoreCart
  notReady?: boolean
}

const MonobankCheckout: React.FC<MonobankCheckoutProps> = ({
  cart,
  notReady,
}) => {
  const { countryCode } = useParams<{ countryCode: string }>()

  return (
    <div className="flex flex-col gap-y-4">
      <div className="flex flex-col gap-y-1 border border-ui-border-interactive rounded-lg p-4">
        <Text className="txt-medium-plus text-ui-fg-base">
          Оплата через monobank
        </Text>
        <Text className="text-ui-fg-subtle text-small-regular">
          Картки будь-яких банків, Apple Pay і Google Pay. Кошти списуються
          після підтвердження банком.
        </Text>
      </div>

      <MonobankPaymentButton
        countryCode={countryCode}
        cartId={cart.id}
        notReady={notReady}
        data-testid="monobank-payment-button"
      />
    </div>
  )
}

export default MonobankCheckout
