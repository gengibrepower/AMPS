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

export interface DonoRegistrado extends Dono {
	readonly id: number;
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

export interface Endereco {
	readonly cep: string | null;
	readonly logradouro: string | null;
	readonly numero: string | null;
	readonly bairro: string | null;
	readonly complemento: string | null;
	readonly cidade: string | null;
	readonly estado: string | null;
}

export interface Estacionamento {
	readonly id: number;
	readonly donoId: number;
	readonly nome: string;
	readonly publicado: boolean;
	readonly endereco: Endereco;
}

export interface NovoEstacionamento {
	readonly donoId: number;
	readonly nome: string;
	readonly endereco: Endereco;
}

export interface Topologia {
	readonly estacionamentoId: number;
	readonly versao: number;
}

export interface UsuarioRepository {
	create(novo: NovoUsuario): Promise<Usuario>;
	findById(id: number): Promise<Usuario | null>;
	findByEmail(email: string): Promise<UsuarioComSenha | null>;
}

export interface DonoRepository {
	create(usuario: NovoUsuario, dono: Dono): Promise<UsuarioComDono>;
	findByUsuarioId(usuarioId: number): Promise<DonoRegistrado | null>;
}

export interface ModeloRepository {
	listAll(): Promise<readonly Modelo[]>;
}

export interface CarroRepository {
	create(novo: NovoCarro): Promise<Carro>;
}

export interface EstacionamentoRepository {
	create(novo: NovoEstacionamento): Promise<Estacionamento>;
	listByDono(donoId: number): Promise<readonly Estacionamento[]>;
	findById(id: number): Promise<Estacionamento | null>;
}

export interface TopologiaRepository {
	save(estacionamentoId: number, grafo: unknown): Promise<Topologia>;
}
