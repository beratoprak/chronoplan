import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  // Bileşen testleri (renderToStaticMarkup) için: tsconfig jsx "preserve" diyor.
  oxc: { jsx: { runtime: "automatic" } },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
