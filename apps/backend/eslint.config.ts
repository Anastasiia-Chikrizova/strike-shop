import { defineConfig } from "eslint/config"
import medusa from "@medusajs/eslint-plugin"

export default defineConfig([
  ...medusa.configs.recommended,
  {
    // The seed catalogs price in UAH, where ordinary retail values are large
    // integers: a Howa 1500 rifle really is 62930 UAH (~$1500), not 629.30.
    // `prices-in-major-units` is a magnitude heuristic — it flags anything
    // above a threshold as "probably minor units", which is why 324 and 370
    // in the same file pass while 1170 does not. These amounts are already
    // major units, so the rule is a false positive here.
    //
    // Deliberately narrow: it stays on everywhere else, where a four-digit
    // amount really would be suspicious.
    files: ["src/migration-scripts/**"],
    rules: {
      "@medusajs/prices-in-major-units": "off",
    },
  },
])
