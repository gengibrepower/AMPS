import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  root: __dirname,
  build: {
    rollupOptions: {
      input: {
        home: resolve(__dirname, "index.html"),
        search: resolve(__dirname, "client/search.html"),
        carro: resolve(__dirname, "client/carro.html"),
        mapa: resolve(__dirname, "client/mapa.html"),
        estacionamentoPublicado: resolve(__dirname, "client/estacionamento-publicado.html"),
        meusEstacionamentos: resolve(__dirname, "owner/meus-estacionamentos.html"),
        editor: resolve(__dirname, "owner/editor.html"),
        metricasEstacionamentos: resolve(__dirname, "owner/metricas-estacionamentos.html"),
        perfil: resolve(__dirname, "client/perfil.html"),
      },
    },
  },
});
