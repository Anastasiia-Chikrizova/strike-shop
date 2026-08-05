export const GROUP_QUERY_KEY = "groupIds"

export type GroupIds = string[]

export const parseGroupIds = (
  searchParams: URLSearchParams | Record<string, string | string[] | undefined>
): GroupIds => {
  if (typeof (searchParams as URLSearchParams).getAll === "function") {
    const values = (searchParams as URLSearchParams).getAll(GROUP_QUERY_KEY)
    return Array.from(new Set(values.filter(Boolean)))
  }

  const paramValue = (
    searchParams as Record<string, string | string[] | undefined>
  )[GROUP_QUERY_KEY]

  if (Array.isArray(paramValue)) {
    return Array.from(new Set(paramValue.filter(Boolean)))
  }

  if (typeof paramValue === "string" && paramValue.length > 0) {
    return paramValue.split(",").filter(Boolean)
  }

  return []
}
