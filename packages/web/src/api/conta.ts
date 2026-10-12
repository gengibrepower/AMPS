import { pedir } from './http';

export interface UsuarioWire {
    readonly id: number;
    readonly nome: string;
    readonly email: string;
    readonly tipo_conta: string;
}

export interface LoginResposta {
    readonly token: string;
    readonly usuario: UsuarioWire;
}

export interface CadastroCliente {
    readonly nome: string;
    readonly email: string;
    readonly cpf: string;
    readonly senha: string;
}

export function login(email: string, senha: string): Promise<LoginResposta> {
    return pedir<LoginResposta>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, senha }),
    });
}

export function cadastrarCliente(dados: CadastroCliente): Promise<UsuarioWire> {
    return pedir<UsuarioWire>('/usuarios', {
        method: 'POST',
        body: JSON.stringify(dados),
    });
}

export interface CadastroDono extends CadastroCliente {
    readonly razao: string;
    readonly cnpj: string;
}

export interface DonoWire extends UsuarioWire {
    readonly dono: {
        readonly razao: string;
        readonly cnpj: string;
    };
}

export function cadastrarDono(dados: CadastroDono): Promise<DonoWire> {
    return pedir<DonoWire>('/donos', {
        method: 'POST',
        body: JSON.stringify(dados),
    });
}
