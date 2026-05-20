import { describe, it, expect } from 'vitest';
import { formatDate, daysBetween, relativeLabel } from './date';

// TZ=UTC está fijado en vitest.config.ts para resultados deterministas.

describe('formatDate', () => {
  it('retorna cadena vacía para null', () => {
    expect(formatDate(null)).toBe('');
  });

  it('formatea fecha sin opciones → "D mes"', () => {
    expect(formatDate('2026-05-22T12:00:00Z')).toBe('22 may');
  });

  it('formatea con withDay → "día D mes"', () => {
    // 22 de mayo 2026 es viernes (getDay()=5)
    expect(formatDate('2026-05-22T12:00:00Z', { withDay: true })).toBe('vie 22 may');
  });

  it('formatea con withTime → "D mes, HH:MM"', () => {
    expect(formatDate('2026-05-22T10:30:00Z', { withTime: true })).toBe('22 may, 10:30');
  });

  it('formatea con timeOnly → "HH:MM"', () => {
    expect(formatDate('2026-05-22T10:30:00Z', { timeOnly: true })).toBe('10:30');
  });

  it('formatea minuto con cero a la izquierda', () => {
    expect(formatDate('2026-05-22T09:05:00Z', { timeOnly: true })).toBe('09:05');
  });
});

describe('daysBetween', () => {
  it('retorna 1 cuando isoA es el día siguiente a isoB', () => {
    expect(daysBetween('2026-05-23', '2026-05-22')).toBe(1);
  });

  it('retorna -1 cuando isoA es el día anterior a isoB', () => {
    expect(daysBetween('2026-05-21', '2026-05-22')).toBe(-1);
  });

  it('retorna 0 cuando ambas fechas son el mismo día', () => {
    expect(daysBetween('2026-05-22', '2026-05-22')).toBe(0);
  });

  it('acepta un objeto Date como segundo argumento', () => {
    expect(daysBetween('2026-05-25', new Date('2026-05-22T00:00:00Z'))).toBe(3);
  });
});

describe('relativeLabel', () => {
  const now = new Date('2026-05-22T12:00:00Z');

  it('retorna cadena vacía para null', () => {
    expect(relativeLabel(null, now)).toBe('');
  });

  it('retorna "Hoy" para la misma fecha', () => {
    expect(relativeLabel('2026-05-22', now)).toBe('Hoy');
  });

  it('retorna "Mañana" para el día siguiente', () => {
    expect(relativeLabel('2026-05-23', now)).toBe('Mañana');
  });

  it('retorna "Ayer" para el día anterior', () => {
    expect(relativeLabel('2026-05-21', now)).toBe('Ayer');
  });

  it('retorna "en N días" para fechas futuras dentro de 7 días', () => {
    expect(relativeLabel('2026-05-25', now)).toBe('en 3 días');
  });

  it('retorna "hace N días" para fechas pasadas dentro de 7 días', () => {
    expect(relativeLabel('2026-05-19', now)).toBe('hace 3 días');
  });

  it('retorna formato largo para fechas fuera del rango de 7 días', () => {
    // Más de 7 días en el futuro → formatDate con withDay
    const label = relativeLabel('2026-06-05', now);
    expect(label).toMatch(/\w{2,3} \d{1,2} \w{3}/);
  });
});
