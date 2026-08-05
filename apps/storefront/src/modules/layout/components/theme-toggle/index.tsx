"use client"

import { Menu, MenuButton, MenuItem, MenuItems, Transition } from "@headlessui/react"
import { CircleHalfSolid, Moon, Sun } from "@medusajs/icons"
import { Fragment } from "react"
import clsx from "clsx"

import { ThemeOption, useTheme } from "@lib/context/theme-context"

const OPTIONS: { value: ThemeOption; label: string; icon: React.ReactNode }[] = [
  { value: "system", label: "System", icon: <CircleHalfSolid /> },
  { value: "light", label: "Light", icon: <Sun /> },
  { value: "dark", label: "Dark", icon: <Moon /> },
]

const ThemeToggle = () => {
  const { theme, resolvedTheme, setTheme } = useTheme()

  return (
    <Menu as="div" className="relative">
      <MenuButton
        className="hover:text-ui-fg-base flex items-center"
        data-testid="theme-toggle"
        aria-label="Toggle color theme"
      >
        {resolvedTheme === "dark" ? <Moon /> : <Sun />}
      </MenuButton>
      <Transition
        as={Fragment}
        enter="transition ease-out duration-150"
        enterFrom="opacity-0 translate-y-1"
        enterTo="opacity-100 translate-y-0"
        leave="transition ease-in duration-100"
        leaveFrom="opacity-100 translate-y-0"
        leaveTo="opacity-0 translate-y-1"
      >
        <MenuItems className="absolute right-0 top-full mt-2 min-w-[140px] rounded-rounded bg-ui-bg-base border border-ui-border-base shadow-elevation-flyout py-1 focus:outline-none z-50">
          {OPTIONS.map((option) => (
            <MenuItem key={option.value}>
              {({ focus }) => (
                <button
                  type="button"
                  onClick={() => setTheme(option.value)}
                  className={clsx(
                    "w-full flex items-center gap-x-2 px-3 py-1.5 text-left txt-compact-small",
                    focus ? "bg-ui-bg-subtle" : "",
                    theme === option.value
                      ? "text-ui-fg-base"
                      : "text-ui-fg-subtle"
                  )}
                >
                  {option.icon}
                  {option.label}
                </button>
              )}
            </MenuItem>
          ))}
        </MenuItems>
      </Transition>
    </Menu>
  )
}

export default ThemeToggle
