import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    hooks: "src/hooks.ts",
    "middleware/index": "src/middleware/index.ts",
    "audit/index": "src/audit/index.ts",
  },
  format: ["cjs", "esm"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  minify: false,
  external: ["react", "next"],
});
