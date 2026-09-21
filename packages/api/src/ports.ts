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

export interface DadosDoEstacionamento {
	readonly nome: string;
	readonly endereco: Endereco;
}

export interface NovoEstacionamento extends DadosDoEstacionamento {
	readonly donoId: number;
}

export interface Topologia {
	readonly estacionamentoId: number;
	readonly versao: number;
}

export interface TopologiaComGrafo extends Topologia {
	readonly grafo: unknown;
}

export type TipoVaga = 'comum' | 'pcd' | 'idoso' | 'moto' | 'eletrico';

export type StatusVaga = 'livre' | 'ocupada' | 'reservada';

export interface Vaga {
	readonly id: number;
	readonly noId: string;
	readonly numero: string;
	readonly tipo: TipoVaga;
	readonly rotacaoGraus: number;
	readonly sensor: string | null;
	readonly status: StatusVaga;
	readonly carroId: number | null;
}

// O que o editor controla. status e carro_id sao da operação e não entram aqui.
export interface VagaDoEditor {
	readonly noId: string;
	readonly numero: string;
	readonly tipo: TipoVaga;
	readonly rotacaoGraus: number;
	readonly sensor: string | null;
}

export interface EntradaAlcancavel {
	readonly entradaId: string;
	readonly vagasAlcancaveis: readonly string[];
}

export interface Alcancabilidade {
	readonly porEntrada: readonly EntradaAlcancavel[];
	readonly vagasInalcancaveis: readonly string[];
}

// O motor de grafo vive no Merlian. Aqui é só a fronteira.
export interface MotorDeGrafo {
	alcancabilidade(grafo: unknown): Promise<Alcancabilidade>;
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
	listByProprietario(proprietario: string): Promise<readonly Carro[]>;
	deleteById(id: number): Promise<boolean>;
}

export interface EstacionamentoRepository {
	create(novo: NovoEstacionamento): Promise<Estacionamento>;
	listByDono(donoId: number): Promise<readonly Estacionamento[]>;
	findById(id: number): Promise<Estacionamento | null>;
	update(id: number, dados: DadosDoEstacionamento): Promise<Estacionamento>;
	delete(id: number): Promise<void>;
	setPublicado(id: number, publicado: boolean): Promise<Estacionamento>;
}

export interface TopologiaRepository {
	save(estacionamentoId: number, grafo: unknown): Promise<Topologia>;
	findByEstacionamento(estacionamentoId: number): Promise<TopologiaComGrafo | null>;
}

export interface VagaRepository {
	upsertAll(estacionamentoId: number, vagas: readonly VagaDoEditor[]): Promise<readonly Vaga[]>;
	listByEstacionamento(estacionamentoId: number): Promise<readonly Vaga[]>;
	findByNoId(estacionamentoId: number, noId: string): Promise<Vaga | null>;
	deleteByNoId(estacionamentoId: number, noId: string): Promise<void>;
}
