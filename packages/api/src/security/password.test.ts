import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password.js';

describe('hashPassword', () => {
  it('gera um hash argon2id', async () => {
    const hash = await hashPassword('senha-secreta');

    expect(hash.startsWith('$argon2id$')).toBe(true);
  });

  it('não devolve a senha em claro', async () => {
    const hash = await hashPassword('senha-secreta');

    expect(hash).not.toContain('senha-secreta');
  });

  it('gera hashes diferentes para a mesma senha', async () => {
    const [first, second] = await Promise.all([
      hashPassword('senha-secreta'),
      hashPassword('senha-secreta'),
    ]);

    expect(first).not.toBe(second);
  });

  it('rejeita senha vazia', async () => {
    await expect(hashPassword('')).rejects.toThrow();
  });
});

describe('verifyPassword', () => {
  it('aceita a senha correta', async () => {
    const hash = await hashPassword('senha-secreta');

    expect(await verifyPassword('senha-secreta', hash)).toBe(true);
  });

  it('recusa a senha errada', async () => {
    const hash = await hashPassword('senha-secreta');

    expect(await verifyPassword('senha-errada', hash)).toBe(false);
  });

  it('recusa hash malformado sem lançar', async () => {
    expect(await verifyPassword('senha-secreta', 'nao-e-um-hash')).toBe(false);
  });
});
