"use client"

import { placeOrder } from "@lib/data/cart"
import { isRedirectError } from "@lib/util/is-redirect-error"
import { Button, Text } from "@modules/common/components/ui"
import React, { useEffect, useRef, useState } from "react"

import ErrorMessage from "../error-message"

/**
 * Після повернення з Monobank оплата вже пройшла, але замовлення в Medusa
 * ще не оформлене — робимо це тут. placeOrder сам редіректить на сторінку
 * підтвердження замовлення.
 *
 * Якщо кошика вже немає (замовлення оформили раніше або в іншій вкладці) —
 * мовчки нічого не робимо, оплата від цього не втрачається.
 */
const MonobankOrderCompleter: React.FC = () => {
  const startedRef = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(true)

  const complete = async () => {
    setError(null)
    setSubmitting(true)

    try {
      await placeOrder()
    } catch (e) {
      if (isRedirectError(e)) {
        return
      }

      const message = e instanceof Error ? e.message : String(e)

      if (message.includes("No existing cart")) {
        setSubmitting(false)
        return
      }

      setError(
        `Оплата пройшла, але замовлення не оформилось: ${message}. Кошти не втрачені — спробуйте ще раз або напишіть нам.`
      )
      setSubmitting(false)
    }
  }

  useEffect(() => {
    // React у dev-режимі монтує ефекти двічі — друге оформлення зайве.
    if (startedRef.current) {
      return
    }

    startedRef.current = true
    void complete()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (error) {
    return (
      <div className="flex flex-col gap-y-2">
        <ErrorMessage error={error} data-testid="monobank-complete-error" />
        <Button onClick={complete} size="large">
          Спробувати ще раз
        </Button>
      </div>
    )
  }

  if (submitting) {
    return (
      <Text className="text-ui-fg-subtle text-small-regular">
        Оформлюємо замовлення…
      </Text>
    )
  }

  return null
}

export default MonobankOrderCompleter
