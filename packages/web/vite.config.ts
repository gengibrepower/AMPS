import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  root: __dirname,
  build: {
    rollupOptions: {
      input: {
        home: resolve(__dirname, "index.html"),
        search: resolve(__dirname, "search.html"),
        estacionamentos: resolve(__dirname, "owner/estacionamentos.html"),
      },
    },
  },
});
