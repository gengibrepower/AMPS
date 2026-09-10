import { defineConfig } from "vite";
import { resolve } from "path";

// Login, cadastro de cliente e recuperação de senha viram um único modal
// dentro de index.html — src/script.ts controla a abertura/troca de tela
// do modal, src/login.ts cuida da lógica de cada formulário — não há mais
// páginas separadas para eles.
export default defineConfig({
  root: __dirname,
  build: {
    rollupOptions: {
      input: {
        home: resolve(__dirname, "index.html"),
        search: resolve(__dirname, "search.html"),
      },
    },
  },
});
