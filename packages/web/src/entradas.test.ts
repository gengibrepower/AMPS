import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Um módulo carregado por <script> e também importado por outro vira dois no
// dev server: depois de uma edição o Vite carimba o import com ?t=, a tag do
// HTML fica sem, e o navegador executa o módulo duas vezes (ouvintes em dobro,
// menu que abre e fecha no mesmo clique). Entrada de página não se importa.

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function arquivos(pasta: string, extensao: string): string[] {
    return readdirSync(pasta, { withFileTypes: true }).flatMap((item) => {
        const caminho = join(pasta, item.name);
        if (item.isDirectory()) return item.name === 'node_modules' ? [] : arquivos(caminho, extensao);
        return item.name.endsWith(extensao) ? [caminho] : [];
    });
}

function entradasDasPaginas(): Set<string> {
    const paginas = [join(WEB, 'index.html'), ...arquivos(join(WEB, 'client'), '.html'), ...arquivos(join(WEB, 'owner'), '.html')];
    const entradas = new Set<string>();
    for (const pagina of paginas) {
        for (const [, src] of readFileSync(pagina, 'utf8').matchAll(/<script type="module" src="([^"]+)"/g)) {
            entradas.add(resolve(dirname(pagina), src!));
        }
    }
    return entradas;
}

describe('entradas das páginas', () => {
    it('nenhum módulo carregado por <script> é importado por outro módulo', () => {
        const entradas = entradasDasPaginas();
        const importadas: string[] = [];
        for (const modulo of arquivos(join(WEB, 'src'), '.ts')) {
            for (const [, de, lateral] of readFileSync(modulo, 'utf8').matchAll(/from '(\.[^']+)'|import '(\.[^']+)'/g)) {
                const caminho = `${resolve(dirname(modulo), (de ?? lateral)!)}.ts`;
                if (entradas.has(caminho)) importadas.push(`${relative(WEB, modulo)} importa ${relative(WEB, caminho)}`);
            }
        }
        expect(importadas).toEqual([]);
    });
});
