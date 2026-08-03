import { getBaseURL } from "@lib/util/env"
import { ThemeProvider } from "@lib/context/theme-context"
import { Metadata } from "next"
import "styles/globals.css"

export const metadata: Metadata = {
  metadataBase: new URL(getBaseURL()),
}

const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("strike_shop_theme");
    var theme =
      stored === "light" || stored === "dark"
        ? stored
        : window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    var html = document.documentElement;
    html.classList.add(theme);
    html.style.colorScheme = theme;
    html.setAttribute("data-mode", theme);
  } catch (e) {}
})();
`

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="bg-ui-bg-base text-ui-fg-base">
        <ThemeProvider>
          <main className="relative">{props.children}</main>
        </ThemeProvider>
      </body>
    </html>
  )
}
