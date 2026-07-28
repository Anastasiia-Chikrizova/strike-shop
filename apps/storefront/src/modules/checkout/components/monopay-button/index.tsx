"use client"

import { retrieveMonobankPayment } from "@lib/data/monobank"
import { initMonoPay } from "@lib/data/monopay"
import { loadMonoPayScript } from "@lib/util/load-monopay-script"
import { Text } from "@modules/common/components/ui"
import React, { useEffect, useMemo, useRef, useState } from "react"
import { MonoPayUiOptions } from "types/monopay"

import ErrorMessage from "../error-message"

/** requestId живе 10 хвилин — оновлюємо дані за хвилину до кінця. */
const REFRESH_MARGIN_SECONDS = 60
/** Скільки разів перепитати бекенд, поки прийде вебхук. */
const CONFIRM_ATTEMPTS = 15
const CONFIRM_INTERVAL_MS = 2000

type Status =
  | "loading" // вантажимо скрипт і підпис
  | "ready" // кнопка відмальована
  | "processing" // користувач платить / чекаємо вебхук
  | "success"
  | "failed"
  | "error" // зламалась сама інтеграція

type MonoPayButtonProps = {
  cartId?: string
  /** Потрібен, щоб зібрати адресу сторінки повернення. */
  countryCode?: string
  ui?: MonoPayUiOptions
  /** Викликається після ПІДТВЕРДЖЕНОЇ бекендом оплати. */
  onPaid?: (invoiceId: string) => void
  /** Виконується до підпису замовлення — напр. підготовка кошика. */
  onBeforeInit?: () => Promise<void>
}

/**
 * Кнопка MonoPay: показує QR, який користувач сканує телефоном.
 * Є додаток monobank — відкриється він, немає — веб-версія.
 *
 * onSuccess віджета НЕ вважається підтвердженням: остаточний статус
 * питаємо в бекенда, який отримує його вебхуком від Monobank.
 */
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

  // Об'єкт ui з пропсів міняє ідентичність на кожен рендер, а перезапуск
  // ефекту означав би перестворення кнопки. Порівнюємо за вмістом.
  const uiKey = useMemo(() => JSON.stringify(ui ?? {}), [ui])

  useEffect(() => {
    let cancelled = false
    let clicked = false
    let refreshTimer: ReturnType<typeof setTimeout> | null = null

    /** Питаємо бекенд, поки він не побачить фінальний статус. */
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
        // Оплата могла пройти — просто вебхук ще в дорозі.
        setMessage(
          "Оплата ще підтверджується. Ми оновимо замовлення, щойно банк відповість."
        )
      }
    }

    /** Перепідписуємо дані до того, як протухне requestId. */
    const scheduleRefresh = (expiresIn: number) => {
      if (refreshTimer) {
        clearTimeout(refreshTimer)
      }

      const delay = Math.max(expiresIn - REFRESH_MARGIN_SECONDS, 30) * 1000

      refreshTimer = setTimeout(async () => {
        // Після кліку payloadBase64 і підпис міняти не можна.
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
          // Не критично: користувач побачить помилку при кліку й перезавантажить сторінку.
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
              // Інвойс створено — далі користувач сканує QR.
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
