import type { UsuarioWire } from './conta';
import { pedirAutenticado } from './http';

export function carregarPerfil(): Promise<UsuarioWire> {
    return pedirAutenticado<UsuarioWire>('/perfil');
}

export function atualizarPerfil(nome: string, email: string): Promise<UsuarioWire> {
    return pedirAutenticado<UsuarioWire>('/perfil', {
        method: 'PUT',
        body: JSON.stringify({ nome, email }),
    });
}

export function alterarSenha(senhaAtual: string, senhaNova: string): Promise<null> {
    return pedirAutenticado<null>('/perfil/senha', {
        method: 'PUT',
        body: JSON.stringify({ senha_atual: senhaAtual, senha_nova: senhaNova }),
    });
}