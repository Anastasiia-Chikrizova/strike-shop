import { MonoPayInstance } from "types/monopay"

const SCRIPT_ID = "monopay-script"
const SCRIPT_SRC =
  "https://pay.monobank.ua/mono-pay-button/v1/mono-pay-button.js"

let loader: Promise<MonoPayInstance> | null = null

export function loadMonoPayScript(): Promise<MonoPayInstance> {
  if (typeof window === "undefined") {
    return Promise.reject(
      new Error("MonoPay доступний тільки в браузері")
    )
  }

  if (window.MonoPay) {
    return Promise.resolve(window.MonoPay)
  }

  loader ??= new Promise<MonoPayInstance>((resolve, reject) => {
    const existing = document.getElementById(
      SCRIPT_ID
    ) as HTMLScriptElement | null

    const script = existing ?? document.createElement("script")

    const onLoad = () => {
      if (window.MonoPay) {
        resolve(window.MonoPay)
      } else {
        loader = null
        reject(new Error("Скрипт MonoPay завантажився, але window.MonoPay порожній"))
      }
    }

    const onError = () => {
      loader = null
      script.remove()
      reject(new Error("Не вдалося завантажити скрипт MonoPay"))
    }

    script.addEventListener("load", onLoad, { once: true })
    script.addEventListener("error", onError, { once: true })

    if (!existing) {
      script.id = SCRIPT_ID
      script.src = SCRIPT_SRC
      script.async = true
      document.head.appendChild(script)
    }
  })

  return loader
}
