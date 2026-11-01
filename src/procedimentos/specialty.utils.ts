export interface SpecialtyInfo {
  especialidade: string;
  nomeConsulta: string;
}

export function normalizeText(text: string): string {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Mapeamento das especialidades médicas e de saúde mais comuns do SUS/CBO
 * com sua respectiva especialidade e nome formatado para consultas.
 */
export const SPECIALTY_MAP: Record<string, SpecialtyInfo> = {
  // Médicos Clínicos
  'medico angiologista': { especialidade: 'ANGIOLOGIA', nomeConsulta: 'CONSULTA EM ANGIOLOGIA' },
  'medico cardiologista': { especialidade: 'CARDIOLOGIA', nomeConsulta: 'CONSULTA EM CARDIOLOGIA' },
  'medico cardiologista intervencionista': { especialidade: 'CARDIOLOGIA INTERVENCIONISTA', nomeConsulta: 'CONSULTA EM CARDIOLOGIA INTERVENCIONISTA' },
  'medico clinico': { especialidade: 'CLÍNICA MÉDICA', nomeConsulta: 'CONSULTA EM CLÍNICA MÉDICA' },
  'medico clinico geral': { especialidade: 'CLÍNICA MÉDICA', nomeConsulta: 'CONSULTA EM CLÍNICA MÉDICA' },
  'medico generalista': { especialidade: 'CLÍNICA GERAL', nomeConsulta: 'CONSULTA EM CLÍNICA GERAL' },
  'medico de familia e comunidade': { especialidade: 'MEDICINA DE FAMÍLIA E COMUNIDADE', nomeConsulta: 'CONSULTA EM MEDICINA DE FAMÍLIA E COMUNIDADE' },
  'medico da estrategia de saude da familia': { especialidade: 'SAÚDE DA FAMÍLIA', nomeConsulta: 'CONSULTA EM SAÚDE DA FAMÍLIA' },
  'medico dermatologista': { especialidade: 'DERMATOLOGIA', nomeConsulta: 'CONSULTA EM DERMATOLOGIA' },
  'medico endocrinologista e metabologista': { especialidade: 'ENDOCRINOLOGIA E METABOLOGIA', nomeConsulta: 'CONSULTA EM ENDOCRINOLOGIA' },
  'medico fisiatra': { especialidade: 'FISIATRIA', nomeConsulta: 'CONSULTA EM FISIATRIA' },
  'medico gastroenterologista': { especialidade: 'GASTROENTEROLOGIA', nomeConsulta: 'CONSULTA EM GASTROENTEROLOGIA' },
  'medico geneticista': { especialidade: 'GENÉTICA MÉDICA', nomeConsulta: 'CONSULTA EM GENÉTICA MÉDICA' },
  'medico geriatra': { especialidade: 'GERIATRIA', nomeConsulta: 'CONSULTA EM GERIATRIA' },
  'medico ginecologista e obstetra': { especialidade: 'GINECOLOGIA E OBSTETRÍCIA', nomeConsulta: 'CONSULTA EM GINECOLOGIA E OBSTETRÍCIA' },
  'medico hematologista': { especialidade: 'HEMATOLOGIA', nomeConsulta: 'CONSULTA EM HEMATOLOGIA' },
  'medico homeopata': { especialidade: 'HOMEOPATIA', nomeConsulta: 'CONSULTA EM HOMEOPATIA' },
  'medico infectologista': { especialidade: 'INFECTOLOGIA', nomeConsulta: 'CONSULTA EM INFECTOLOGIA' },
  'medico mastologista': { especialidade: 'MASTOLOGIA', nomeConsulta: 'CONSULTA EM MASTOLOGIA' },
  'medico nefrologista': { especialidade: 'NEFROLOGIA', nomeConsulta: 'CONSULTA EM NEFROLOGIA' },
  'medico neurologista': { especialidade: 'NEUROLOGIA', nomeConsulta: 'CONSULTA EM NEUROLOGIA' },
  'medico obstetra': { especialidade: 'OBSTETRÍCIA', nomeConsulta: 'CONSULTA EM OBSTETRÍCIA' },
  'medico oftalmologista': { especialidade: 'OFTALMOLOGIA', nomeConsulta: 'CONSULTA EM OFTALMOLOGIA' },
  'medico oncologista clinico': { especialidade: 'ONCOLOGIA CLÍNICA', nomeConsulta: 'CONSULTA EM ONCOLOGIA CLÍNICA' },
  'medico cancerologista': { especialidade: 'ONCOLOGIA', nomeConsulta: 'CONSULTA EM ONCOLOGIA' },
  'medico cancerologista pediatrico': { especialidade: 'ONCOLOGIA PEDIÁTRICA', nomeConsulta: 'CONSULTA EM ONCOLOGIA PEDIÁTRICA' },
  'medico pediatra': { especialidade: 'PEDIATRIA', nomeConsulta: 'CONSULTA EM PEDIATRIA' },
  'medico pneumologista': { especialidade: 'PNEUMOLOGIA', nomeConsulta: 'CONSULTA EM PNEUMOLOGIA' },
  'medico proctologista': { especialidade: 'COLOPROCTOLOGIA', nomeConsulta: 'CONSULTA EM COLOPROCTOLOGIA' },
  'medico coloproctologista': { especialidade: 'COLOPROCTOLOGIA', nomeConsulta: 'CONSULTA EM COLOPROCTOLOGIA' },
  'medico psiquiatra': { especialidade: 'PSIQUIATRIA', nomeConsulta: 'CONSULTA EM PSIQUIATRIA' },
  'medico psiquiatra da infancia e da adolescencia': { especialidade: 'PSIQUIATRIA INFANTIL', nomeConsulta: 'CONSULTA EM PSIQUIATRIA INFANTIL' },
  'medico radiologista': { especialidade: 'RADIOLOGIA', nomeConsulta: 'CONSULTA EM RADIOLOGIA' },
  'medico radiologista e diagnosticador por imagem': { especialidade: 'RADIOLOGIA E DIAGNÓSTICO POR IMAGEM', nomeConsulta: 'CONSULTA EM RADIOLOGIA' },
  'medico radioterapeuta': { especialidade: 'RADIOTERAPIA', nomeConsulta: 'CONSULTA EM RADIOTERAPIA' },
  'medico reumatologista': { especialidade: 'REUMATOLOGIA', nomeConsulta: 'CONSULTA EM REUMATOLOGIA' },
  'medico sanitarista': { especialidade: 'SAÚDE COLETIVA', nomeConsulta: 'CONSULTA EM SAÚDE COLETIVA' },
  'medico urologista': { especialidade: 'UROLOGIA', nomeConsulta: 'CONSULTA EM UROLOGIA' },
  'medico acupunturista': { especialidade: 'ACUPUNTURA', nomeConsulta: 'CONSULTA EM ACUPUNTURA' },
  'medico alergista e imunologista': { especialidade: 'ALERGIA E IMUNOLOGIA', nomeConsulta: 'CONSULTA EM ALERGIA E IMUNOLOGIA' },
  'medico anestesiologista': { especialidade: 'ANESTESIOLOGIA', nomeConsulta: 'CONSULTA EM ANESTESIOLOGIA' },
  'medico do trabalho': { especialidade: 'MEDICINA DO TRABALHO', nomeConsulta: 'CONSULTA EM MEDICINA DO TRABALHO' },
  'medico do trafego': { especialidade: 'MEDICINA DO TRÁFEGO', nomeConsulta: 'CONSULTA EM MEDICINA DO TRÁFEGO' },
  'medico em medicina intensiva': { especialidade: 'MEDICINA INTENSIVA', nomeConsulta: 'CONSULTA EM MEDICINA INTENSIVA' },
  'medico intensivista': { especialidade: 'MEDICINA INTENSIVA', nomeConsulta: 'CONSULTA EM MEDICINA INTENSIVA' },
  'medico legista': { especialidade: 'MEDICINA LEGAL', nomeConsulta: 'CONSULTA EM MEDICINA LEGAL' },
  'medico nuclear': { especialidade: 'MEDICINA NUCLEAR', nomeConsulta: 'CONSULTA EM MEDICINA NUCLEAR' },
  'medico nutrologo': { especialidade: 'NUTROLOGIA', nomeConsulta: 'CONSULTA EM NUTROLOGIA' },
  'medico patologista': { especialidade: 'PATOLOGIA', nomeConsulta: 'CONSULTA EM PATOLOGIA' },
  'medico patologista clinico / medicina laboratorial': { especialidade: 'PATOLOGIA CLÍNICA', nomeConsulta: 'CONSULTA EM PATOLOGIA CLÍNICA' },

  // Médicos Cirurgiões
  'medico cirurgiao cardiovascular': { especialidade: 'CIRURGIA CARDIOVASCULAR', nomeConsulta: 'CONSULTA EM CIRURGIA CARDIOVASCULAR' },
  'medico cirurgiao de cabeca e pescoco': { especialidade: 'CIRURGIA DE CABEÇA E PESCOÇO', nomeConsulta: 'CONSULTA EM CIRURGIA DE CABEÇA E PESCOÇO' },
  'medico cirurgiao do aparelho digestivo': { especialidade: 'CIRURGIA DO APARELHO DIGESTIVO', nomeConsulta: 'CONSULTA EM CIRURGIA DO APARELHO DIGESTIVO' },
  'medico cirurgiao geral': { especialidade: 'CIRURGIA GERAL', nomeConsulta: 'CONSULTA EM CIRURGIA GERAL' },
  'medico cirurgiao pediatrico': { especialidade: 'CIRURGIA PEDIÁTRICA', nomeConsulta: 'CONSULTA EM CIRURGIA PEDIÁTRICA' },
  'medico cirurgiao plastico': { especialidade: 'CIRURGIA PLÁSTICA', nomeConsulta: 'CONSULTA EM CIRURGIA PLÁSTICA' },
  'medico cirurgiao toracico': { especialidade: 'CIRURGIA TORÁCICA', nomeConsulta: 'CONSULTA EM CIRURGIA TORÁCICA' },
  'medico cirurgiao da mao': { especialidade: 'CIRURGIA DA MÃO', nomeConsulta: 'CONSULTA EM CIRURGIA DA MÃO' },
  'medico cirurgiao vascular': { especialidade: 'CIRURGIA VASCULAR', nomeConsulta: 'CONSULTA EM CIRURGIA VASCULAR' },
  'medico em cirurgia vascular': { especialidade: 'CIRURGIA VASCULAR', nomeConsulta: 'CONSULTA EM CIRURGIA VASCULAR' },
  'medico em cirurgia geral': { especialidade: 'CIRURGIA GERAL', nomeConsulta: 'CONSULTA EM CIRURGIA GERAL' },
  'medico neurocirurgiao': { especialidade: 'NEUROCIRURGIA', nomeConsulta: 'CONSULTA EM NEUROCIRURGIA' },
  'medico ortopedista e traumatologista': { especialidade: 'ORTOPEDIA E TRAUMATOLOGIA', nomeConsulta: 'CONSULTA EM ORTOPEDIA E TRAUMATOLOGIA' },
  'medico otorrinolaringologista': { especialidade: 'OTORRINOLARINGOLOGIA', nomeConsulta: 'CONSULTA EM OTORRINOLARINGOLOGIA' },

  // Outros Profissionais de Nível Superior da Saúde (Exceto Médico)
  'psicologo clinico': { especialidade: 'PSICOLOGIA', nomeConsulta: 'CONSULTA EM PSICOLOGIA' },
  'psicologo': { especialidade: 'PSICOLOGIA', nomeConsulta: 'CONSULTA EM PSICOLOGIA' },
  'fisioterapeuta geral': { especialidade: 'FISIOTERAPIA', nomeConsulta: 'CONSULTA EM FISIOTERAPIA' },
  'fisioterapeuta': { especialidade: 'FISIOTERAPIA', nomeConsulta: 'CONSULTA EM FISIOTERAPIA' },
  'nutricionista': { especialidade: 'NUTRIÇÃO', nomeConsulta: 'CONSULTA EM NUTRIÇÃO' },
  'fonoaudiologo': { especialidade: 'FONOAUDIOLOGIA', nomeConsulta: 'CONSULTA EM FONOAUDIOLOGIA' },
  'assistente social': { especialidade: 'SERVIÇO SOCIAL', nomeConsulta: 'CONSULTA EM SERVIÇO SOCIAL' },
  'terapeuta ocupacional': { especialidade: 'TERAPIA OCUPACIONAL', nomeConsulta: 'CONSULTA EM TERAPIA OCUPACIONAL' },
  'enfermeiro': { especialidade: 'ENFERMAGEM', nomeConsulta: 'CONSULTA DE ENFERMAGEM' },
  'enfermeiro obstetra': { especialidade: 'ENFERMAGEM OBSTÉTRICA', nomeConsulta: 'CONSULTA DE ENFERMAGEM OBSTÉTRICA' },
  'cirurgiao dentista': { especialidade: 'ODONTOLOGIA', nomeConsulta: 'CONSULTA EM ODONTOLOGIA' },
  'cirurgiao dentista - clinico geral': { especialidade: 'ODONTOLOGIA', nomeConsulta: 'CONSULTA EM ODONTOLOGIA' }
};

/**
 * Formata o nome específico da consulta a partir do nome da ocupação (CBO).
 */
export function formatConsultaName(nomeOcupacao: string, _nomeProcedimento?: string): SpecialtyInfo {
  const norm = normalizeText(nomeOcupacao);
  if (SPECIALTY_MAP[norm]) {
    return SPECIALTY_MAP[norm];
  }

  // Tenta correspondência parcial no mapa
  for (const [key, val] of Object.entries(SPECIALTY_MAP)) {
    if (norm.includes(key) || key.includes(norm)) {
      return val;
    }
  }

  // Dedução algorítmica caso seja uma ocupação não mapeada explicitamente
  let cleaned = norm.replace(/^medico\s+(em\s+|de\s+|da\s+)?/, '').trim();
  let esp = '';

  if (cleaned.endsWith('logista')) {
    esp = cleaned.slice(0, -4) + 'ia';
  } else if (cleaned.endsWith('logia')) {
    esp = cleaned;
  } else if (cleaned.endsWith('iatra')) {
    esp = cleaned.slice(0, -4) + 'iatria';
  } else if (cleaned.endsWith('iatria')) {
    esp = cleaned;
  } else if (cleaned.endsWith('terapeuta')) {
    esp = cleaned.slice(0, -4) + 'ia';
  } else if (cleaned.endsWith('ista')) {
    esp = cleaned.slice(0, -4) + 'ia';
  } else {
    esp = cleaned;
  }

  esp = esp.toUpperCase();
  return {
    especialidade: esp,
    nomeConsulta: `CONSULTA EM ${esp}`
  };
}

export interface SearchTermAnalysis {
  original: string;
  normalized: string;
  cleaned: string;
  stems: string[];
  isConsultationOrSpecialty: boolean;
  isCboCode: boolean;
  isProcedimentoCode: boolean;
}

/**
 * Analisa a string de busca e extrai variações linguísticas (stems, especialidades, termos CBO).
 */
export function extractSearchTerms(search: string): SearchTermAnalysis {
  const original = search || '';
  const normalized = normalizeText(original);

  const isProcedimentoCode = /^\d{10}$/.test(normalized.replace(/\D/g, '')) && normalized.replace(/\D/g, '').length === 10;
  const isCboCode = /^\d{4,6}$/.test(normalized.replace(/\D/g, '')) && !isProcedimentoCode;

  // Remove prefixos comuns de consulta para achar a especialidade
  let cleaned = normalized
    .replace(/\bconsulta\s+(medica\s+)?(em\s+|de\s+|da\s+|do\s+)?/gi, '')
    .trim();

  // Se sobrou apenas palavras vazias
  if (cleaned === 'consulta' || cleaned === 'consultas' || cleaned === 'medica') {
    cleaned = '';
  }

  const stems = new Set<string>();

  if (cleaned.length >= 3) {
    stems.add(cleaned);

    // Variações logia / logista (ex: angiologia <-> angiologista)
    if (cleaned.endsWith('logia')) {
      const root = cleaned.slice(0, -2); // angiolog
      stems.add(root);
      stems.add(root + 'ista'); // angiologista
    } else if (cleaned.endsWith('logista')) {
      const root = cleaned.slice(0, -4); // angiolog
      stems.add(root);
      stems.add(root + 'ia'); // angiologia
    }
    // Variações atria / atra (ex: pediatria <-> pediatra)
    else if (cleaned.endsWith('atria')) {
      const root = cleaned.slice(0, -5);
      stems.add(root + 'atr');
      stems.add(root + 'atra');
    } else if (cleaned.endsWith('atra')) {
      const root = cleaned.slice(0, -4);
      stems.add(root + 'atr');
      stems.add(root + 'atria');
    }
    // Variações terapia / terapeuta (ex: fisioterapia <-> fisioterapeuta)
    else if (cleaned.endsWith('terapia')) {
      stems.add(cleaned.slice(0, -2));
      stems.add(cleaned.slice(0, -2) + 'uta');
    } else if (cleaned.endsWith('terapeuta')) {
      stems.add(cleaned.slice(0, -4));
      stems.add(cleaned.slice(0, -4) + 'ia');
    }
    // Variações cirurgia / cirurgião
    else if (cleaned.includes('cirurgia')) {
      stems.add(cleaned.replace('cirurgia', 'cirurgiao'));
    } else if (cleaned.includes('cirurgiao')) {
      stems.add(cleaned.replace('cirurgiao', 'cirurgia'));
    }
    // Nutrição
    else if (cleaned.includes('nutric')) {
      stems.add('nutric');
      stems.add('nutricionista');
    }

    // Raiz geral para ista / ia
    if (cleaned.endsWith('ista')) {
      stems.add(cleaned.slice(0, -4) + 'ia');
    } else if (cleaned.endsWith('ia')) {
      stems.add(cleaned.slice(0, -2) + 'ista');
    }
  }

  // Verifica se o termo parece ser uma busca por consulta ou especialidade
  const hasConsultaPrefix = /\bconsulta\b/i.test(original);
  const matchesKnownSpecialty = Array.from(stems).some(s => {
    return Object.keys(SPECIALTY_MAP).some(k => k.includes(s) || SPECIALTY_MAP[k].especialidade.toLowerCase().includes(s));
  });

  const isConsultationOrSpecialty =
    hasConsultaPrefix ||
    matchesKnownSpecialty ||
    isCboCode ||
    (cleaned.length >= 4 && (
      cleaned.endsWith('logia') ||
      cleaned.endsWith('logista') ||
      cleaned.endsWith('iatria') ||
      cleaned.endsWith('atra') ||
      cleaned.endsWith('terapia')
    ));

  return {
    original,
    normalized,
    cleaned,
    stems: Array.from(stems),
    isConsultationOrSpecialty,
    isCboCode,
    isProcedimentoCode
  };
}
