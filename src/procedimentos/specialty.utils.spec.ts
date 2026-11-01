import { describe, it, expect } from 'vitest';
import {
  normalizeText,
  formatConsultaName,
  extractSearchTerms,
  SPECIALTY_MAP
} from './specialty.utils.js';

describe('SpecialtyUtils', () => {
  describe('normalizeText', () => {
    it('should lower case and remove accents', () => {
      expect(normalizeText('CONSULTA EM ANGIOLOGIA')).toBe('consulta em angiologia');
      expect(normalizeText('Médico Cardiologista')).toBe('medico cardiologista');
      expect(normalizeText('Cirurgião Torácico')).toBe('cirurgiao toracico');
    });
  });

  describe('formatConsultaName', () => {
    it('should format correctly for known medical occupations', () => {
      const angio = formatConsultaName('Médico angiologista');
      expect(angio.especialidade).toBe('ANGIOLOGIA');
      expect(angio.nomeConsulta).toBe('CONSULTA EM ANGIOLOGIA');

      const cardio = formatConsultaName('Médico cardiologista');
      expect(cardio.especialidade).toBe('CARDIOLOGIA');
      expect(cardio.nomeConsulta).toBe('CONSULTA EM CARDIOLOGIA');

      const vascular = formatConsultaName('Médico em cirurgia vascular');
      expect(vascular.especialidade).toBe('CIRURGIA VASCULAR');
      expect(vascular.nomeConsulta).toBe('CONSULTA EM CIRURGIA VASCULAR');

      const dermato = formatConsultaName('Médico dermatologista');
      expect(dermato.especialidade).toBe('DERMATOLOGIA');
      expect(dermato.nomeConsulta).toBe('CONSULTA EM DERMATOLOGIA');

      const ped = formatConsultaName('Médico pediatra');
      expect(ped.especialidade).toBe('PEDIATRIA');
      expect(ped.nomeConsulta).toBe('CONSULTA EM PEDIATRIA');
    });

    it('should format non-medical health occupations', () => {
      const psi = formatConsultaName('Psicólogo clínico');
      expect(psi.especialidade).toBe('PSICOLOGIA');
      expect(psi.nomeConsulta).toBe('CONSULTA EM PSICOLOGIA');

      const fisio = formatConsultaName('Fisioterapeuta geral');
      expect(fisio.especialidade).toBe('FISIOTERAPIA');
      expect(fisio.nomeConsulta).toBe('CONSULTA EM FISIOTERAPIA');

      const nut = formatConsultaName('Nutricionista');
      expect(nut.especialidade).toBe('NUTRIÇÃO');
      expect(nut.nomeConsulta).toBe('CONSULTA EM NUTRIÇÃO');
    });

    it('should fall back heuristically for unmapped specialties', () => {
      const unmapped = formatConsultaName('Médico reumatologista');
      expect(unmapped.especialidade).toBe('REUMATOLOGIA');
      expect(unmapped.nomeConsulta).toBe('CONSULTA EM REUMATOLOGIA');
    });
  });

  describe('extractSearchTerms', () => {
    it('should extract terms for "CONSULTA EM ANGIOLOGIA"', () => {
      const result = extractSearchTerms('CONSULTA EM ANGIOLOGIA');
      expect(result.cleaned).toBe('angiologia');
      expect(result.isConsultationOrSpecialty).toBe(true);
      expect(result.stems).toContain('angiolog');
      expect(result.stems).toContain('angiologista');
    });

    it('should extract terms for "angiologia"', () => {
      const result = extractSearchTerms('angiologia');
      expect(result.cleaned).toBe('angiologia');
      expect(result.isConsultationOrSpecialty).toBe(true);
      expect(result.stems).toContain('angiologia');
      expect(result.stems).toContain('angiolog');
      expect(result.stems).toContain('angiologista');
    });

    it('should recognize CBO code', () => {
      const result = extractSearchTerms('225115');
      expect(result.isCboCode).toBe(true);
      expect(result.isConsultationOrSpecialty).toBe(true);
    });

    it('should recognize procedural 10-digit code', () => {
      const result = extractSearchTerms('0301010072');
      expect(result.isProcedimentoCode).toBe(true);
    });

    it('should distinguish general procedure search from specialty consultation', () => {
      const result = extractSearchTerms('HEMOGRAMA COMPLETO');
      expect(result.isConsultationOrSpecialty).toBe(false);
    });
  });
});
