"use client"

import * as Accordion from "@radix-ui/react-accordion"
import { useEffect, useState } from "react"

import { ChevronDownMini } from "@medusajs/icons"
import { sdk } from "@lib/config"
import { HttpTypes } from "@medusajs/types"
import clsx from "clsx"

type OptionsPickerProps = {
  selectedValueIds: string[]
  setOptionValueIds: (valueIds: string[]) => void
  categoryId?: string
  collectionId?: string
  productsIds?: string[]
  showGroups?: boolean
  selectedGroupIds?: string[]
  setGroupIds?: (groupIds: string[]) => void
}

type StoreProductOptionValue = HttpTypes.StoreProductOption["values"] extends
  | (infer V)[]
  | undefined
  ? V
  : never

const OptionsPicker = ({
  selectedValueIds,
  setOptionValueIds,
  categoryId,
  collectionId,
  productsIds,
  showGroups = false,
  selectedGroupIds = [],
  setGroupIds,
}: OptionsPickerProps) => {
  const [options, setOptions] = useState<HttpTypes.StoreProductOption[]>([])
  const [groups, setGroups] = useState<HttpTypes.StoreProductCategory[]>([])
  const [openItems, setOpenItems] = useState<string[]>([])

  const productsIdsKey = productsIds?.join(",")
  const selectedGroupIdsKey = selectedGroupIds.join(",")

  useEffect(() => {
    if (!showGroups) {
      return
    }

    const fetchGroups = async () => {
      try {
        const response = await sdk.client.fetch<{
          product_categories?: HttpTypes.StoreProductCategory[]
        }>("/store/product-categories", {
          method: "GET",
          query: {
            parent_category_id: "null",
            fields: "id,name,handle",
            limit: 100,
          },
        })

        if (response?.product_categories) {
          setGroups(response.product_categories)
        }
      } catch (error) {
        console.error("Failed to fetch product groups", error)
      }
    }

    fetchGroups()
  }, [showGroups])

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const scopedCategoryIds = selectedGroupIds.length
          ? selectedGroupIds
          : categoryId
          ? [categoryId]
          : undefined

        const query: Record<string, unknown> = {
          fields:
            "id,options.id,options.title,options.is_exclusive,options.values.id,options.values.value",
          limit: 200,
        }

        if (scopedCategoryIds?.length) {
          query.category_id = scopedCategoryIds
        }

        if (collectionId) {
          query.collection_id = [collectionId]
        }

        if (productsIds?.length) {
          query.id = productsIds
        }

        const response = await sdk.client.fetch<{
          products?: { options?: HttpTypes.StoreProductOption[] }[]
        }>("/store/products", {
          method: "GET",
          query,
        })

        const optionsById = new Map<string, HttpTypes.StoreProductOption>()

        response?.products?.forEach((product) => {
          product.options?.forEach((option) => {
            if (!option.id || option.is_exclusive) {
              return
            }

            const existing = optionsById.get(option.id)

            if (!existing) {
              optionsById.set(option.id, {
                ...option,
                values: [...(option.values || [])],
              })
              return
            }

            const existingValueIds = new Set(
              (existing.values || []).map(
                (value: StoreProductOptionValue) => value.id
              )
            )

            option.values?.forEach((value) => {
              if (value.id && !existingValueIds.has(value.id)) {
                existing.values?.push(value)
                existingValueIds.add(value.id)
              }
            })
          })
        })

        setOptions(Array.from(optionsById.values()))
      } catch (error) {
        console.error("Failed to fetch product options", error)
      }
    }

    fetchOptions()
  }, [categoryId, collectionId, productsIdsKey, selectedGroupIdsKey])

  useEffect(() => {
    if (options.length) {
      setOpenItems((prev) =>
        Array.from(new Set([...prev, ...options.map((option) => option.id)]))
      )
    }
  }, [options])

  const toggleGroup = (groupId: string) => {
    if (!setGroupIds) {
      return
    }

    const isSelected = selectedGroupIds.includes(groupId)
    const nextSelections = isSelected
      ? selectedGroupIds.filter((id) => id !== groupId)
      : [...selectedGroupIds, groupId]

    setGroupIds(Array.from(new Set(nextSelections)))
  }

  if (!options.length && !groups.length) {
    return null
  }

  return (
    <div className="flex flex-col gap-y-4">
      <div className="flex items-center justify-between px-1">
        <span className="txt-compact-small-plus text-ui-fg-subtle">
          Options
        </span>
      </div>
      <Accordion.Root
        type="multiple"
        value={openItems}
        onValueChange={(values) => setOpenItems(values as string[])}
        className="flex flex-col gap-y-3 pr-6"
      >
        {showGroups && groups.length > 0 && (
          <Accordion.Item value="groups" className="overflow-hidden">
            <Accordion.Header>
              <Accordion.Trigger className="flex w-full items-center justify-between py-3 text-left">
                <div className="flex items-center gap-2">
                  <span className="txt-compact-small-plus text-ui-fg-base">
                    Групи
                  </span>
                  <span className="txt-compact-small-plus text-ui-fg-muted">
                    ({selectedGroupIds.length})
                  </span>
                </div>
                <span
                  className={clsx(
                    "flex h-7 w-7 items-center justify-center text-ui-fg-muted transition-transform duration-150",
                    {
                      "rotate-180": openItems.includes("groups"),
                    }
                  )}
                >
                  <ChevronDownMini />
                </span>
              </Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Content className="pb-4 pt-1">
              <div className="flex flex-wrap gap-2">
                {groups.map((group) => {
                  const isSelected = selectedGroupIds.includes(group.id)

                  return (
                    <button
                      key={group.id}
                      onClick={() => toggleGroup(group.id)}
                      className={clsx(
                        "border-ui-border-base border text-small-regular h-10 rounded-rounded px-3 flex items-center transition-colors duration-150",
                        {
                          "border-ui-border-interactive text-ui-fg-base":
                            isSelected,
                          "text-ui-fg-muted hover:text-ui-fg-base": !isSelected,
                        }
                      )}
                      aria-pressed={isSelected}
                    >
                      {group.name}
                    </button>
                  )
                })}
              </div>
            </Accordion.Content>
          </Accordion.Item>
        )}
        {options.map((option) => {
          const values =
            option.values
              ?.map((value) => ({
                id: value.id,
                label: value.value,
              }))
              .filter(
                (value): value is { id: string; label: string } =>
                  !!value.id && !!value.label
              ) || []

          if (!values.length) {
            return null
          }

          const toggleValue = (valueId: string) => {
            const isSelected = selectedValueIds.includes(valueId)
            const nextSelections = isSelected
              ? selectedValueIds.filter((id) => id !== valueId)
              : [...selectedValueIds, valueId]

            setOptionValueIds(Array.from(new Set(nextSelections)))
          }

          const isOpen = openItems.includes(option.id)
          const selectedCount = values.filter((value) =>
            selectedValueIds.includes(value.id)
          ).length

          return (
            <Accordion.Item
              key={option.id}
              value={option.id}
              className="overflow-hidden"
            >
              <Accordion.Header>
                <Accordion.Trigger className="flex w-full items-center justify-between py-3 text-left">
                  <div className="flex items-center gap-2">
                    <span className="txt-compact-small-plus text-ui-fg-base">
                      {option.title || "Option"}
                    </span>
                    <span className="txt-compact-small-plus text-ui-fg-muted">
                      ({selectedCount})
                    </span>
                  </div>
                  <span
                    className={clsx(
                      "flex h-7 w-7 items-center justify-center text-ui-fg-muted transition-transform duration-150",
                      {
                        "rotate-180": isOpen,
                      }
                    )}
                  >
                    <ChevronDownMini />
                  </span>
                </Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Content className="pb-4 pt-1">
                <div className="flex flex-wrap gap-2">
                  {values.map((value) => {
                    const isSelected = selectedValueIds.includes(value.id)

                    return (
                      <button
                        key={value.id}
                        onClick={() => toggleValue(value.id)}
                        className={clsx(
                          "border-ui-border-base border text-small-regular h-10 rounded-rounded px-3 flex items-center transition-colors duration-150",
                          {
                            "border-ui-border-interactive text-ui-fg-base":
                              isSelected,
                            "text-ui-fg-muted hover:text-ui-fg-base":
                              !isSelected,
                          }
                        )}
                        aria-pressed={isSelected}
                      >
                        {value.label}
                      </button>
                    )
                  })}
                </div>
              </Accordion.Content>
            </Accordion.Item>
          )
        })}
      </Accordion.Root>
    </div>
  )
}

export default OptionsPicker
