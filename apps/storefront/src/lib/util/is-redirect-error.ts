/**
 * `redirect()` у server action кидає спеціальну помилку з digest NEXT_REDIRECT.
 * Це успішний редірект, а не збій — його не можна показувати користувачу.
 */
export function isRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  )
}
