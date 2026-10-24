import type { EnderecoWire } from '../api';

// "Rua XV, 1200 — Centro, Blumenau/SC", pulando o que não foi preenchido.
export function enderecoEmLinha(endereco: EnderecoWire): string {
    const rua = [endereco.logradouro, endereco.numero].filter(Boolean).join(', ');
    const cidade = [endereco.cidade, endereco.estado].filter(Boolean).join('/');
    const local = [endereco.bairro, cidade].filter(Boolean).join(', ');
    return [rua, local].filter((parte) => parte !== '').join(' — ');
}
