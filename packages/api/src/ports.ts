export type TipoConta = 'common_user' | 'dono' | 'p_admin';

export interface Usuario {
	readonly id: number;
	readonly nome: string;
	readonly email: string;
	readonly cpf: string;
	readonly tipoConta: TipoConta;
}

export interface UsuarioComSenha extends Usuario {
	readonly senhaHash: string;
}

export interface NovoUsuario {
	readonly nome: string;
	readonly email: string;
	readonly cpf: string;
	readonly senhaHash: string;
	readonly tipoConta: TipoConta;
}

export interface Dono {
	readonly razao: string;
	readonly cnpj: string;
}

export interface UsuarioComDono {
	readonly usuario: Usuario;
	readonly dono: Dono;
}

export interface Modelo {
	readonly id: number;
	readonly marca: string;
	readonly nome: string;
}

export interface Carro {
	readonly id: number;
	readonly placa: string;
	readonly modeloId: number;
	readonly proprietario: string;
}

export interface NovoCarro {
	readonly placa: string;
	readonly modeloId: number;
	readonly proprietario: string;
}

export interface UsuarioRepository {
	create(novo: NovoUsuario): Promise<Usuario>;
	findById(id: number): Promise<Usuario | null>;
	findByEmail(email: string): Promise<UsuarioComSenha | null>;
}

export interface DonoRepository {
	create(usuario: NovoUsuario, dono: Dono): Promise<UsuarioComDono>;
}

export interface ModeloRepository {
	listAll(): Promise<readonly Modelo[]>;
}

export interface CarroRepository {
	create(novo: NovoCarro): Promise<Carro>;
}
