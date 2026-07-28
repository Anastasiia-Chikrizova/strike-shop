"use client"

import { startMonobankPayment } from "@lib/data/monobank"
import { isRedirectError } from "@lib/util/is-redirect-error"
import { Button } from "@modules/common/components/ui"
import React, { useState } from "react"

import ErrorMessage from "../error-message"

type MonobankPaymentButtonProps = {
  countryCode: string
  cartId?: string
  notReady?: boolean
  "data-testid"?: string
}

/**
 * Створює рахунок у Monobank і перенаправляє на сторінку оплати.
 * Сам redirect робить server action — на клієнті лишається тільки
 * стан завантаження та помилки.
 */
const MonobankPaymentButton: React.FC<MonobankPaymentButtonProps> = ({
  countryCode,
  cartId,
  notReady,
  "data-testid": dataTestId,
}) => {
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleClick = async () => {
    setSubmitting(true)
    setErrorMessage(null)

    try {
      await startMonobankPayment(countryCode, cartId)
    } catch (e) {
      // NEXT_REDIRECT — це успішний редірект, а не помилка.
      if (isRedirectError(e)) {
        return
      }

      setErrorMessage(
        e instanceof Error ? e.message : "Не вдалося створити платіж"
      )
      setSubmitting(false)
    }
  }

  return (
    <>
      <Button
        disabled={notReady || submitting}
        isLoading={submitting}
        onClick={handleClick}
        size="large"
        data-testid={dataTestId ?? "monobank-payment-button"}
      >
        Оплатити через Monobank
      </Button>
      <ErrorMessage
        error={errorMessage}
        data-testid="monobank-payment-error-message"
      />
    </>
  )
}

export default MonobankPaymentButton
