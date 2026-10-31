export type Area = 'buscar' | 'meusCarros' | 'meusPatios' | 'perfil';

export interface Destino {
    readonly area: Area;
    readonly rotulo: string;
    readonly icone: string;
    readonly href: string;
}

const POR_TIPO: Record<string, readonly Area[]> = {
    common_user: ['buscar', 'meusCarros', 'perfil'],
    dono: ['buscar', 'meusPatios', 'perfil'],
    p_admin: ['buscar', 'meusCarros', 'perfil'],
};

const DESTINOS: Record<Area, Destino> = {
    buscar: { area: 'buscar', rotulo: 'Buscar estacionamento', icone: 'search', href: '/index.html' },
    meusCarros: { area: 'meusCarros', rotulo: 'Meus carros', icone: 'directions_car', href: '/client/carro.html' },
    meusPatios: { area: 'meusPatios', rotulo: 'Meus pátios', icone: 'grid_view', href: '/owner/estacionamentos.html' },
    perfil: { area: 'perfil', rotulo: 'Meu perfil', icone: 'person', href: '/client/perfil.html' },
};

// Esconder item de menu não é segurança: quem protege é o #bloqueio da página
// e o 403 da API. Isto responde "o que esta conta tem para ver", nada mais.
export function areasDe(tipo: string | null): readonly Area[] {
    if (tipo === null) return ['buscar'];
    return POR_TIPO[tipo] ?? ['buscar'];
}

export function destinosDe(tipo: string | null): readonly Destino[] {
    return areasDe(tipo).map((area) => DESTINOS[area]);
}
