export type TipoMensagem = 'success' | 'error' | 'info';

export function mostrarMensagem(alvo: HTMLElement | null, texto: string, tipo: TipoMensagem): void {
    if (!alvo) return;
    alvo.textContent = texto;
    alvo.className = `message msg-${tipo}`;
}

export function limparMensagem(alvo: HTMLElement | null): void {
    if (!alvo) return;
    alvo.textContent = '';
    alvo.className = 'message';
}

export function limparFormularioDepois(
    form: HTMLFormElement,
    alvo: HTMLElement | null,
    ms: number,
    depois?: () => void,
): void {
    setTimeout(() => {
        form.reset();
        limparMensagem(alvo);
        depois?.();
    }, ms);
}
