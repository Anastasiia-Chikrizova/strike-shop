"use client"

import React, { createContext, useContext, useEffect, useState } from "react"

export type ThemeOption = "light" | "dark" | "system"
export type ThemeValue = "light" | "dark"

const THEME_KEY = "strike_shop_theme"

function getSystemTheme(): ThemeValue {
  if (typeof window === "undefined") {
    return "light"
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light"
}

function resolveTheme(option: ThemeOption): ThemeValue {
  return option === "system" ? getSystemTheme() : option
}

function applyTheme(value: ThemeValue) {
  const html = document.documentElement

  const css = document.createElement("style")
  css.appendChild(
    document.createTextNode(
      "*{-webkit-transition:none!important;-moz-transition:none!important;-o-transition:none!important;-ms-transition:none!important;transition:none!important}"
    )
  )
  document.head.appendChild(css)

  html.classList.remove(value === "light" ? "dark" : "light")
  html.classList.add(value)
  html.style.colorScheme = value
  html.setAttribute("data-mode", value)

  void window.getComputedStyle(css).opacity
  document.head.removeChild(css)
}

interface ThemeContext {
  theme: ThemeOption
  resolvedTheme: ThemeValue
  setTheme: (theme: ThemeOption) => void
}

const ThemeContext = createContext<ThemeContext | null>(null)

export const ThemeProvider = ({ children }: { children?: React.ReactNode }) => {
  const [theme, setThemeState] = useState<ThemeOption>(() => {
    if (typeof window === "undefined") {
      return "system"
    }
    return (localStorage.getItem(THEME_KEY) as ThemeOption) || "system"
  })
  // Always starts as "light" so the client's first render matches the
  // server-rendered markup exactly; the real value (which may read
  // localStorage/matchMedia) is applied in the effect below, after mount.
  const [resolvedTheme, setResolvedTheme] = useState<ThemeValue>("light")

  const setTheme = (next: ThemeOption) => {
    localStorage.setItem(THEME_KEY, next)
    setThemeState(next)
  }

  useEffect(() => {
    const value = resolveTheme(theme)
    setResolvedTheme(value)
    applyTheme(value)

    if (theme !== "system") {
      return
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const onChange = () => {
      const systemValue = getSystemTheme()
      setResolvedTheme(systemValue)
      applyTheme(systemValue)
    }

    media.addEventListener("change", onChange)
    return () => media.removeEventListener("change", onChange)
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (context === null) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }
  return context
}
