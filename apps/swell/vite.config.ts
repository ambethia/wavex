import { wavex } from "@wavex/vite-plugin";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [wavex()],
  staged: {
    "*": "vp check --fix",
  },
  fmt: {
    ignorePatterns: ["convex/_generated/**"],
  },
  lint: {
    ignorePatterns: ["convex/_generated/**"],
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
  },
});
