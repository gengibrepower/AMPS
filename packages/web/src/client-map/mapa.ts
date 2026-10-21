import { carregarMapaPublicado } from '../api';

const queryString = window.location.search;
const params = new URLSearchParams(queryString);
const id = Number(params.get('id'));

if (!Number.isInteger(id) || id <= 0) {
    console.log('ERRO! id inválido');
} else {
    void (async () => {
        console.log(await carregarMapaPublicado(id));
    })();
}
