import {
	createCipheriv,
	createDecipheriv,
	createHmac,
	createHash,
} from 'node:crypto';

/**
 * Criptografia de dados sensíveis em repouso (Projeto Final — RA2).
 *
 * Cifra o CPF antes de gravar no banco com AES-256-GCM (confidencialidade +
 * autenticidade). Usa IV *sintético* (derivado do próprio valor via HMAC), de
 * modo que o mesmo CPF gera sempre o mesmo texto cifrado — preservando a
 * restrição UNIQUE e a detecção de duplicados no banco, sem expor o valor em
 * claro. A equivalência de dois CPFs iguais fica visível (é o que o UNIQUE
 * precisa); o valor em si permanece protegido.
 *
 * A chave vem de AES_KEY (base64, hex ou texto; derivada p/ 32 bytes via SHA-256).
 * Sem AES_KEY, usa uma chave fixa de desenvolvimento (com aviso) para não
 * travar testes/dev — em produção, DEFINA AES_KEY com segredo forte.
 */

const PREFIXO = 'enc:v1:';

function carregarChave(): Buffer {
	const bruta = process.env['AES_KEY'];
	if (!bruta) {
		if (process.env['NODE_ENV'] !== 'test') {
			// Aviso único; em produção AES_KEY é obrigatória.
			console.warn('[cripto] AES_KEY não definida — usando chave de desenvolvimento.');
		}
		return createHash('sha256').update('amps-dev-key-NAO-USAR-EM-PROD').digest();
	}
	// Normaliza qualquer formato de entrada para 32 bytes determinísticos.
	return createHash('sha256').update(bruta).digest();
}

const CHAVE = carregarChave();

/** Cifra um valor sensível. Idempotente: já-cifrado volta como está. */
export function cifrar(valor: string): string {
	if (valor.startsWith(PREFIXO)) return valor;
	// IV sintético (12 bytes) derivado do valor -> cifra determinística.
	const iv = createHmac('sha256', CHAVE).update(valor).digest().subarray(0, 12);
	const cipher = createCipheriv('aes-256-gcm', CHAVE, iv);
	const ct = Buffer.concat([cipher.update(valor, 'utf8'), cipher.final()]);
	const tag = cipher.getAuthTag();
	return PREFIXO + Buffer.concat([iv, tag, ct]).toString('base64');
}

/** Decifra um valor. Valores sem o prefixo (legado em claro) voltam como estão. */
export function decifrar(armazenado: string): string {
	if (!armazenado.startsWith(PREFIXO)) return armazenado;
	const bruto = Buffer.from(armazenado.slice(PREFIXO.length), 'base64');
	const iv = bruto.subarray(0, 12);
	const tag = bruto.subarray(12, 28);
	const ct = bruto.subarray(28);
	const decipher = createDecipheriv('aes-256-gcm', CHAVE, iv);
	decipher.setAuthTag(tag);
	return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}
