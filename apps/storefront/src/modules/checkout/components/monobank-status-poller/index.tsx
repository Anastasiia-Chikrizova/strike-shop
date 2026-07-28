"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"

type MonobankStatusPollerProps = {
  /** Інтервал опитування, мс */
  intervalMs?: number
  /** Скільки разів пробувати, перш ніж здатись */
  maxAttempts?: number
}

/**
 * Поки платіж у статусі pending — м'яко перезапитуємо серверний компонент.
 * Monobank підтверджує оплату вебхуком, тому статус може змінитися
 * уже після того, як користувач повернувся на сайт.
 */
const MonobankStatusPoller: React.FC<MonobankStatusPollerProps> = ({
  intervalMs = 3000,
  maxAttempts = 20,
}) => {
  const router = useRouter()

  useEffect(() => {
    let attempts = 0

    const timer = setInterval(() => {
      attempts += 1

      if (attempts > maxAttempts) {
        clearInterval(timer)
        return
      }

      router.refresh()
    }, intervalMs)

    return () => clearInterval(timer)
  }, [router, intervalMs, maxAttempts])

  return null
}

export default MonobankStatusPoller
