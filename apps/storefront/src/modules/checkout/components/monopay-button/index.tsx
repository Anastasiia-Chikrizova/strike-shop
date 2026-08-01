"use client"

import { retrieveMonobankPayment } from "@lib/data/monobank"
import { initMonoPay } from "@lib/data/monopay"
import { loadMonoPayScript } from "@lib/util/load-monopay-script"
import { Text } from "@modules/common/components/ui"
import React, { useEffect, useMemo, useRef, useState } from "react"
import { MonoPayUiOptions } from "types/monopay"

import ErrorMessage from "../error-message"

const REFRESH_MARGIN_SECONDS = 60
const CONFIRM_ATTEMPTS = 15
const CONFIRM_INTERVAL_MS = 2000

type Status =
  | "loading"
  | "ready"
  | "processing"
  | "success"
  | "failed"
  | "error"

type MonoPayButtonProps = {
  cartId?: string
  countryCode?: string
  ui?: MonoPayUiOptions
  onPaid?: (invoiceId: string) => void
  onBeforeInit?: () => Promise<void>
}

const MonoPayButton: React.FC<MonoPayButtonProps> = ({
  cartId,
  countryCode,
  ui,
  onPaid,
  onBeforeInit,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const onPaidRef = useRef(onPaid)
  const onBeforeInitRef = useRef(onBeforeInit)

  const [status, setStatus] = useState<Status>("loading")
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    onPaidRef.current = onPaid
    onBeforeInitRef.current = onBeforeInit
  }, [onPaid, onBeforeInit])

  const uiKey = useMemo(() => JSON.stringify(ui ?? {}), [ui])

  useEffect(() => {
    let cancelled = false
    let clicked = false
    let refreshTimer: ReturnType<typeof setTimeout> | null = null

    const confirmPayment = async (invoiceId: string) => {
      for (let attempt = 0; attempt < CONFIRM_ATTEMPTS; attempt++) {
        if (cancelled) {
          return
        }

        const payment = await retrieveMonobankPayment(invoiceId)

        if (payment && payment.outcome !== "pending") {
          if (cancelled) {
            return
          }

          if (payment.outcome === "paid" || payment.outcome === "hold") {
            setStatus("success")
            onPaidRef.current?.(invoiceId)
          } else {
            setStatus("failed")
            setMessage(payment.failure_reason ?? "Банк не підтвердив оплату.")
          }

          return
        }

        await new Promise((resolve) => setTimeout(resolve, CONFIRM_INTERVAL_MS))
      }

      if (!cancelled) {
        setMessage(
          "Оплата ще підтверджується. Ми оновимо замовлення, щойно банк відповість."
        )
      }
    }

    const scheduleRefresh = (expiresIn: number) => {
      if (refreshTimer) {
        clearTimeout(refreshTimer)
      }

      const delay = Math.max(expiresIn - REFRESH_MARGIN_SECONDS, 30) * 1000

      refreshTimer = setTimeout(async () => {
        if (clicked || cancelled || !window.MonoPay) {
          return
        }

        try {
          const fresh = await initMonoPay({ cartId, countryCode })

          if (cancelled || clicked) {
            return
          }

          window.MonoPay.update({
            signature: fresh.signature,
            requestId: fresh.requestId,
            payloadBase64: fresh.payloadBase64,
          })

          scheduleRefresh(fresh.expires_in)
        } catch {
        }
      }, delay)
    }

    const boot = async () => {
      try {
        await onBeforeInitRef.current?.()

        const [data, monoPay] = await Promise.all([
          initMonoPay({ cartId, countryCode }),
          loadMonoPayScript(),
        ])

        if (cancelled) {
          return
        }

        const { button } = monoPay.init({
          keyId: data.keyId,
          signature: data.signature,
          requestId: data.requestId,
          payloadBase64: data.payloadBase64,
          ui: {
            buttonType: "pay",
            theme: "dark",
            corners: "rounded",
            ...(JSON.parse(uiKey) as MonoPayUiOptions),
          },
          callbacks: {
            onButtonReady: () => setStatus("ready"),
            onClick: () => {
              clicked = true
              setStatus("processing")
              setMessage(null)
            },
            onInvoiceCreate: (invoice) => {
              void confirmPayment(invoice.invoiceId)
            },
            onSuccess: (result) => {
              void confirmPayment(result.invoiceId)
            },
            onError: (error) => {
              setStatus("failed")
              setMessage(
                error.message ?? error.description ?? "Платіж не пройшов"
              )
            },
          },
        })

        containerRef.current?.replaceChildren(button)
        scheduleRefresh(data.expires_in)
      } catch (e) {
        if (!cancelled) {
          setStatus("error")
          setMessage(
            e instanceof Error ? e.message : "Не вдалося підключити MonoPay"
          )
        }
      }
    }

    void boot()

    return () => {
      cancelled = true

      if (refreshTimer) {
        clearTimeout(refreshTimer)
      }

      window.MonoPay?.destroy()
    }
  }, [cartId, countryCode, uiKey])

  return (
    <div className="flex flex-col gap-y-2">
      <div ref={containerRef} data-testid="monopay-button-container" />

      {status === "loading" && (
        <Text className="text-ui-fg-subtle text-small-regular">
          Готуємо оплату…
        </Text>
      )}

      {status === "processing" && (
        <Text className="text-ui-fg-subtle text-small-regular">
          Скануйте QR-код у застосунку monobank. Чекаємо на підтвердження…
        </Text>
      )}

      {status === "success" && (
        <Text className="text-small-regular" data-testid="monopay-success">
          Оплату підтверджено ✅
        </Text>
      )}

      {status === "processing" && message && (
        <Text className="text-ui-fg-subtle text-small-regular">{message}</Text>
      )}

      {(status === "failed" || status === "error") && (
        <ErrorMessage error={message} data-testid="monopay-error" />
      )}
    </div>
  )
}

export default MonoPayButton
