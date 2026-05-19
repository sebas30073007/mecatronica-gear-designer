import { describe, it, expect } from 'vitest';
import { serializeState, deserializeState } from '../state/serialization';
import { initialState } from '../state/useGearStore';

describe('serializeState / deserializeState', () => {
  it('round-trip preserva el estado completo', () => {
    const hash = serializeState(initialState);
    const restored = deserializeState(hash);
    expect(restored).toEqual(initialState);
  });

  it('hash vacío devuelve null', () => {
    expect(deserializeState('')).toBeNull();
  });

  it('base64 inválido devuelve null', () => {
    expect(deserializeState('no-es-base64!!!')).toBeNull();
  });

  it('base64 válido pero no-JSON devuelve null', () => {
    const notJson = btoa('esto no es json {{{');
    expect(deserializeState(notJson)).toBeNull();
  });

  it('ignora el # al inicio del hash de URL', () => {
    const hash = '#' + serializeState(initialState);
    const restored = deserializeState(hash);
    expect(restored).toEqual(initialState);
  });

  it('el hash serializado es un string no vacío', () => {
    const hash = serializeState(initialState);
    expect(typeof hash).toBe('string');
    expect(hash.length).toBeGreaterThan(0);
  });
});
