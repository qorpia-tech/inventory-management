import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Test setups destructure state (reassigned) together with ids (constant).
    rules: { "prefer-const": ["error", { destructuring: "all" }] },
  },
  {
    // The domain layer must stay framework free so it can move to the real backend contract.
    files: ["src/domain/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["react", "react-dom", "next", "next/*"], message: "The domain layer must not depend on UI frameworks." },
            { group: ["@/demo/*", "@/ui/*", "@/app/*", "@/application/*"], message: "The domain layer must not depend on outer layers." },
          ],
        },
      ],
      "no-restricted-globals": ["error", "window", "document", "localStorage", "sessionStorage", "navigator"],
    },
  },
  {
    // Screens talk to the rules only through the gateway port.
    files: ["src/ui/**/*.{ts,tsx}", "src/app/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [{ group: ["@/domain", "@/domain/*"], message: "Use the gateway port in @/application/gateway." }] }],
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "playwright-report/**", "test-results/**"]),
]);

export default eslintConfig;
