import { MedusaError } from "@medusajs/framework/utils"

import { MonobankError } from "./client"

/** Перетворює помилку Monobank у помилку Medusa з коректним HTTP-кодом. */
export function toMedusaError(e: unknown): Error {
  if (e instanceof MonobankError) {
    const type =
      e.httpStatus >= 500 || e.httpStatus === 503
        ? MedusaError.Types.UNEXPECTED_STATE
        : e.httpStatus === 404
          ? MedusaError.Types.NOT_FOUND
          : MedusaError.Types.INVALID_DATA

    return new MedusaError(type, `Monobank: ${e.message}`, e.errCode)
  }

  return e as Error
}
