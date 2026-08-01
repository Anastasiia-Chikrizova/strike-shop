"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"

type MonobankStatusPollerProps = {
  intervalMs?: number
  maxAttempts?: number
}

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
