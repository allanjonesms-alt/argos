import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Copy, Check, BookOpen, MessageSquare, RefreshCw, Send, AlertTriangle, ShieldCheck, FileText, Plus, Lightbulb, CheckCircle, ClipboardList } from 'lucide-react';
import { User, UserRole } from '../types';
import { GoogleGenAI } from '@google/genai';
import { db, logAction } from '../firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import TacticalAlert from '../components/TacticalAlert';

interface RoAssistantProps {
  user: User | null;
}

interface ChecklistItem {
  id: string;
  label: string;
  tooltip: string;
  regex: RegExp;
  suggestion: string;
}

const NARRATIVE_REQUIREMENTS: ChecklistItem[] = [
  {
    id: 'acionamento',
    label: 'Acionamento / Inicial',
    tooltip: 'Como a guarnição policial tomou ciência da ocorrência ou iniciou a ação',
    regex: /patrulha|acionad|ciops|copom|designad|equipe se|solicitad|via r[áa]dio|deparou/i,
    suggestion: 'ESTA EQUIPE POLICIAL EM PATRULHAMENTO OSTENSIVO PREVENTIVO SE DEPAROU COM '
  },
  {
    id: 'abordagem',
    label: 'Abordagem / Busca',
    tooltip: 'Indicação de busca pessoal do suspeito ou busca veicular no local',
    regex: /aborda|busca|pesquis|posse|encontrad|apreend|revist|revelou/i,
    suggestion: 'E PROCEDIDA À BUSCA PESSOAL E VEICULAR DE ACORDO COM O PROCEDIMENTO PADRÃO, SENDO LOCALIZADO '
  },
  {
    id: 'algemas',
    label: 'Uso de Algemas (SV 11)',
    tooltip: 'Justificativa legal do uso de algemas em consonância com a Súmula Vinculante 11',
    regex: /algem|amarr|resist|agress|fuga|integridade|contid/i,
    suggestion: 'FOI EMPREGADO O USO DE ALGEMAS EM RAZÃO DE COMPORTAMENTO REBELDE/RESISTÊNCIA E FUNDADO RECEIO DE FUGA, PRESERVANDO A INTEGRIDADE FÍSICA '
  },
  {
    id: 'direitos',
    label: 'Direitos (Advertência)',
    tooltip: 'Advertência quanto aos direitos constitucionais do detido (incluindo silêncio)',
    regex: /direito|constituc|sil[eê]ncio|permanecer/i,
    suggestion: 'FORAM DEVIDAMENTE APRESENTADOS E LIDOS OS DIREITOS CONSTITUCIONAIS AO CONDUZIDO, INCLUINDO O DIREITO DE PERMANECER EM SILÊNCIO '
  },
  {
    id: 'saude',
    label: 'Estado de Saúde / Lesões',
    tooltip: 'Registro sobre a presença ou integridade corporal das partes',
    regex: /les[ãa]o|lesoes|machuc|íntegr|sa[úu]de|upa|m[eé]dic|escoria/i,
    suggestion: 'O ENVOLVIDO FOI CONDUZIDO INTEGRALMENTE SEM LESÕES CORPORAIS VISÍVEIS '
  },
  {
    id: 'destino',
    label: 'Destino / Condução',
    tooltip: 'Delegacia para onde as partes e objetos foram encaminhados',
    regex: /delegac|depac|distrito|entreg|apresent|provid[êe]ncia/i,
    suggestion: 'E CONDUZIDO À DELEGACIA DE POLÍCIA CIVIL PARA AS PROVIDÊNCIAS CABÍVEIS '
  }
];

interface OccurrenceTemplate {
  id: string;
  label: string;
  defaultNature: string;
  structure: string[];
  referenceModel: string;
  referenceModels?: string[];
  stepRegexes?: RegExp[];
  stepSuggestions?: string[];
  presetData?: {
    cidade?: string;
    endereco?: string;
    vtr?: string;
    equipe?: string;
    rawText?: string;
  };
}

const OCCURRENCE_TEMPLATES: OccurrenceTemplate[] = [
  {
    id: 'ameaca',
    label: 'Ameaça / Perturbação',
    defaultNature: 'AMEAÇA',
    structure: [
      "1. ACIONAMENTO: Viatura, composição da equipe policial militar e forma de acionamento.",
      "2. CONTATO COM A VÍTIMA: Relato detalhado do fato gerador, ameaças sofridas e ofensas verbais.",
      "3. TESTEMUNHA(S): Identificação e qualificação de quem presenciou o ocorrido (se houver).",
      "4. SUSPEITO / AUTOR: Constatação de embriaguez, agressividade, revista pessoal, arma branca/de fogo e busca de ilícitos.",
      "5. MEDIDAS LEGAIS: Representação expressa da vítima (se aplicável), voz de prisão ou abordagem, direitos constitucionais e justificativa de algemas.",
      "6. FECHAMENTO: Encaminhamento da ocorrência à Delegacia de Polícia Civil, estado físico do conduzido e apreensão de objetos."
    ],
    stepRegexes: [
      /patrulha|acionad|copom|vtr|viatura/i,
      /contato|vítima|solicitante|relatou|maria|rosalina/i,
      /testemunha|presenciou|ronaldo/i,
      /autor|suspeito|sinais|embriaguez|agressiv|revista|faca/i,
      /manifest|represent|prisão|voz|direitos|silêncio/i,
      /conduzido|entregue|delegacia|lesões/i
    ],
    stepSuggestions: [
      'ESTA EQUIPE POLICIAL MILITAR, COMPOSTA PELO CABO PM HELENILSO E PELO SOLDADO PM ALBERT, A BORDO DA VIATURA 10-3355, FOI ACIONADA PARA ATENDER UMA OCORRÊNCIA DE AMEAÇA E PERTURBAÇÃO DO SOSSEGO NA RUA ARMANDO FERNANDES DE SOUZA, NO MUNICÍPIO DE ALCINÓPOLIS. ',
      'NO LOCAL, A EQUIPE MANTEVE CONTATO COM A VÍTIMA, A SENHORA ROSALINA LOPES ECHEVERRIA, QUE RELATOU QUE SEU VIZINHO, O SENHOR SIDNEY LOPES DA SILVA, PASSOU A PROFERIR AMEAÇAS DE MORTE CONTRA ELA E CONTRA O SEU ANIMAL DE ESTIMAÇÃO, ALÉM DE PROFERIR OFENSAS E PALAVRAS DE BAIXO CALÃO. ',
      'A TESTEMUNHA, SENHOR RONALDO MOREIRA PRADO, PRESENCIOU AS OFENSAS E AS AMEAÇAS PROFERIDAS PELO AUTOR, SENDO DEVIDAMENTE QUALIFICADA NO LOCAL. ',
      'O AUTOR APRESENTAVA SINAIS VISÍVEIS DE EMBRIAGUEZ, COMO FALA PASTOSA E AGRESSIVIDADE VERBAL. FOI REALIZADA REVISTA PESSOAL NO INDIVÍDUO, PORÉM NENHUM OBJETO ILÍCITO OU ARMA FOI ENCONTRADO EM SUA POSSE DIRETA. ',
      'DIANTE DA MANIFESTAÇÃO EXPRESSA DA VÍTIMA EM REPRESENTAR CRIMINALMENTE CONTRA O AUTOR, FOI DADA VOZ DE PRISÃO AO MESMO, SENDO LIDOS SEUS DIREITOS CONSTITUCIONAIS, INCLUINDO O DE PERMANECER EM SILÊNCIO. ',
      'O AUTOR FOI CONDUZIDO NO COMPARTIMENTO DE PRESOS DA VIATURA ATÉ A DELEGACIA DE POLÍCIA DE ALCINÓPOLIS PARA AS PROVIDÊNCIAS CABÍVEIS, SEM LESÕES CORPORAIS APARENTES E SEM NECESSIDADE DE USO DE ALGEMAS. '
    ],
    referenceModel: `ESTA EQUIPE POLICIAL MILITAR, COMPOSTA PELO CABO PM HELENILSO E PELO SOLDADO PM ALBERT, A BORDO DA VIATURA 10-3355, FOI ACIONADA PARA ATENDER UMA OCORRÊNCIA DE AMEAÇA E PERTURBAÇÃO DO SOSSEGO NA RUA ARMANDO FERNANDES DE SOUZA, NO MUNICÍPIO DE ALCINÓPOLIS. NO LOCAL, A EQUIPE MANTEVE CONTATO COM A VÍTIMA, A SENHORA ROSALINA LOPES ECHEVERRIA, QUE RELATOU QUE SEU ANIMAL DE ESTIMAÇÃO (CACHORRO) ESCAPOU DA GARAGEM E SE APROXIMOU DO SENHOR SIDNEY LOPES DA SILVA. SEGUNDO A VÍTIMA, NESSE MOMENTO, SIDNEY PASSOOU A PROFERIR AMEAÇAS DE MORTE CONTRA ELA E CONTRA O ANIMAL, AFIRMANDO QUE POSSUÍA UMA ARMA DE FOGO E QUE ATIRARIA EM AMBOS. A SENHORA ROSALINA INFORMOU AINDA QUE O AUTOR A INJURIOU COM PALAVRAS DE BAIXO CALÃO, CHAMANDO-A DE "BURRA", "SEM VERGONHA", "PROSTITUTA" E "CORNA", INCLUSIVE NA PRESENÇA DE SEUS FILHOS. A VÍTIMA RELATOU QUE AS AMEAÇAS E A PERTURBAÇÃO DO SOSSEGO CAUSADA PELA EMBRIAGUEZ DO AUTOR SÃO RECORRENTES. O SENHOR RONALDO MOREIRA PRADO PRESENCIOU AS OFENSAS E AS AMEAÇAS, SENDO QUALIFICADO AS TESTEMUNHAS. O AUTOR, SIDNEY LOPES DA SILVA, APRESENTAVA SINAIS VISÍVEIS DE EMBRIAGUEZ, COMO FALA PASTOSA, DESORIENTAÇÃO E AGRESSIVIDADE VERBAL. FOI REALIZADA REVISTA PESSOAL NO INDIVÍDUO, PORÉM NENHUM OBJETO ILÍCITO OS ARMA FOI ENCONTRADO. SIDNEY, QUE FAZ USO DE TORNOZELEIRA ELETRÔNICA, APRESENTOU RESISTÊNCIA PASSIVA DURANTE A ABORDAGEM E PROFERIU PROVOCAÇÕES CONTRA A EQUIPE, ALEGRANDO QUE NÃO PODERIA SER DETIDO POIS SEUS FILHOS, MAIORES DE IDADE E COM NECESSIDADES ESPECIAIS, DEPENDIAM DE SEUS CUIDADOS. DIANTE DA MANIFESTAÇÃO EXPRESSA DA VÍTIMA EM REPRESENTAR CRIMINALMENTE CONTRA O AUTOR, FOI DADA VOZ DE PRISÃO A SIDNEY LOPES DA SILVA. SEUS DIREITOS CONSTITUCIONAIS FORAM LIDOS PELA EQUIPE POLICIAL. O AUTOR FOI CONDUZIDO NO COMPARTIMENTO DE PRESOS DA VIATURA ATÉ A DELEGACIA DE POLÍCIA DE ALCINÓPOLIS, ONDE FOI ENTREGUE AO INVESTIGADOR DE POLÍCIA JUDICIÁRIA GUEDES PARA AS PROVIDÊNCIAS CABÍVEIS. RESSALTA-SE QUE NÃO FOI NECESSÁRIO O USO DE ALGEMAS E QUE O CONDUZIDO ANRESENTAVA LESÕES CORPORAIS APARENTES.`,
    referenceModels: [
      `ESTA EQUIPE POLICIAL MILITAR, COMPOSTA PELO CABO PM HELENILSO E PELO SOLDADO PM ALBERT, A BORDO DA VIATURA 10-3355, FOI ACIONADA PARA ATENDER UMA OCORRÊNCIA DE AMEAÇA E PERTURBAÇÃO DO SOSSEGO NA RUA ARMANDO FERNANDES DE SOUZA, NO MUNICÍPIO DE ALCINÓPOLIS. NO LOCAL, A EQUIPE MANTEVE CONTATO COM A VÍTIMA, A SENHORA ROSALINA LOPES ECHEVERRIA, QUE RELATOU QUE SEU ANIMAL DE ESTIMAÇÃO (CACHORRO) ESCAPOU DA GARAGEM E SE APROXIMOU DO SENHOR SIDNEY LOPES DA SILVA. SEGUNDO A VÍTIMA, NESSE MOMENTO, SIDNEY PASSOOU A PROFERIR AMEAÇAS DE MORTE CONTRA ELA E CONTRA O ANIMAL, AFIRMANDO QUE POSSUÍA UMA ARMA DE FOGO E QUE ATIRARIA EM AMBOS. A SENHORA ROSALINA INFORMOU AINDA QUE O AUTOR A INJURIOU COM PALAVRAS DE BAIXO CALÃO, CHAMANDO-A DE "BURRA", "SEM VERGONHA", "PROSTITUTA" E "CORNA", INCLUSIVE NA PRESENÇA DE SEUS FILHOS. A VÍTIMA RELATOU QUE AS AMEAÇAS E A PERTURBAÇÃO DO SOSSEGO CAUSADA PELA EMBRIAGUEZ DO AUTOR SÃO RECORRENTES. O SENHOR RONALDO MOREIRA PRADO PRESENCIOU AS OFENSAS E AS AMEAÇAS, SENDO QUALIFICADO COMO TESTEMUNHA. O AUTOR, SIDNEY LOPES DA SILVA, APRESENTAVA SINAIS VISÍVEIS DE EMBRIAGUEZ, COMO FALA PASTOSA, DESORIENTAÇÃO E AGRESSIVIDADE VERBAL. FOI REALIZADA REVISTA PESSOAL NO INDIVÍDUO, PORÉM NENHUM OBJETO ILÍCITO OU ARMA FOI ENCONTRADO. SIDNEY, QUE FAZ USO DE TORNOZELEIRA ELETRÔNICA, APRESENTOU RESISTÊNCIA PASSIVA DURANTE A ABORDAGEM E PROFERIU PROVOCAÇÕES CONTRA A EQUIPE, ALEGRANDO QUE NÃO PODERIA SER DETIDO POIS SEUS FILHOS, MAIORES DE IDADE E COM NECESSIDADES ESPECIAIS, DEPENDIAM DE SEUS CUIDADOS. DIANTE DA MANIFESTAÇÃO EXPRESSA DA VÍTIMA EM REPRESENTAR CRIMINALMENTE CONTRA O AUTOR, FOI DADA VOZ DE PRISÃO A SIDNEY LOPES DA SILVA. SEUS DIREITOS CONSTITUCIONAIS FORAM LIDOS PELA EQUIPE POLICIAL. O AUTOR FOI CONDUZIDO NO COMPARTIMENTO DE PRESOS DA VIATURA ATÉ A DELEGACIA DE POLÍCIA DE ALCINÓPOLIS, ONDE FOI ENTREGUE AO INVESTIGADOR DE POLÍCIA JUDICIÁRIA GUEDES PARA AS PROVIDÊNCIAS CABÍVEIS. RESSALTA-SE QUE NÃO FOI NECESSÁRIO O USO DE ALGEMAS E QUE O CONDUZIDO NÃO APRESENTAVA LESÕES CORPORAIS APARENTES.`,
      `ESTA EQUIPE POLICIAL, COMPOSTA PELO SD PEDRO (COMANDANTE) E SD ROSSATTO (MOTORISTA), A BORDO DA VIATURA 10-3355, FOI ACIONADA POR SEGURANÇAS DE UMA FESTA LOCALIZADA NA AVENIDA DARLINDO JOSÉ CARNEIRO, NO MUNICÍPIO DE ALCINÓPOLIS, PARA PRESTAR APOIO EM UMA OCORRÊNCIA ENVOLVENDO UM INDIVÍDUO PORTANDO ARMA BRANCA. AO CHEGAR AO LOCAL, A GUARNIÇÃO VISUALIZOU O AUTOR, IDENTIFICADO COMO WILLIAM OSMAR CASCEMIRO DOS SANTOS (FILHO DE IRENE COSTA DOS SANTOS, RG 1985305 SSP/MS), JÁ CONTIDO PELOS SEGURANÇAS DO EVENTO. SEGUNDO OS RELATOS COLHIDOS, O AUTOR TERIA SE ENVOLVIDO EM UMA BRIGA COM UM INDIVÍDUO NÃO IDENTIFICADO E FOI FLAGRADO PORTANDO UMA FACA, SENDO IMEDIATAMENTE IMOBILIZADO PELOS FUNCIONÁRIOS DA SEGURANÇA PRIVADA. NO LOCAL, FOI ENTREGUE A ESTA EQUIPE UMA FACA DE APROXIMADAMENTE 30 CENTÍMETROS, COM CABO DE MADEIRA E PUNHO EM ESTILO SOCO INGLÊS, QUE ESTAVA EM POSSE DO AUTOR. WILLIAM APRESENTAVA VISÍVEL ESTADO DE EMBRIAGUEZ E FOI CONDUZIDO AO COMPARTIMENTO DE PRESOS DA VIATURA POLICIAL. DURANTE O TRAJETO PARA A DELEGACIA DE POLÍCIA, O AUTOR AGIU DE MANEIRA VIOLENTA, DESFERINDO CHUTES CONTRA A ESTRUTURA INTERNA DO COMPARTIMENTO DA VIATURA E PROFERINDO AMEAÇAS CONTRA OS POLICIAIS MILITARES, AFIRMANDO QUE, AO SER RETIRADO DO VEÍCULO, INVESTIRIA CONTRA A EQUIPE. O AUTOR UTILIZOU OS SEGUINTES TERMOS: "QUANDO EU SAIR DAQUI VOU ACABAR COM VOCÊS, SEUS BOSTA, SEUS PAU NO CU". RESSALTA-SE QUE O AUTOR NÃO APRESENTAVA LESÕES CORPORAIS E TEVE SEUS DIREITOS CONSTITUCIONAIS LIDOS PELA EQUIPE. DIANTE DOS FATOS, A OCORRÊNCIA FOI ENTREGUE NA DELEGACIA DE POLÍCIA DE ALCINÓPOLIS AO INVESTIGADOR GUEDES, JUNTAMENTE COM A FACA APREENDIDA, PARA AS PROVIDÊNCIAS LEGAIS.`
    ],
    presetData: {
      cidade: 'ALCINÓPOLIS',
      endereco: 'RUA ARMANDO FERNANDES DE SOUZA',
      vtr: '10-3355',
      equipe: 'CABO PM HELENILSO E SOLDADO PM ALBERT',
      rawText: `Esta equipe policial militar, composta pelo Cabo PM Helenilso e pelo Soldado PM Albert, a bordo da viatura 10-3355, foi acionada para atender uma ocorrência de ameaça e perturbação do sossego na Rua Armando Fernandes de Souza, no município de Alcinópolis. No local, a equipe manteve contato com a vítima, a senhora Rosalina Lopes Echeverria, que relatou que seu animal de estimação (cachorro) escapou da garagem e se aproximou do senhor Sidney Lopes da Silva. Segundo a vítima, nesse momento, Sidney passou a proferir ameaças de morte contra ela e contra o animal, afirmando que possuía uma arma de fogo e que atiraria em ambos. A senhora Rosalina informou ainda que o autor a injuriou com palavras de baixo calão, chamando-a de "burra", "sem vergonha", "prostituta" e "corna", inclusive na presença de seus filhos. A vítima relatou que as ameaças e a perturbação do sossego causada pela embriaguez do autor são recorrentes. O senhor Ronaldo Moreira Prado presenciou as ofensas e as ameaças, sendo qualificado como testemunha. O autor, Sidney Lopes da Silva, apresentava sinais visíveis de embriaguez, como fala pastosa, desorientação e agressividade verbal. Foi realizada revista pessoal no indivíduo, porém nenhum objeto ilícito ou arma foi encontrado. Sidney, que faz uso de tornozeleira eletrônica, apresentou resistência passiva durante a abordagem e proferiu provocações contra a equipe, alegando que não poderia ser detido pois seus filhos, maiores de idade e com necessidades especiais, dependiam de seus cuidados. Diante da manifestação expressa da vítima em representar criminalmente contra o autor, foi dada voz de prisão a Sidney Lopes da Silva. Seus direitos constitucionais foram lidos pela equipe policial. O autor foi conduzido no compartimento de presos da viatura até a Delegacia de Polícia de Alcinópolis, onde foi entregue ao Investigador de Polícia Judiciária Guedes para as providências cabíveis. Ressalta-se que não foi necessário o uso de algemas e que o conduzido não apresentava lesões corporais aparentes.`
    }
  },
  {
    id: 'trafico',
    label: 'Tráfico de Drogas',
    defaultNature: 'TRÁFICO DE DROGAS',
    structure: [
      "1. ACIONAMENTO: Patrulhamento ostensivo preventivo ou denúncia via Copom (atitude suspeita).",
      "2. ABORDAGEM: Reação do suspeito (nervosismo, tentativa de fuga ou descarte de entorpecentes).",
      "3. RECONSTITUIÇÃO DOS FATOS: Busca pessoal minuciosa, dinheiro fracionado, embalagens e drogas.",
      "4. PROCEDIMENTO PROCEDIMENTAL: Prisão em flagrante, direitos de silêncio lidos e uso justificado de algemas.",
      "5. ENCERRAMENTO: Destinação do entorpecente à Delegacia, pesagem preliminar e integridade física das partes."
    ],
    stepRegexes: [
      /patrulha|ostensivo|preventivo|deparou/i,
      /aborda|suspeito|nervos|fuga|descarte/i,
      /busca pessoal|revelou|posse|drog|maconha|invóluc|células|moed|dinheiro/i,
      /prisão|direitos|silêncio|voz de|algema/i,
      /conduzido|lesões|delegacia|entorpecente/i
    ],
    stepSuggestions: [
      'ESTA EQUIPE POLICIAL MILITAR, EM PATRULHAMENTO OSTENSIVO PREVENTIVO NA AVENIDA BRASIL, SE DEPAROU COM UM INDIVÍDUO EM ATITUDE SUSPEITA. ',
      'PROCEDIDA À ABORDAGEM DO INDIVÍDUO, ESTE APRESENTOU NERVOSISMO INCOMUM E TENTOU DESPISTAR A EQUIPE, SENDO IMEDIATAMENTE CONTIDO PARA BUSCA. ',
      'FOI REVELADA NA BUSCA PESSOAL A POSSE DE 12 INVÓLUCROS DE SUBSTÂNCIA ANÁLOGA À MACONHA E A QUANTIA DE R$ 150,00 EM CÉDULAS FRACIONADAS, ALÉM DE UM APARELHO CELULAR DE MARCA SAMSUNG. ',
      'DIANTE DOS FATOS, FOI DADA VOZ DE PRISÃO AO CONDUZIDO, SENDO-LHE DEVIDAMENTE APRESENTADOS E LIDOS OS DIREITOS CONSTITUCIONAIS, INCLUINDO O DE PERMANECER EM SILÊNCIO. FOI EMPREGADO O USO DE ALGEMAS EM RAZÃO DE COMPORTAMENTO AGRESSIVO E RISCO DE FUGA, PRESERVANDO A INTEGRIDADE FÍSICA DE TODOS. ',
      'O ENVOLVIDO FOI CONDUZIDO SEM LESÕES CORPORAIS VISÍVEIS À DELEGACIA DE POLÍCIA CIVIL JUNTAMENTE COM O ENTORPECENTE PARA AS PROVIDÊNCIAS CABÍVEIS. '
    ],
    referenceModel: `ESTA EQUIPE POLICIAL MILITAR, EM PATRULHAMENTO OSTENSIVO PREVENTIVO NA AVENIDA BRASIL, SE DEPAROU COM O AUTOR EM ATITUDE SUSPEITA. PROCEDIDA À ABORDAGEM DO INDIVÍDUO, FOI REVELADA NA BUSCA PESSOAL A POSSE DE 12 INVÓLUCROS DE SUBSTÂNCIA ANÁLOGA À MACONHA E A QUANTIA DE R$ 150,00 EM CÉDULAS FRACIONADAS, ALÉM DE UM APARELHO CELULAR DE MARCA SAMSUNG. INDAGADO, O AUTOR CONFESSOU A PRÁTICA DO TRÁFICO. DIANTE DOS FATOS, FOI DADA VOZ DE PRISÃO AO CONDUZIDO, SENDO-LHE DEVIDAMENTE APRESENTADOS E LIDOS OS DIREITOS CONSTITUCIONAIS, INCLUINDO O DE PERMANECER EM SILÊNCIO. FOI EMPREGADO O USO DE ALGEMAS EM RAZÃO DE COMPORTAMENTO AGRESSIVO E RISCO DE FUGA, PRESERVANDO A INTEGRIDADE FÍSICA DE TODOS. O ENVOLVIDO FOI CONDUZIDO SEM LESÕES CORPORAIS VISÍVEIS À DELEGACIA DE POLÍCIA CIVIL JUNTAMENTE COM O ENTORPECENTE PARA AS PROVIDÊNCIAS CABÍVEIS.`,
    presetData: {
      cidade: 'CAMPO GRANDE',
      endereco: 'AVENIDA BRASIL, 1500',
      vtr: '10-9988',
      equipe: 'CABO PM SOUZA E SOLDADO PM SILVA',
      rawText: `Esta equipe policial militar, em patrulhamento ostensivo preventivo na Avenida Brasil, se deparou com o autor em atitude suspeita. Procedida à abordagem do indivíduo, foi revelada na busca pessoal a posse de 12 invólucros de substância análoga à maconha e a quantia de R$ 150,00 em cédulas fracionadas, além de um aparelho celular de marca Samsung. Indagado, o autor confessou a prática do tráfico. Diante dos fatos, foi dada voz de prisão ao conduzido, sendo-lhe devidamente apresentados e lidos os direitos constitucionais, incluindo o de permanecer em silêncio. Foi empregado o uso de algemas em razão de comportamento agressivo e risco de fuga, preservando a inteintegrity física de todos. O envolvido foi conduzido sem lesões corporais visíveis à delegacia de polícia civil juntamente com o entorpecente para as providências cabíveis.`
    }
  },
  {
    id: 'violencia_domestica',
    label: 'Violência Doméstica',
    defaultNature: 'VIOLÊNCIA DOMÉSTICA',
    structure: [
      "1. ACIONAMENTO: Chamado de emergência de violência física ou psicológica em residência.",
      "2. NO LOCAL: Contato com a vítima, constatação das vias de fato, lesões corporais ou ameaça.",
      "3. MEDIDAS DE PROTEÇÃO: Separação física das partes, segurança e atendimento primário.",
      "4. PROCEDIMENTOS: Voz de prisão ao autor em flagrante de violência doméstica, direitos lidos.",
      "5. DESTINO: Encaminhamento à UPA se houver lesões, e entrega na Delegacia Especializada de Atendimento à Mulher (DEAM)."
    ],
    stepRegexes: [
      /acionada|copom|chamado|emergência/i,
      /contato|vítima|lesões|agredida|ameaçada/i,
      /separ|aborda|quintal|residência|segurança/i,
      /prisão|lei maria da penha|direitos|silêncio|algema/i,
      /upa|atendimento médico|conduzidas|delegacia|deam|providências/i
    ],
    stepSuggestions: [
      'ESTA EQUIPE POLICIAL MILITAR FOI ACIONADA VIA COPOM PARA ATENDER UMA OCORRÊNCIA DE VIOLÊNCIA DOMÉSTICA EM UMA RESIDÊNCIA LOCALIZADA NA RUA DOM AQUINO, NO MUNICÍPIO DE CORUMBÁ. ',
      'NO LOCAL, A EQUIPE MANTEVE CONTATO COM A VÍTIMA, QUE APRESENTAVA LESÕES CORPORAIS APARENTES E RELATOU TER SIDO AGREDIDA FISICAMENTE E AMEAÇADA DE MORTE PELO SEU COMPANHEIRO. ',
      'PROCEDIDA À ABORDAGEM E SEPARAÇÃO FÍSICA DOS ENVOLVIDOS, O INDIVÍDUO FOI LOCALIZADO NO QUINTAL DA RESIDÊNCIA E IMEDIATAMENTE CONTIDO PARA SEGURANÇA DE TODOS. ',
      'FOI DADA VOZ DE PRISÃO EM FLAGRANTE AO AUTOR DE ACORDO COM A LEI MARIA DA PENHA. FORAM DEVIDAMENTE APRESENTADOS OS DIREITOS CONSTITUCIONAIS AO CONDUZIDO, INCLUINDO O DIREITO DE PERMANECER EM SILÊNCIO. FOI EMPREGADO O USO DE ALGEMAS EM RAZÃO DA AGRESSIVIDADE DO AUTOR. ',
      'AS PARTES FORAM CONDUZIDAS PREVIAMENTE À UPA PARA ATENDIMENTO MÉDICO E EM SEGUIDA APRESENTADAS À DELEGACIA DE POLÍCIA CIVIL PARA PROVIDÊNCIAS CABÍVEIS. '
    ],
    referenceModel: `ESTA EQUIPE POLICIAL MILITAR FOI ACIONADA VIA COPOM PARA ATENDER UMA OCORRÊNCIA DE VIOLÊNCIA DOMÉSTICA. NO LOCAL, A EQUIPE MANTEVE CONTATO WITH THE VICTIM, QUE APRESENTAVA LESÕES CORPORAIS APARENTES E RELATOU TER SIDO AGREDIDA FISICAMENTE E AMEAÇADA DE MORTE PELO SEU COMPANHEIRO. PROCEDIDA À ABORDAGEM DO INDIVÍDUO NO QUINTAL DA RESIDÊNCIA, FOI DADA VOZ DE PRISÃO EM FLAGRANTE AO AUTOR DE ACORDO COM A LEI MARIA DA PENHA. FORAM DEVIDAMENTE APRESENTADOS OS DIREITOS CONSTITUCIONAIS AO CONDUZIDO, INCLUINDO O DIREITO DE PERMANECER EM SILÊNCIO. FOI EMPREGADO O USO DE ALGEMAS EM RAZÃO DA AGRESSIVIDADE DO AUTOR E FUNDADO RECEIO DE FUGA. AS PARTES FORAM CONDUZIDAS PREVIAMENTE À UPA PARA ATENDIMENTO MÉDICO E EM SEGUIDA APRESENTADAS À DELEGACIA DE POLÍCIA CIVIL PARA PROVIDÊNCIAS CABÍVEIS.`,
    presetData: {
      cidade: 'CORUMBÁ',
      endereco: 'RUA DOM AQUINO, 450',
      vtr: '10-4400',
      equipe: 'SARGENTO PM GOMES E CABO PM ROCHA',
      rawText: `Esta equipe policial militar foi acionada via Copom para atender uma ocorrência de violência doméstica. No local, a equipe manteve contato com a vítima, que apresentava lesões corporais aparentes e relatou ter sido agredida fisicamente e ameaçada de morte pelo seu companheiro. Procedida à abordagem do indivíduo no quintal da residência, foi dada voz de prisão em flagrante ao autor de acordo com a Lei Maria da Penha. Foram devidamente apresentados os direitos constitucionais ao conduzido, incluindo o direito de permanecer em silêncio. Foi empregado o uso de algemas em razão da agressividade do autor e fundado receio de fuga. As partes foram conduzidas previamente à UPA para atendimento médico e em seguida apresentadas à delegacia de polícia civil para providências cabíveis.`
    }
  },
  {
    id: 'violencia_domestica_lesao_ameaca',
    label: 'V. Doméstica (Lesão/Ameaça)',
    defaultNature: 'VIOLÊNCIA DOMÉSTICA',
    structure: [
      "1. ACIONAMENTO: Viatura, composição da equipe policial militar, qualificação do solicitante (ex: filho adolescente) e forma de acionamento.",
      "2. NO LOCAL / CONSTATAÇÃO: Contato com as partes (vítima e autor), histórico de discussão verbal com ofensas de baixo calão e agressão física recíproca (uso de faca e pedaço de madeira).",
      "3. LESÕES E ESTADO DAS PARTES: Detalhamento de hematomas, cortes superficiais, escoriações e sinais visíveis de embriaguez.",
      "4. CONTEXTO E ACESSO DOMICILIAR: Histórico de violência recorrente e autorização expressa para entrada na residência.",
      "5. APREENSÃO E DILIGÊNCIAS: Realização de buscas na residência e matagal à procura dos objetos do crime (pedaço de madeira e faca arremessada).",
      "6. PRISÃO, CONDUÇÃO E TRATAMENTO: Voz de prisão aos envolvidos, direitos constitucionais, transporte diferenciado na viatura, ameaças no trajeto, atendimento médico e entrega na Delegacia."
    ],
    stepRegexes: [
      /composta|acionada|viatura|solicitação|riquelme/i,
      /local|constatou|discussão|injuriada|madeira|faca|agredi/i,
      /lesão|hematoma|escoriações|corte|sangramento|embriaguez|fala|etílico/i,
      /anterior|semelhante|entrada|autorizada|proprietário|tibúrcio/i,
      /buscas|procura|localizados|descarte|matagal|sumiu/i,
      /prisão|direitos|conduzido|trajeto|ameaças|hospital|atendimento|delegacia/i
    ],
    stepSuggestions: [
      'ESTA EQUIPE POLICIAL, COMPOSTA PELO 3º SGT SILVÉRIO, SD EDUARDA OLIVEIRA E SD ALBERT (MOTORISTA), NA VIATURA 10-3355, FOI ACIONADA VIA SOLICITAÇÃO DO ADOLESCENTE RIQUELME SAMUEL RIBEIRO DA SILVA, FILHO DA SENHORA LUZIA RIBEIRO DOS SANTOS, PARA ATENDER UMA OCORRÊNCIA DE VIOLÊNCIA DOMÉSTICA NA RUA URSINO COELHO DE SOUZA, NO MUNICÍPIO DE ALCINÓPOLIS. ',
      'AO CHEGAR AO ENDEREÇO, A EQUIPE CONSTATOU UMA DISCUSSÃO ENTRE O CASAL LUZIA RIBEIRO DOS SANTOS E TIBÚRCIO MARTINS PEREIRA. CONFORME O RELATO DE LUZIA, APÓS RETORNAR PARA SUA RESIDÊNCIA, ELA FOI INJURIADA POR TIBÚRCIO COM PALAVRAS DE BAIXO CALÃO E QUE AO REBATER AS OFENSAS, O INDIVÍDUO UTILIZOU UM PEDAÇO DE MADEIRA PARA AGREDI-LA, SENDO QUE LUZIA REBATEU DESFERINDO GOLPES DE FACA CONTRA ELE. ',
      'DURANTE A AVERIGUAÇÃO, FOI OBSERVADO QUE LUZIA APRESENTAVA HEMATOMAS NOS BRAÇOS E ANTEBRAÇOS, ALÉM DE UM FERIMENTO SUPERFICIAL NO NARIZ. TIBÚRCIO APRESENTAVA LESÃO SUPERFICIAL NO COURO CABELUDO COM VESTÍGIOS DE SANGRAMENTO E ESCORIAÇÕES NO TÓRAX COM SANGRAMENTO, E UM CORTE SUPERFICIAL NO ANTEBRAÇO ESQUERDO, AS QUAIS ELE ATRIBUIU ÀS FACADAS. AMBOS APRESENTAVAM SINAIS VISÍVEIS DE EMBRIAGUEZ, COM FALA ARRASTADA E ODOR ETÍLICO. ',
      'A VÍTIMA LUZIA AFIRMOU QUE FATOS SEMELHANTES JÁ OCORRERAM ENTRE O CASAL EM DATAS ANTERIORES. A ENTRADA NA RESIDÊNCIA FOI EXPRESSAMENTE AUTORIZADA PELO PROPRIETÁRIO, O SENHOR TIBÚRCIO. ',
      'A EQUIPE REALIZOU BUSCAS NO LOCAL, CONTUDO, NEM A FACA NEM O PEDAÇO DE MADEIRA UTILIZADOS NAS AGRESSÕES RECÍPROCAS FORAM LOCALIZADOS, SENDO QUE POSTERIORMENTE LUZIA RELATOU QUE SUMIU COM A FACA TENDO A ARREMESSADO EM UM MATAGAL NAS PROXIMIDADES. ',
      'DIANTE DOS FATOS, FOI PROFERIDA VOZ DE PRISÃO AOS ENVOLVIDOS E REALIZADA A LEITURA DE SEUS DIREITOS CONSTITUCIONAIS. TIBÚRCIO FOI CONDUZIDO NO COMPARTIMENTO DE PRESOS DA VIATURA, ENQUANTO LUZIA FOI TRANSPORTADA NO INTERIOR DO VEÍCULO. DURANTE O TRAJETO, LUZIA PROFERIU AMEAÇAS DE MORTE CONTRA TIBÚRCIO. AMBOS FORAM ENCAMINHADOS INICIALMENTE AO HOSPITAL PARA ATENDIMENTO MÉDICO E, DEPOIS, ENTREGUES NA DELEGACIA DE POLÍCIA CIVIL DE ALCINÓPOLIS. '
    ],
    referenceModel: `ESTA EQUIPE POLICIAL, COMPOSTA PELO 3º SGT SILVÉRIO, SD EDUARDA OLIVEIRA E SD ALBERT (MOTORISTA), NA VIATURA 10-3355, FOI ACIONADA VIA SOLICITAÇÃO DO ADOLESCENTE RIQUELME SAMUEL RIBEIRO DA SILVA, FILHO DA SENHORA LUZIA RIBEIRO DOS SANTOS, PARA ATENDER UMA OCORRÊNCIA DE VIOLÊNCIA DOMÉSTICA NA RUA URSINO COELHO DE SOUZA (CASA DO TIBÚRCIO), NO MUNICÍPIO DE ALCINÓPOLIS. AO CHEGAR AO ENDEREÇO, A EQUIPE CONSTATOU UMA DISCUSSÃO ENTRE O CASAL LUZIA RIBEIRO DOS SANTOS E TIBÚRCIO MARTINS PEREIRA. CONFORME O RELATO DE LUZIA, APÓS RETORNAR PARA SUA RESIDÊNCIA, ELA FOI INJURIADA POR TIBÚRCIO COM PALAVRAS DE BAIXO CALÃO E QUE AO REBATER AS OFENSAS, O INDIVÍDUO UTILIZOU UM PEDAÇO DE MADEIRA PARA AGREDI-LA. EM RESPOSTA À AGRESSÃO, LUZIA CONFESSOU TER SE APOSSADO DE UMA FACA E DESFERIDO GOLPES CONTRA TIBÚRCIO, ATINGINDO-O SUPERFICIALMENTE EM DIVERSAS PARTES DO CORPO. DURANTE A AVERIGUAÇÃO, FOI OBSERVADO QUE LUZIA APRESENTAVA HEMATOMAS NOS BRAÇOS E ANTEBRAÇOS, ALÉM DE UM FERIMENTO SUPERFICIAL NA REGIÃO DO NARIZ. TIBÚRCIO APRESENTAVA LESÃO SUPERFICIAL NO COURO CABELUDO COM VESTÍGIOS DE SANGRAMENTO E ESCORIAÇÕES NO TÓRAX COM SANGRAMENTO, AINDA UM CORTE SUPERFICIAL NO ANTEBRAÇO ESQUERDO, AS QUAIS ELE ATRIBUIU ÀS FACADAS DESFERIDAS PELA SUA COMPANHEIRA LUZIA. NOTOU-SE, AINDA, QUE AMBOS APRESENTAVAM SINAIS VISÍVEIS DE EMBRIAGUEZ, CARACTERIZADOS POR FALA ARRASTADA E ODOR ETÍLICO. LUZIA AINDA AFIRMOU QUE FATOS SEMELHANTES JÁ OCORRERAM ENTRE O CASAL EM DATAS ANTERIORES. LOGO A ENTRADA NA RESIDÊNCIA FOI EXPRESSAMENTE AUTORIZADA PELO PROPRIETÁRIO, O SENHOR TIBÚRCIO. A EQUIPE REALIZOU BUSCAS NO LOCAL, CONTUDO, NEM A FACA NEM O PEDAÇO DE MADEIRA UTILIZADOS NAS AGRESSÕES RECÍPROCAS FORAM LOCALIZADOS, SENDO QUE POSTERIORMENTE LUZIA RELATOU QUE SUMIU COM A FACA TENDO A ARREMESSADO EM UM MATAGAL. DIANTE DOS FATOS, FOI PROFERIDA VOZ DE PRISÃO AOS ENVOLVIDOS E REALIZADA A LEITURA DE SEUS DIREITOS CONSTITUCIONAIS. TIBÚRCIO FOI CONDUZIDO NO COMPARTIMENTO DE PRESOS DA VIATURA, ENQUANTO LUZIA FOI TRANSPORTADA NO INTERIOR DO VEÍCULO. DURANTE O TRAJETO, LUZIA PROFERIU AMEAÇAS DE MORTE CONTRA TIBÚRCIO, REPETINDO VÁRIAS VEZES QUE IRIA MATÁ-LO QUANDO SAÍSSE DA PRISÃO. AMBOS FORAM ENCAMINHADOS INICIALMENTE AO HOSPITAL PARA ATENDIMENTO MÉDICO DEVIDO ÀS LESÕES CONSTATADAS E, POSTERIORMENTE, ENTREGUES NA DELEGACIA DE POLÍCIA CIVIL DE ALCINÓPOLIS PARA AS PROVIDÊNCIAS QUE O CASO REQUER.`,
    presetData: {
      cidade: 'ALCINÓPOLIS',
      endereco: 'RUA URSINO COELHO DE SOUZA (CASA DO TIBÚRCIO)',
      vtr: '10-3355',
      equipe: '3º SGT SILVÉRIO, SD EDUARDA OLIVEIRA E SD ALBERT',
      rawText: `Esta equipe policial, composta pelo 3º Sgt Silvério, Sd Eduarda Oliveira e Sd Albert (motorista), na viatura 10-3355, foi acionada via solicitação do adolescente Riquelme Samuel Ribeiro da Silva, filho da senhora Luzia Ribeiro dos Santos, para atender uma ocorrência de violência doméstica na Rua Ursino Coelho de Souza (Casa do Tibúrcio), no município de Alcinópolis. Ao chegar ao endereço, a equipe constatou uma discussão entre o casal Luzia Ribeiro dos Santos e Tibúrcio Martins Pereira. Conforme o relato de Luzia, após retornar para sua residência, ela foi injuriada por Tibúrcio com palavras de baixo calão e que ao rebater as ofensas, o indivíduo utilizou um pedaço de madeira para agredi-la. Em resposta à agressão, Luzia confessou ter se apossado de uma faca e desferido golpes contra Tibúrcio, atingindo-o superficialmente em diversas partes do corpo. Durante a averiguação, foi observado que Luzia apresentava hematomas nos braços e antebraços, além de um ferimento superficial na região do nariz. Tibúrcio apresentava lesão superficial no couro cabeludo com vestígios de sangramento e escoriações no tórax com sangramento, ainda um corte superficial no antebraço esquerdo, as quais ele atribuiu às facadas desferidas pela sua companheira Luzia. Notou-se, ainda, que ambos apresentavam sinais visíveis de embriaguez, caracterizados por fala arrastada e odor etílico. Luzia ainda afirmou que fatos semelhantes já ocorreram entre o casal em datas anteriores. Logo a entrada na residência foi expressamente autorizada pelo proprietário, o senhor Tibúrcio. A equipe realizou buscas no local, contudo, nem a faca nem o pedaço de madeira utilizados nas agressões recíprocas foram localizados, sendo que posteriormente Luzia relatou que sumiu com a faca tendo a arremessado em um matagal. Diante dos fatos, foi proferida voz de prisão aos envolvidos e realizada a leitura de seus direitos constitucionais. Tibúrcio foi conduzido no compartimento de presos da viatura, enquanto Luzia foi transportada no interior do veículo. Durante o trajeto, Luzia proferiu ameaças de morte contra Tibúrcio, repetindo várias vezes que iria matá-lo quando saísse da prisão. Ambos foram encaminhados inicialmente ao hospital para atendimento médico devido às lesões constatadas e, posteriormente, entregues na Delegacia de Polícia Civil de Alcinópolis para as providências que o caso requer.`
    }
  },
  {
    id: 'lesao_corporal',
    label: 'Lesão Corporal',
    defaultNature: 'LESÃO CORPORAL',
    structure: [
      "1. ACIONAMENTO: Viatura, composição da equipe policial militar, policiamento ostensivo ou chamado.",
      "2. CHEGADA AO LOCAL / CONTATO: Abordagem pela solicitante, identificação da vítima e do fato.",
      "3. DINÂMICA DA AGRESSÃO: Detalhes da agressão sofrida pela vítima (objetos utilizados, lesões resultantes, estado físico).",
      "4. PROVIDÊNCIAS MÉDICAS: Oferecimento ou recusa de atendimento médico / encaminhamento ao pronto socorro.",
      "5. DILIGÊNCIAS: Rondas e buscas no intuito de localizar o autor (se houver fuga) e resultado das buscas.",
      "6. FECHAMENTO: Registro de antecedentes, destinação da ocorrência à Delegacia de Polícia Civil para providências cabíveis."
    ],
    stepRegexes: [
      /equipe|viatura|patrulhamento|abordada/i,
      /solicitante|marido|elza|jordemir|marques/i,
      /pedra|madeira|garrafa|estilhaços|corte|sangramento|agressão/i,
      /recusou|médico|upa|pronto socorro/i,
      /diligências|rondas|busca|localizar|encontrar|êxito/i,
      /registrado|encaminhado|delegacia|civil|providências/i
    ],
    stepSuggestions: [
      'ESTA EQUIPE POLICIAL, COMPOSTA PELO CABO HELENILSO E PELO SOLDADO ALBERT, A BORDO DA VIATURA 10-3355, REALIZAVA POLICIAMENTO OSTENSIVO E PREVENTIVO NO MUNICÍPIO DE ALCINÓPOLIS QUANDO FOI ABORDADA, NA RUA EMÍLIO OSCAR NEUBERT, PELA SOLICITANTE. ',
      'A SOLICITANTE SENHORA ELZA MARIA DOS SANTOS (CPF: 967.695.991-04) RELATOU QUE SEU MARIDO, O SENHOR JORDEMIR MARQUES GOMES (CPF: 056.025.871-28), HAVIA SIDO AGREDIDO POR UM INDIVÍDUO IDENTIFICADO COMO EVER JOSE MEDINA MEJIAS, CONHECIDO PELA ALCUNHA DE "VENEZUELANO". ',
      'SEGUNDO O RELATO COLHIDO NO LOCAL, O AUTOR TERIA ARREMESSADO UMA PEDRA CONTRA A SENHORA ELZA. DIANTE DA SITUAÇÃO, O SENHOR JORDEMIR TENTOU DEFENDÊ-LA UTILIZANDO UM PEDAÇO DE MADEIRA, MAS O AUTOR LANÇOU UMA GARRAFA DE VIDRO QUE, AO QUEBRAR, ATINGIU A PERNA ESQUERDA DA VÍTIMA WITH ESTILHAÇOS, PROVOCANDO CORTE E SANGRAMENTO INTENSO. ',
      'APESAR DA LESÃO CONSTATADA PELA EQUIPE POLICIAL NO LOCAL, O SENHOR JORDEMIR MARQUES GOMES RECUSOU SER ENCAMINHADO PARA ATENDIMENTO MÉDICO OU PRONTO SOCORRO. ',
      'DIANTE DOS FATOS, ESTA EQUIPE REALIZOU DILIGÊNCIAS E RONDAS EM VIA PÚBLICA NAS IMEDIAÇÕES COM O INTUITO DE LOCALIZAR O AUTOR, PORÉM NÃO LOGROU ÊXITO EM ENCONTRÁ-LO ATÉ O ENCERRAMENTO DESTA OCORRÊNCIA. ',
      'CABE RESSALTAR QUE FOI VERIFICADO QUE OS ENVOLVIDOS JÁ POSSUEM REGISTROS DE OCORRÊNCIAS ANTERIORES. O CASO FOI REGISTRADO E ENCAMINHADO À DELEGACIA DE POLÍCIA DE ALCINÓPOLIS PARA AS PROVIDÊNCIAS LEGAIS CABÍVEIS. '
    ],
    referenceModel: `ESTA EQUIPE POLICIAL, COMPOSTA PELO CABO HELENILSO E PELO SOLDADO ALBERT, A BORDO DA VIATURA 10-3355, REALIZAVA POLICIAMENTO OSTENSIVO E PREVENTIVO NO MUNICÍPIO DE ALCINÓPOLIS QUANDO FOI ABORDADA, NA RUA EMÍLIO OSCAR NEUBERT, PELA SENHORA ELZA MARIA DOS SANTOS (CPF: 967.695.991-04). A SOLICITANTE RELATOU QUE SEU MARIDO, O SENHOR JORDEMIR MARQUES GOMES (CPF: 056.025.871-28), HAVIA SIDO AGREDIDO POR UM INDIVÍDUO IDENTIFICADO COMO EVER JOSE MEDINA MEJIAS, CONHECIDO PELA ALCUNHA DE "VENEZUELANO". SEGUNDO O RELATO COLHIDO NO LOCAL, O AUTOR TERIA ARREMESSADO UMA PEDRA CONTRA A SENHORA ELZA. DIANTE DA SITUAÇÃO, O SENHOR JORDEMIR TENTOU DEFENDÊ-LA UTILIZANDO UM PEDAÇO DE MADEIRA. NA SEQUÊNCIA, O AUTOR LANÇOU UMA GARRAFA DE VIDRO QUE, AO QUEBRAR, ATINGIU A PERNA ESQUERDA DA VÍTIMA COM ESTILHAÇOS, PROVOCANDO UM CORTE E SANGRAMENTO INTENSO. APESAR DA LESÃO CONSTATADA PELA EQUIPE, O SENHOR JORDEMIR RECUSOU SER ENCAMINHADO PARA ATENDIMENTO MÉDICO. DIANTE DOS FATOS, ESTA EQUIPE REALIZOU DILIGÊNCIAS E RONDAS EM VIA PÚBLICA NAS IMEDIAÇÕES COM O INTUITO DE LOCALIZAR O AUTOR, PORÉM NÃO LOGROU ÊXITO EM ENCONTRÁ-LO ATÉ O ENCERRAMENTO DESTA OCORRÊNCIA. FOI VERIFICADO QUE OS ENVOLVIDOS JÁ POSSUEM REGISTROS DE OCORRÊNCIAS ANTERIORES. O CASO FOI REGISTRADO E ENCAMINHADO À DELEGACIA DE POLÍCIA DE ALCINÓPOLIS PARA AS PROVIDÊNCIAS LEGAIS CABÍVEIS.`,
    referenceModels: [
      `ESTA EQUIPE POLICIAL, COMPOSTA PELO CABO HELENILSO E PELO SOLDADO ALBERT, A BORDO DA VIATURA 10-3355, REALIZAVA POLICIAMENTO OSTENSIVO E PREVENTIVO NO MUNICÍPIO DE ALCINÓPOLIS QUANDO FOI ABORDADA, NA RUA EMÍLIO OSCAR NEUBERT, PELA SENHORA ELZA MARIA DOS SANTOS (CPF: 967.695.991-04). A SOLICITANTE RELATOU QUE SEU MARIDO, O SENHOR JORDEMIR MARQUES GOMES (CPF: 056.025.871-28), HAVIA SIDO AGREDIDO POR UM INDIVÍDUO IDENTIFICADO COMO EVER JOSE MEDINA MEJIAS, CONHECIDO PELA ALCUNHA DE "VENEZUELANO". SEGUNDO O RELATO COLHIDO NO LOCAL, O AUTOR TERIA ARREMESSADO UMA PEDRA CONTRA A SENHORA ELZA. DIANTE DA SITUAÇÃO, O SENHOR JORDEMIR TENTOU DEFENDÊ-LA UTILIZANDO UM PEDAÇO DE MADEIRA. NA SEQUÊNCIA, O AUTOR LANÇOU UMA GARRAFA DE VIDRO QUE, AO QUEBRAR, ATINGIU A PERNA ESQUERDA DA VÍTIMA COM ESTILHAÇOS, PROVOCANDO UM CORTE E SANGRAMENTO INTENSO. APESAR DA LESÃO CONSTATADA PELA EQUIPE, O SENHOR JORDEMIR RECUSOU SER ENCAMINHADO PARA ATENDIMENTO MÉDICO. DIANTE DOS FATOS, ESTA EQUIPE REALIZOU DILIGÊNCIAS E RONDAS EM VIA PÚBLICA NAS IMEDIAÇÕES COM O INTUITO DE LOCALIZAR O AUTOR, PORÉM NÃO LOGROU ÊXITO EM ENCONTRÁ-LO ATÉ O ENCERRAMENTO DESTA OCORRÊNCIA. FOI VERIFICADO QUE OS ENVOLVIDOS JÁ POSSUEM REGISTROS DE OCORRÊNCIAS ANTERIORES. O CASO FOI REGISTRADO E ENCAMINHADO À DELEGACIA DE POLÍCIA DE ALCINÓPOLIS PARA AS PROVIDÊNCIAS LEGAIS CABÍVEIS.`
    ],
    presetData: {
      cidade: 'ALCINÓPOLIS',
      endereco: 'RUA EMÍLIO OSCAR NEUBERT',
      vtr: '10-3355',
      equipe: 'CABO HELENILSO E SOLDADO ALBERT',
      rawText: `Esta equipe policial, composta pelo Cabo Helenilso e pelo Soldado Albert, a bordo da viatura 10-3355, realizava policiamento ostensivo e preventivo no município de Alcinópolis quando foi abordada, na Rua Emílio Oscar Neubert, pela senhora Elza Maria Dos Santos (CPF: 967.695.991-04). A solicitante relatou que seu marido, o senhor Jordemir Marques Gomes (CPF: 056.025.871-28), havia sido agredido por um indivíduo identificado como Ever Jose Medina Mejias, conhecido pela alcunha de "Venezuelano". Segundo o relato colhido no local, o autor teria arremessado uma pedra contra a senhora Elza. Diante da situação, o senhor Jordemir tentou defendê-la utilizando um pedaço de madeira. Na sequência, o autor lançou uma garrafa de vidro que, ao quebrar, atingiu a perna esquerda da vítima com estilhaços, provocando um corte e sangramento intenso. Apesar da lesão constatada pela equipe, o senhor Jordemir recusou ser encaminhado para atendimento médico. Diante dos fatos, esta equipe realizou diligências e rondas em via pública nas imediações com o intuito de localizar o autor, porém não logrou êxito em encontrá-lo até o encerramento desta ocorrência. Foi verificado que os envolvidos já possuem registros de ocorrências anteriores. O caso foi registrado e encaminhado à Delegacia de Polícia de Alcinópolis para as providências legais cabíveis.`
    }
  },
  {
    id: 'furto',
    label: 'Furto',
    defaultNature: 'FURTO',
    structure: [
      "1. ACIONAMENTO: Viatura, equipe policial militar e forma de acionamento para atender ocorrência de furto.",
      "2. CONTATO COM A VÍTIMA: Qualificação do proprietário/vítima, data, hora e constatação do crime.",
      "3. MODUS OPERANDI / ARROMBAMENTO: Detalhes da invasão (desligamento de energia, arrombamento de janela/obstáculos, furto de valores e bens).",
      "4. SISTEMAS DE SEGURANÇA: Presença de câmeras, monitoramento e destinação das imagens para investigação.",
      "5. PERÍCIA TÉCNICA: Preservação ou contaminação do local do crime e viabilidade de acionamento pericial.",
      "6. FECHAMENTO: Orientação à vítima, registro complementar e destinação da ocorrência para providências cabíveis."
    ],
    stepRegexes: [
      /equipe|viatura|acionada|furto/i,
      /contato|vítima|constatado|juarez|silva/i,
      /energia|lateral|janela|arrombamento|jukebox|subtraiu|moedas|doces|bebidas/i,
      /câmeras|segurança|imagens|monitoramento/i,
      /contaminado|perícia/i,
      /orientado|comparecer|delegacia|civil|investigações/i
    ],
    stepSuggestions: [
      'ESTA EQUIPE POLICIAL MILITAR, COMPOSTA PELO SOLDADO PM PEDRO E PELO SOLDADO PM ROSSATTO, A BORDO DA VIATURA DE PREFIXO 10-3355, FOI ACIONADA PARA ATENDER UMA OCORRÊNCIA DE FURTO EM UM ESTABELECIMENTO COMERCIAL LOCALIZADO NA AVENIDA VIRGÍLIO JOSÉ CARNEIRO, NO MUNICÍPIO DE ALCINÓPOLIS. ',
      'NO LOCAL, EM CONTATO COM A VÍTIMA, O SENHOR JUAREZ SILVA DE SOUZA, ESTE RELATOU QUE O CRIME DE FURTO FOI CONSTATADO POR VOLTA DAS 10H39MIN DO DIA 18/06/2026. ',
      'SEGUNDO O RELATO, O AUTOR DESLIGOU O PADRÃO DE ENERGIA LOCALIZADO NA LATERAL DO IMÓVEL E ADENTROU O ESTABELECIMENTO PELOS FUNDOS, APÓS REALIZAR O ARROMBAMENTO DE UMA JANELA. DURANTE A AÇÃO, O INDIVÍDUO ARROMBOU UMA MÁQUINA DE MÚSICA (JUKEBOX) E SUBTRAIU DE SEU INTERIOR R$ 300,00, ALÉM DE DOCES E BEBIDAS DOS FREEZERS. ',
      'O PROPRIETÁRIO INFORMOU QUE O ESTABELECIMENTO POSSUI CÂMERAS DE SEGURANÇA, CUJAS IMAGENS SÃO GERENCIADAS POR UMA EMPRESA DE INTERNET LOCAL E SERÃO APURADAS POSTERIORMENTE PARA AUXILIAR NA IDENTIFICAÇÃO DO AUTOR. ',
      'CABE RESSALTAR QUE O LOCAL DO CRIME FOI CONTAMINADO PELA PRÓPRIA VÍTIMA ANTES DA CHEGADA DESTA EQUIPE, O QUE INVIABILIZOU O ACIONAMENTO DA PERÍCIA TÉCNICA. ',
      'DIANTE DOS FATOS, O SENHOR JUAREZ SILVA DE SOUZA FOI DEVIDAMENTE ORIENTADO A COMPARECER À DELEGACIA DE POLÍCIA CIVIL PARA O REGISTRO COMPLEMENTAR DA OCORRÊNCIA E O PROSSEGUIMENTO DAS INVESTIGAÇÕES. '
    ],
    referenceModel: `ESTA EQUIPE POLICIAL MILITAR, COMPOSTA PELO SOLDADO PM PEDRO E PELO SOLDADO PM ROSSATTO, A BORDO DA VIATURA DE PREFIXO 10-3355, FOI ACIONADA PARA ATENDER UMA OCORRÊNCIA DE FURTO EM UM ESTABELECIMENTO COMERCIAL LOCALIZADO NA AVENIDA VIRGÍLIO JOSÉ CARNEIRO, Nº 252, NO BAIRRO JARDIM BOM SUCESSO, EM ALCINÓPOLIS. NO LOCAL, EM CONTATO COM A VÍTIMA, O SENHOR JUAREZ SILVA DE SOUZA, ESTE RELATOU QUE O CRIME FOI CONSTATADO POR VOLTA DAS 10H39MIN DO DIA 18/06/2026. SEGUNDO O RELATO, O AUTOR DESLIGOU O PADRÃO DE ENERGIA LOCALIZADO NA LATERAL DO IMÓVEL E ADENTROU O ESTABELECIMENTO PELOS FUNDOS, APÓS REALIZAR O ARROMBAMENTO DE UMA JANELA. DURANTE A AÇÃO, O INDIVÍDUO ARROMBOU UMA MÁQUINA DE MÚSICA (JUKEBOX) E SUBTRAIU DE SEU INTERIOR A QUANTIA APROXIMADA DE R$ 300,00 (TREZENTOS REAIS). FORAM SUBTRAÍDAS AINDA MOEDAS DIVERSAS E UMA QUANTIDADE NÃO ESPECIFICADA DE DOCES E BEBIDAS QUE SE ENCONTRAVAM NOS FREEZERS DO LOCAL. A VÍTIMA FOI QUALIFICADA NO LOCAL, SENDO FILHO DE JOÃO JOSÉ DE SOUZA E IRENE SILVA DE SOUZA. O PROPRIETÁRIO INFORMOU QUE O ESTABELECIMENTO POSSUI CÂMERAS DE SEGURANÇA, CUJAS IMAGENS SÃO GERENCIADAS POR UMA EMPRESA DE INTERNET LOCAL E SERÃO APURADAS POSTERIORMENTE PARA AUXILIAR NA IDENTIFICAÇÃO DO AUTOR. CABE RESSALTAR QUE O LOCAL DO CRIME FOI CONTAMINADO PELA PRÓPRIA VÍTIMA ANTES DA CHEGADA DESTA EQUIPE, O QUE INVIABILIZOU O ACIONAMENTO DA PERÍCIA TÉCNICA. DIANTE DOS FATOS, O SENHOR JUAREZ SILVA DE SOUZA FOI DEVIDAMENTE ORIENTADO A COMPARECER À DELEGACIA DE POLÍCIA CIVIL PARA O REGISTRO COMPLEMENTAR DA OCORRÊNCIA E O PROSSEGUIMENTO DAS INVESTIGAÇÕES. O PRESENTE BOLETIM SEGUE PARA AS PROVIDÊNCIAS QUE O CASO REQUER.`,
    presetData: {
      cidade: 'ALCINÓPOLIS',
      endereco: 'AVENIDA VIRGÍLIO JOSÉ CARNEIRO, Nº 252',
      vtr: '10-3355',
      equipe: 'SOLDADO PM PEDRO E SOLDADO PM ROSSATTO',
      rawText: `Esta equipe policial militar, composta pelo Soldado PM Pedro e pelo Soldado PM Rossatto, a bordo da viatura de prefixo 10-3355, foi acionada para atender uma ocorrência de furto em um estabelecimento comercial localizado na Avenida Virgílio José Carneiro, nº 252, no Bairro Jardim Bom Sucesso, em Alcinópolis. No local, em contato com a vítima, o senhor Juarez Silva de Souza, este relatou que o crime foi constatado por volta das 10h39min do dia 18/06/2026. Segundo o relato, o autor desligou o padrão de energia localizado na lateral do imóvel e adentrou o estabelecimento pelos fundos, após realizar o arrombamento de uma janela. Durante a ação, o indivíduo arrombou uma máquina de música (Jukebox) e subtraiu de seu interior a quantia aproximada de R$ 300,00 (trezentos reais). Foram subtraídas ainda moedas diversas e uma quantidade não especificada de doces e bebidas que se encontravam nos freezers do local. A vítima foi qualificada no local, sendo filho de João José de Souza e Irene Silva de Souza. O proprietário informou que o estabelecimento possui câmeras de segurança, cujas imagens são gerenciadas por uma empresa de internet local e serão apuradas posteriormente para auxiliar na identificação do autor. Cabe ressaltar que o local do crime foi contaminado pela própria vítima antes da chegada desta equipe, o que inviabilizou o acionamento da perícia técnica. Diante dos fatos, o senhor Juarez Silva de Souza foi devidamente orientado a comparecer à Delegacia de Polícia Civil para o registro complementar da ocorrência e o prosseguimento das investigações. O presente boletim segue para as providências que o caso requer.`
    }
  }
];

const RoAssistant: React.FC<RoAssistantProps> = ({ user }) => {
  // Navigation & Tabs
  const [activeTab, setActiveTab] = useState<'enhancer' | 'advisor'>('enhancer');
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  // States for Tab 1: Enhancer (Boletim de Ocorrência PMMS)
  const [natureza, setNatureza] = useState('POLICIAMENTO OSTENSIVO');
  const [nrProtocolo, setNrProtocolo] = useState('');
  const [endereco, setEndereco] = useState('');
  const [cidade, setCidade] = useState(user?.unidade || '');
  const [geolocalizacao, setGeolocalizacao] = useState('');
  const [dataHora, setDataHora] = useState(new Date().toLocaleString('pt-BR'));
  const [equipe, setEquipe] = useState('');
  const [vtr, setVtr] = useState('');
  const [rawText, setRawText] = useState('');
  const [respostasFmt, setRespostasFmt] = useState('');
  const [contextoManual, setContextoManual] = useState(`- Utilizar linguagem formal, impessoal (3ª pessoa), clara, concisa e objetiva.
- Evitar jargões ("GU", "peba", "QBU") e termos vulgares.
- Proibição absoluta do jerundismo ("foi estando", "foi correndo") e do termo "o mesmo" para referenciar pessoas.
- Basear o relato exclusivamente nos fatos reais informados, sem supor ou inventar elementos circunstanciais não descritos.`);
  const [enhancedText, setEnhancedText] = useState('');
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [copiedEnhanced, setCopiedEnhanced] = useState(false);
  const [showAdvancedParams, setShowAdvancedParams] = useState(false);
  
  // Custom occurrence templates states
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(true);
  const [isFocused, setIsFocused] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  const [loadedTemplates, setLoadedTemplates] = useState<OccurrenceTemplate[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'ro_templates'), orderBy('label', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const list = snapshot.docs.map(doc => {
          const data = doc.data();
          const stepRegexes = data.stepRegexes?.map((r: string) => {
            try {
              return new RegExp(r, 'i');
            } catch (e) {
              return /.*/;
            }
          }) || [];
          return {
            ...data,
            stepRegexes
          } as OccurrenceTemplate;
        });
        setLoadedTemplates(list);
      } else {
        setLoadedTemplates(OCCURRENCE_TEMPLATES);
      }
    }, (err) => {
      console.error("Erro ao buscar ro_templates do Firestore:", err);
      setLoadedTemplates(OCCURRENCE_TEMPLATES);
    });
    return () => unsubscribe();
  }, []);

  const activeTemplate = loadedTemplates.find(t => t.id === selectedTemplateId);
  
  const getActiveStepIndex = () => {
    if (!activeTemplate || !activeTemplate.stepRegexes) return -1;
    const idx = activeTemplate.stepRegexes.findIndex(regex => !regex.test(rawText));
    return idx !== -1 ? idx : activeTemplate.stepRegexes.length;
  };

  const activeStepIndex = getActiveStepIndex();

  const getGhostText = () => {
    if (!activeTemplate || !activeTemplate.stepSuggestions || activeStepIndex < 0 || activeStepIndex >= activeTemplate.stepSuggestions.length) {
      return '';
    }
    const suggestion = activeTemplate.stepSuggestions[activeStepIndex];
    
    const lastPeriod = rawText.lastIndexOf('.');
    const currentSegment = lastPeriod === -1 ? rawText : rawText.substring(lastPeriod + 1);
    const trimmedSegment = currentSegment.trimStart();
    
    if (trimmedSegment && suggestion.toLowerCase().startsWith(trimmedSegment.toLowerCase())) {
      return suggestion.substring(trimmedSegment.length);
    } else if (!trimmedSegment) {
      return suggestion;
    }
    return '';
  };

  const ghostText = getGhostText();

  const getActiveStepInfo = () => {
    if (!selectedTemplateId) return null;
    const template = loadedTemplates.find(t => t.id === selectedTemplateId);
    if (!template || !template.stepRegexes || !template.stepSuggestions) return null;
    
    const idx = template.stepRegexes.findIndex(regex => !regex.test(rawText));
    if (idx === -1) {
      return {
        index: template.structure.length,
        title: "Estrutura Concluída!",
        description: "Você inseriu todos os passos recomendados na narrativa!",
        suggestion: null
      };
    }
    
    return {
      index: idx,
      title: template.structure[idx],
      description: "Escreva a frase correspondente a este passo do boletim.",
      suggestion: template.stepSuggestions[idx]
    };
  };

  const insertSuggestionText = (textToInsert: string) => {
    setRawText(prev => {
      if (!prev) return textToInsert;
      const trimmed = prev.trimEnd();
      if (trimmed.endsWith('.') || trimmed.endsWith('!') || trimmed.endsWith('?')) {
        return trimmed + ' ' + textToInsert;
      } else if (trimmed.endsWith(',')) {
        return trimmed + ' ' + textToInsert;
      } else {
        return prev + (prev.endsWith(' ') ? '' : ' ') + textToInsert;
      }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab' && ghostText) {
      e.preventDefault();
      setRawText(prev => prev + ghostText);
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (overlayRef.current) {
      overlayRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  // States for Tab 3: Advisor
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<{ sender: 'user' | 'assistant'; text: string }[]>([
    {
      sender: 'assistant',
      text: 'Olá! Sou o Assistente IA de Operações Policiais. Posso tirar dúvidas sobre procedimentos operacionais padrão (POP), enquadramentos legais do Código Penal Brasileiro, ou ajudar você a detalhar apreensões, veículos clonados ou buscas pessoais. Como posso ajudar?'
    }
  ]);
  const [isAnswering, setIsAnswering] = useState(false);



  // Dynamic guiding questions based on the next missing procedural step
  const getNextStepQuestions = () => {
    const firstUnmet = NARRATIVE_REQUIREMENTS.find(req => !req.regex.test(rawText));
    if (!firstUnmet) {
      return {
        title: "Tudo Pronto!",
        questions: ["O seu relato atende a todos os requisitos processuais mínimos do Manual de Redação Policial da PMMS! Releia para conferir detalhes."]
      };
    }

    switch (firstUnmet.id) {
      case 'acionamento':
        return {
          title: "Início da Ação (Acionamento)",
          questions: [
            "Qual era a viatura e composição da equipe policial?",
            "Como a equipe tomou ciência do fato? (Via rádio/Copom, denúncia de terceiros ou flagrante em patrulhamento?)"
          ]
        };
      case 'abordagem':
        return {
          title: "Abordagem e Busca de Ilícitos",
          questions: [
            "Onde e como os envolvidos foram abordados?",
            "Onde exatamente os objetos, armas ou drogas foram encontrados? (Busca pessoal, no veículo, residência ou jogados ao solo?)"
          ]
        };
      case 'algemas':
        return {
          title: "Uso de Algemas (Súmula Vinculante 11)",
          questions: [
            "Foi necessário algemar? Por qual motivo específico? (Comportamento rebelde, resistência física, receio de fuga ou integridade física?)"
          ]
        };
      case 'direitos':
        return {
          title: "Garantia dos Direitos do Conduzido",
          questions: [
            "O conduzido foi devidamente informado sobre seus direitos constitucionais, especialmente o de permanecer em silêncio?"
          ]
        };
      case 'saude':
        return {
          title: "Estado de Saúde e Integridade Física",
          questions: [
            "O autor ou envolvidos possuem alguma lesão física ou escoriação pré-existente?",
            "Foram conduzidos à UPA ou passaram por atendimento médico antes da delegacia?"
          ]
        };
      case 'destino':
        return {
          title: "Destino da Ocorrência e Encerramento",
          questions: [
            "Para qual Distrito Policial ou Delegacia de Polícia Civil as partes e os materiais apreendidos foram encaminhados?"
          ]
        };
      default:
        return {
          title: "Redigindo a Ocorrência",
          questions: ["Quais fatos relevantes adicionais ocorreram na abordagem?"]
        };
    }
  };



  // Initialize Gemini AI client
  const getAIClient = () => {
    // Falls back appropriately to both potential env keys
    const apiKey = (process.env as any).GEMINI_API_KEY || (import.meta.env as any).VITE_GEMINI_API_KEY || '';
    if (!apiKey) {
      throw new Error('A chave de API do Gemini (GEMINI_API_KEY) não está configurada no painel de configurações ou secrets.');
    }
    return new GoogleGenAI({ apiKey });
  };

  // Enhance raw narrative to HISTÓRICO DA OCORRÊNCIA
  const handleEnhance = async () => {
    if (!rawText.trim()) return;
    setIsEnhancing(true);
    setEnhancedText('');
    try {
      const ai = getAIClient();
      
      // Check if there is an active template for the selected nature or ID
      const activeTemplate = loadedTemplates.find(t => t.id === selectedTemplateId || t.defaultNature === natureza);
      
      let templatePromptContext = '';
      if (activeTemplate) {
        const models = activeTemplate.referenceModels && activeTemplate.referenceModels.length > 0
          ? activeTemplate.referenceModels
          : [activeTemplate.referenceModel];
        
        templatePromptContext = `\n\nESTRUTURA PADRÃO E MODELO(S) DE REFERÊNCIA REAL PARA O TIPO ${activeTemplate.label.toUpperCase()}:\n` +
          `Siga esta estrutura recomendada ao organizar o texto:\n` +
          `${activeTemplate.structure.map(s => `- ${s}`).join('\n')}\n\n` +
          `Aqui estão os modelos reais de referência ideais de redação para este tipo de ocorrência que você deve usar como espelho de estilo e qualidade de escrita (fidelidade absoluta aos fatos informados, impessoalidade e sem alucinações):\n` +
          models.map((m, idx) => `MODELO ${idx + 1}:\n"${m}"`).join('\n\n');
      }

      const prompt = `Você é um assistente especialista em redação de Boletins de Ocorrência (BO/RO) para a Polícia Militar de Mato Grosso do Sul (PMMS). Sua resposta DEVE seguir as regras, princípios e o estilo dos modelos fornecidos no contexto.

CONTEXTO DO MANUAL PMMS (REGRAS OBRIGATÓRIAS)
${contextoManual}
${templatePromptContext}

TAREFA
Gerar o texto COMPLETO e FORMAL do campo 'HISTÓRICO DA OCORRÊNCIA'.

DADOS COLETADOS (Fornecidos pelo Policial)
Nº Protocolo: ${nrProtocolo || 'Não informado'}
Natureza: ${natureza}
Endereço: ${endereco} (Cidade: ${cidade})
Geolocalização: ${geolocalizacao}
Data/Hora: ${dataHora}
Equipe: ${equipe} (VTR ${vtr})
Narrativa Inicial (Resumo): ${rawText}
Respostas Adicionais (Checklist):
${respostasFmt}

INSTRUÇÕES OBRIGATÓRIAS PARA A REDAÇÃO

1. PRINCÍPIO DA FIDELIDADE DOS FATOS (TOLERÂNCIA ZERO PARA ALUCINAÇÕES): O histórico deve reproduzir EXCLUSIVAMENTE os fatos informados pelo policial nos campos $narrativa_bruta e $respostasFmt. É terminantemente proibido presumir, deduzir ou inventar procedimentos, circunstâncias, justificativas, lesões ou atos administrativos que não constem expressamente nos dados fornecidos.

2. USE O CONTEXTO: Você DEVE seguir RIGOROSAMENTE as regras de redação (Impessoalidade, Formalidade, Clareza, Concisão) e os exemplos de BO fornecidos no $contexto_manual.

3. IMPESSOALIDADE (3ª PESSOA): Use sempre a 3ª pessoa. (Ex: "Esta equipe policial foi acionada...", "Foi constatado...", "O autor relatou...").

4. PROIBIÇÕES (DO MANUAL):
* NÃO USE JARGÕES: (Ex: "GU", "peba", "QBU").
* NÃO USE "O MESMO": (Errado: "O autor... o mesmo disse..."). Use "ele", "o conduzido", "o abordado", "o indivíduo".
* NÃO USE GERUNDISMO: (Errado: "foi estando no local...").

5. ESTRUTURA LÓGICA E CONDICIONAL: Organize o texto em parágrafos claros, seguindo esta ordem (omita etapas que não possuam dados):

* ACIONAMENTO/EQUIPE: Como a equipe foi acionada (via CIOPS, policiamento ostensivo) e quem a compunha (usar $equipe).
* CHEGADA E FATOS: O que foi constatado no local. A narrativa dos fatos, com base estrita na $narrativa_bruta e nas $respostasFmt.
* QUALIFICAÇÃO DAS PARTES: Detalhes de vítima, autor, testemunhas.
* OBJETO E VEÍCULOS: Descrição detalhada de tudo que foi apreendido ou envolvido.
* PROCEDIMENTOS POLICIAIS (ALGEMAS E DIREITOS): 
  - SÚMULA VINCULANTE 11: Mencione o uso de algemas e a justificativa (resistência, fundado receio de fuga ou perigo à integridade física) APENAS SE essa informação foi expressamente fornecida pelo policial. NÃO escreva frases dizendo que "as algemas não foram utilizadas". Se não há menção de algemas nos dados, simplesmente omita este assunto.
  - DIREITOS CONSTITUCIONAIS: Mencione a leitura dos direitos constitucionais APENAS SE houver um autor detido/conduzido na ocorrência relatada.
* DESTINO E LESÕES: Encaminhamento (ex: DEPAC, UPA) e o estado físico das partes (apenas relate lesões ou a ausência delas se o policial tiver informado isso no checklist).

SEJA COMPLETO E FLUIDO: Incorpore as informações relevantes da $narrativa_bruta e das $respostasFmt in um texto coeso, sem parecer um questionário respondido.

FORMATO DE SAÍDA: Gere APENAS o texto completo do campo 'HISTÓRICO DA OCORRÊNCIA'. Nenhuma saudação ou explicação adicional.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      const refinedText = response.text || 'Não foi possível refinar a narrativa.';
      setEnhancedText(refinedText);

      // Log action in firestore
      if (user) {
        await logAction(
          user.id,
          user.nome,
          'ASSISTENTE_RO_ENHANCE',
          `Utilizou o aprimorador de narrativa policial.`
        );
      }
    } catch (error: any) {
      console.error('Gemini API Error:', error);
      setAlertMessage(error?.message || 'Falha ao processar narrativa com o Assistente de IA.');
    } finally {
      setIsEnhancing(false);
    }
  };

  // Conversational Q&A / Advisor
  const handleSendChatMessage = async () => {
    if (!chatInput.trim() || isAnswering) return;
    const userMsg = chatInput.trim();
    setChatMessages(prev => [...prev, { sender: 'user', text: userMsg }]);
    setChatInput('');
    setIsAnswering(true);

    try {
      const ai = getAIClient();
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Você é um Supervisor de Operações Policiais e Assessor Jurídico militar altamente experiente. 
        Sua função é instruir o operador policial militar sobre como agir perante o fato, quais os procedimentos legais adotar, responder a dúvidas de POP (Procedimento Operacional Padrão) e tirar dúvidas doutrinárias e práticas.
        Responda de forma clara, amigável, cirúrgica e altamente profissional, utilizando bullet-points quando apropriado.
        Mostre embasamento na legislação brasileira relevante caso corresponda à dúvida.

        DÚVIDA DO OPERADOR: 
        "${userMsg}"`,
      });

      const answer = response.text || 'Não consegui formular uma instrução precisa para esta dúvida. Recarregue e tente novamente.';
      setChatMessages(prev => [...prev, { sender: 'assistant', text: answer }]);

      if (user) {
        await logAction(
          user.id,
          user.nome,
          'ASSISTENTE_RO_CHAT',
          `Realizou consulta de procedimentos com o R.O. Assistant: "${userMsg.substring(0, 50)}..."`
        );
      }
    } catch (error: any) {
      console.error('Gemini API Error:', error);
      setChatMessages(prev => [
        ...prev,
        { sender: 'assistant', text: `Erro de comunicação: ${error?.message || 'Falha ao receber a resposta da IA.'}` }
      ]);
    } finally {
      setIsAnswering(false);
    }
  };

  const copyToClipboard = (text: string, setCopiedState: (val: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setCopiedState(true);
    setTimeout(() => setCopiedState(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {alertMessage && (
        <TacticalAlert 
          message={alertMessage} 
          onClose={() => setAlertMessage(null)} 
        />
      )}

      {/* Header */}
      <div className="mb-8 animate-fade-in flex flex-col md:flex-row md:items-center justify-between border-b border-navy-100 pb-5">
        <div>
          <div className="flex items-center gap-2 text-navy-900">
            <Sparkles className="animate-pulse text-indigo-600" size={28} />
            <h2 className="text-navy-950 text-3xl font-black uppercase tracking-tighter">Assistente de R.O.</h2>
          </div>
          <p className="text-navy-500 mt-1 uppercase text-xs font-bold tracking-widest">Aprimoramento de Relatos e Consultoria Legal com Inteligência Artificial</p>
        </div>
        <div className="mt-4 md:mt-0 flex flex-wrap items-center gap-2">
          {user?.role === UserRole.MASTER && (
            <Link
              to="/modelos-ro"
              className="bg-navy-950 hover:bg-navy-900 text-white px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-wider flex items-center gap-2 transition-all shadow-sm"
              title="Configurar Modelos de R.O."
            >
              <ClipboardList size={16} />
              Modelos de R.O.
            </Link>
          )}
          <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-wider flex items-center gap-2">
            <ShieldCheck size={16} />
            Módulo Operacional Ativo
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 p-1.5 bg-navy-50 rounded-2xl mb-8 border border-navy-100">
        <button
          id="tab-enhancer"
          onClick={() => setActiveTab('enhancer')}
          className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
            activeTab === 'enhancer' 
              ? 'bg-navy-950 text-white shadow-md' 
              : 'text-navy-500 hover:text-navy-900 hover:bg-white/50'
          }`}
        >
          <FileText size={16} />
          Aprimorar Narrativa
        </button>
        <button
          id="tab-advisor"
          onClick={() => setActiveTab('advisor')}
          className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
            activeTab === 'advisor' 
              ? 'bg-navy-950 text-white shadow-md' 
              : 'text-navy-500 hover:text-navy-900 hover:bg-white/50'
          }`}
        >
          <MessageSquare size={16} />
          Consultor Operacional
        </button>
      </div>

      {/* Tab Content */}
      <div className="animate-fade-in">
        
        {/* Tab 1: Narrative Enhancer */}
        {activeTab === 'enhancer' && (
          <div className="space-y-6">
            
            {/* 📋 Dados Técnicos da Ocorrência (Restored to the top, before the narrative description) */}
            <div className="bg-white border border-navy-100 rounded-3xl p-5 md:p-6 shadow-sm space-y-4 animate-fade-in">
              <div className="flex items-center gap-2 border-b border-navy-50 pb-3">
                <FileText className="text-pink-600 animate-pulse" size={18} />
                <h4 className="font-black text-xs uppercase tracking-wider text-navy-900">1. Dados Técnicos da Ocorrência</h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Natureza */}
                <div className="md:col-span-2">
                  <label className="block text-[9px] font-black text-navy-400 uppercase tracking-widest mb-1.5 ml-1">Natureza da Ocorrência</label>
                  <select
                    value={natureza}
                    onChange={e => setNatureza(e.target.value)}
                    className="w-full bg-navy-50 border border-navy-150 rounded-xl px-4 py-2.5 text-xs text-navy-950 font-black focus:ring-2 focus:ring-navy-600 outline-none transition-all uppercase"
                  >
                    <option value="POLICIAMENTO OSTENSIVO">POLICIAMENTO OSTENSIVO</option>
                    <option value="TRÁFICO DE DROGAS">TRÁFICO DE DROGAS</option>
                    <option value="AMEAÇA">AMEAÇA</option>
                    <option value="ROUBO">ROUBO</option>
                    <option value="FURTO">FURTO</option>
                    <option value="RECEPTAÇÃO">RECEPTAÇÃO</option>
                    <option value="VIOLÊNCIA DOMÉSTICA">VIOLÊNCIA DOMÉSTICA</option>
                    <option value="LESÃO CORPORAL">LESÃO CORPORAL</option>
                  </select>
                </div>
                
                {/* NR PROTOCOLO */}
                <div>
                  <label className="block text-[9px] font-black text-navy-400 uppercase tracking-widest mb-1.5 ml-1">NR PROTOCOLO</label>
                  <input 
                    type="text"
                    value={nrProtocolo}
                    onChange={e => setNrProtocolo(e.target.value.toUpperCase())}
                    placeholder="EX: 2026/123456"
                    className="w-full bg-navy-50 border border-navy-150 rounded-xl px-4 py-2.5 text-xs text-navy-950 font-black focus:ring-2 focus:ring-navy-600 outline-none uppercase"
                  />
                </div>

                {/* Data/Hora */}
                <div>
                  <label className="block text-[9px] font-black text-navy-400 uppercase tracking-widest mb-1.5 ml-1">Data / Hora</label>
                  <input 
                    type="text"
                    value={dataHora}
                    onChange={e => setDataHora(e.target.value)}
                    className="w-full bg-navy-50 border border-navy-150 rounded-xl px-4 py-2.5 text-xs text-navy-950 font-black focus:ring-2 focus:ring-navy-600 outline-none"
                  />
                </div>

                {/* Cidade */}
                <div>
                  <label className="block text-[9px] font-black text-navy-400 uppercase tracking-widest mb-1.5 ml-1">Cidade / Unidade</label>
                  <input 
                    type="text"
                    value={cidade}
                    onChange={e => setCidade(e.target.value.toUpperCase())}
                    className="w-full bg-navy-50 border border-navy-150 rounded-xl px-4 py-2.5 text-xs text-navy-950 font-black focus:ring-2 focus:ring-navy-600 outline-none uppercase"
                  />
                </div>

                {/* Endereço */}
                <div className="md:col-span-2">
                  <label className="block text-[9px] font-black text-navy-400 uppercase tracking-widest mb-1.5 ml-1">Endereço do Fato</label>
                  <input 
                    type="text"
                    value={endereco}
                    onChange={e => setEndereco(e.target.value.toUpperCase())}
                    className="w-full bg-navy-50 border border-navy-150 rounded-xl px-4 py-2.5 text-xs text-navy-950 font-black focus:ring-2 focus:ring-navy-600 outline-none uppercase"
                    placeholder="EX: AV. AFONSO PENA, 1200 CORREDOR"
                  />
                </div>

                {/* Geolocalização */}
                <div>
                  <label className="block text-[9px] font-black text-navy-400 uppercase tracking-widest mb-1.5 ml-1">Geolocalização</label>
                  <input 
                    type="text"
                    value={geolocalizacao}
                    onChange={e => setGeolocalizacao(e.target.value)}
                    className="w-full bg-navy-50 border border-navy-150 rounded-xl px-4 py-2.5 text-xs text-navy-950 font-black focus:ring-2 focus:ring-navy-600 outline-none"
                    placeholder="EX: -18.8654, -53.4478"
                  />
                </div>

                {/* VTR */}
                <div>
                  <label className="block text-[9px] font-black text-navy-400 uppercase tracking-widest mb-1.5 ml-1">Viatura (VTR)</label>
                  <input 
                    type="text"
                    value={vtr}
                    onChange={e => setVtr(e.target.value.toUpperCase())}
                    className="w-full bg-navy-50 border border-navy-150 rounded-xl px-4 py-2.5 text-xs text-navy-950 font-black focus:ring-2 focus:ring-navy-600 outline-none uppercase"
                  />
                </div>

                {/* Equipe */}
                <div className="md:col-span-2">
                  <label className="block text-[9px] font-black text-navy-400 uppercase tracking-widest mb-1.5 ml-1">Composição da Equipe</label>
                  <input 
                    type="text"
                    value={equipe}
                    onChange={e => setEquipe(e.target.value.toUpperCase())}
                    className="w-full bg-navy-50 border border-navy-150 rounded-xl px-4 py-2.5 text-xs text-navy-950 font-black focus:ring-2 focus:ring-navy-600 outline-none uppercase"
                  />
                </div>
              </div>
            </div>

            {/* 📚 Biblioteca de Estruturas de Ocorrência da PMMS */}
            <div className="bg-white border border-navy-100 rounded-3xl p-5 md:p-6 shadow-sm space-y-4 animate-fade-in">
              <button
                type="button"
                onClick={() => setShowTemplates(!showTemplates)}
                className="w-full flex items-center justify-between border-b border-navy-50 pb-3 text-left outline-none cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <BookOpen className="text-pink-600" size={18} />
                  <h4 className="font-black text-xs uppercase tracking-wider text-navy-900">Biblioteca de Estruturas de Ocorrência (Modelos PMMS)</h4>
                </div>
                <span className="text-[10px] text-navy-500 font-bold bg-navy-50 px-2 py-0.5 rounded-full border border-navy-150">
                  {showTemplates ? 'Esconder ▲' : 'Visualizar ▼'}
                </span>
              </button>

              {showTemplates && (
                <div className="space-y-4 animate-fade-in">
                  <p className="text-navy-500 text-xs leading-relaxed">
                    Selecione um tipo de ocorrência abaixo para carregar sua <strong className="text-navy-900">Estrutura Padrão Recomendada</strong> compatível com as diretrizes da PMMS.
                  </p>

                  <div className="flex flex-wrap gap-2">
                    {loadedTemplates.map((t) => {
                      const isSelected = selectedTemplateId === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            setSelectedTemplateId(t.id);
                            setNatureza(t.defaultNature);
                          }}
                          className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all border cursor-pointer ${
                            isSelected
                              ? 'bg-pink-600 text-white border-pink-600 shadow-sm'
                              : 'bg-navy-50 text-navy-700 border-navy-150 hover:bg-navy-100/70'
                          }`}
                        >
                          {t.label}
                        </button>
                      );
                    })}
                  </div>

                  {selectedTemplateId && (() => {
                    const template = loadedTemplates.find(x => x.id === selectedTemplateId);
                    if (!template) return null;
                    return (
                      <div className="pt-2 border-t border-navy-100 animate-fade-in">
                        {/* Structure checklist */}
                        <div className="bg-navy-50/50 p-4 rounded-2xl border border-navy-150 space-y-3">
                          {template.presetData && (
                            <button
                              type="button"
                              onClick={() => {
                                if (template.presetData?.endereco) setEndereco(template.presetData.endereco);
                                if (template.presetData?.cidade) setCidade(template.presetData.cidade);
                                if (template.presetData?.vtr) setVtr(template.presetData.vtr);
                                if (template.presetData?.equipe) setEquipe(template.presetData.equipe);
                                if (template.presetData?.rawText) setRawText(template.presetData.rawText);
                              }}
                              className="w-full bg-pink-600 hover:bg-pink-700 text-white font-black py-2.5 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-pink-600/10 mb-2 uppercase tracking-wider"
                            >
                              <RefreshCw size={14} className="animate-spin-slow" />
                              Carregar Ocorrência de Exemplo (PMMS)
                            </button>
                          )}
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black text-pink-700 uppercase tracking-widest block">📋 Estrutura Padrão Recomendada</span>
                            {activeStepIndex < template.structure.length ? (
                              <span className="text-[9px] bg-indigo-100 text-indigo-800 font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                                PASSO {activeStepIndex + 1} ATIVO
                              </span>
                            ) : (
                              <span className="text-[9px] bg-emerald-100 text-emerald-800 font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                                CONCLUÍDO
                              </span>
                            )}
                          </div>
                          <ul className="space-y-2">
                            {template.structure.map((item, idx) => {
                              const isCompleted = template.stepRegexes && idx < activeStepIndex;
                              const isActive = template.stepRegexes && idx === activeStepIndex;
                              const hasSuggestion = template.stepSuggestions && template.stepSuggestions[idx];
                              
                              return (
                                <li 
                                  key={idx} 
                                  className={`text-xs leading-relaxed flex flex-col sm:flex-row sm:items-start justify-between gap-3 p-3 rounded-xl border transition-all ${
                                    isCompleted 
                                      ? 'bg-emerald-50/50 text-emerald-900 border-emerald-100 font-semibold' 
                                      : isActive
                                        ? 'bg-indigo-50 text-indigo-950 border-indigo-200 font-bold shadow-sm'
                                        : 'bg-white text-navy-500 border-navy-100 font-medium'
                                  }`}
                                >
                                  <div className="flex items-start gap-2">
                                    <span className={`shrink-0 mt-0.5 ${isCompleted ? 'text-emerald-600' : isActive ? 'text-indigo-600 animate-pulse' : 'text-navy-300'}`}>
                                      {isCompleted ? '✓' : isActive ? '●' : '○'}
                                    </span>
                                    <span>{item}</span>
                                  </div>
                                  
                                  {hasSuggestion && (
                                    <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0 mt-2 sm:mt-0">
                                      {isCompleted && (
                                        <span className="text-[9px] bg-emerald-100 text-emerald-800 font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                                          OK
                                        </span>
                                      )}
                                      {isActive && (
                                        <span className="text-[9px] bg-indigo-100 text-indigo-800 font-black px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                                          PRÓXIMO
                                        </span>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => insertSuggestionText(template.stepSuggestions![idx])}
                                        className={`text-[10px] font-black px-3 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer shadow-sm ${
                                          isActive
                                            ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/10'
                                            : 'bg-navy-50 hover:bg-navy-100 text-navy-700 border border-navy-200'
                                        }`}
                                      >
                                        <Plus size={10} />
                                        {isCompleted ? 'Inserir Novamente' : 'Inserir'}
                                      </button>
                                    </div>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Relato Bruto / Narrativa Inicial */}
            <div className="bg-white border border-navy-100 rounded-3xl p-5 md:p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-navy-50 pb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <FileText className="text-navy-600" size={20} />
                  <h3 className="text-navy-950 font-black uppercase tracking-tight text-lg">
                    2. Relato Bruto dos Fatos
                  </h3>
                </div>
                <div className="flex items-center gap-1.5 bg-pink-50 text-pink-600 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border border-pink-100">
                  <Lightbulb size={12} className="animate-bounce text-pink-600" />
                  Assistente de Redação Ativo
                </div>
              </div>

              <p className="text-navy-500 text-xs leading-relaxed">
                Digite os fatos colhidos em campo. Perguntas norteadoras e sugestões inteligentes aparecerão de forma dinâmica enquanto você digita ou faz uma pequena pausa.
              </p>

              {/* Área de Texto Principal com sistema inteligente de completagem por TAB / toque e perguntas de auxílio */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-navy-400 px-1">
                  <span>Escreva a Narrativa da Ocorrência</span>
                  {rawText.trim() && (
                    <button
                      type="button"
                      onClick={() => setRawText('')}
                      className="text-red-500 hover:underline cursor-pointer"
                    >
                      Limpar Campo
                    </button>
                  )}
                </div>

                <div className="border-2 border-navy-150 rounded-2xl overflow-hidden bg-navy-50 focus-within:border-navy-900 focus-within:bg-white transition-all shadow-sm">
                  
                  {/* Perguntas Norteadoras de Auxílio Embutidas (Pensar no Próximo Passo) */}
                  {(() => {
                    const stepInfo = getNextStepQuestions();
                    const activeStepInfo = getActiveStepInfo();
                    
                    if (activeStepInfo) {
                      return (
                        <div className="bg-indigo-50/60 border-b border-navy-150 p-4 text-xs transition-all">
                          <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                            <div className="flex items-center gap-1.5 text-indigo-900 font-bold">
                              <Sparkles size={14} className="text-indigo-600 animate-pulse shrink-0" />
                              <span className="uppercase text-[9px] font-black tracking-wider text-indigo-800">
                                Passo {activeStepInfo.index + 1} de {loadedTemplates.find(t => t.id === selectedTemplateId)?.structure.length || 0}
                              </span>
                            </div>
                            {activeStepInfo.index < (loadedTemplates.find(t => t.id === selectedTemplateId)?.structure.length || 0) && (
                              <span className="text-[9px] bg-indigo-100 text-indigo-800 font-black px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                                Ativo
                              </span>
                            )}
                          </div>
                          
                          <div className="text-navy-950 font-black text-xs mb-1.5 uppercase tracking-tight leading-relaxed">
                            {activeStepInfo.title}
                          </div>
                          
                          {activeStepInfo.suggestion && (
                            <div className="space-y-2 mt-2">
                              <p className="text-navy-600 text-[11px] leading-relaxed">
                                Sugestão de redação recomendada pela PMMS:
                              </p>
                              <div className="bg-white/80 p-2.5 rounded-xl border border-indigo-150 font-mono text-[10px] text-navy-800 font-semibold leading-relaxed relative group">
                                <span className="block italic">"{activeStepInfo.suggestion}"</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => insertSuggestionText(activeStepInfo.suggestion!)}
                                  className="text-[10px] bg-indigo-600 hover:bg-indigo-700 text-white font-black px-3.5 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1 shadow-sm shadow-indigo-600/10"
                                >
                                  <Plus size={12} />
                                  Inserir Frase Sugerida
                                </button>
                                <span className="text-[9px] text-navy-400 font-bold">
                                  ou pressione <kbd className="bg-navy-100 border border-navy-200 px-1 py-0.5 rounded text-navy-600 font-mono">TAB</kbd> no campo abaixo
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    }

                    return (
                      <div className="bg-navy-100/40 border-b border-navy-150 p-3.5 text-xs transition-all">
                        <div className="flex items-center gap-1.5 text-navy-900 font-bold mb-1.5">
                          <Lightbulb size={14} className="text-pink-600 animate-pulse shrink-0" />
                          <span className="uppercase text-[9px] font-black tracking-wider text-navy-800">🤔 PENSE NO PRÓXIMO PASSO: {stepInfo.title}</span>
                        </div>
                        <ul className="list-disc list-inside space-y-1 text-navy-600 text-[11px] font-semibold pl-1">
                          {stepInfo.questions.map((q, idx) => (
                            <li key={idx} className="leading-relaxed text-navy-700">{q}</li>
                          ))}
                        </ul>
                      </div>
                    );
                  })()}

                  {/* Textarea Principal com Ghost Text Overlay */}
                  <div className="relative bg-transparent min-h-[160px]">
                    {selectedTemplateId && isFocused && ghostText && (
                      <div 
                        ref={overlayRef}
                        className="absolute top-0 left-0 right-0 bottom-0 p-4 text-xs font-semibold font-mono leading-relaxed select-none pointer-events-none overflow-auto text-left"
                        style={{
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          scrollbarWidth: 'none'
                        }}
                      >
                        <span className="text-transparent">{rawText}</span>
                        <span className="text-navy-300 bg-navy-100/50 rounded px-1 border-b border-navy-300 animate-pulse">
                          {ghostText}
                        </span>
                      </div>
                    )}
                    <textarea
                      id="raw-narrative-input"
                      value={rawText}
                      onChange={(e) => setRawText(e.target.value)}
                      onKeyDown={handleKeyDown}
                      onScroll={handleScroll}
                      onFocus={() => setIsFocused(true)}
                      onBlur={() => setTimeout(() => setIsFocused(false), 200)}
                      placeholder="DIGITE AQUI O SEU RELATO... EX: ESTA EQUIPE POLICIAL EM PATRULHAMENTO SE DEPAROU COM..."
                      className="w-full min-h-[160px] p-4 text-xs font-semibold text-navy-950 bg-transparent border-0 outline-none resize-y font-mono leading-relaxed focus:ring-0 relative z-10"
                    />
                  </div>

                  {/* Autocomplete Bottom Bar Indicator */}
                  {selectedTemplateId && ghostText && (
                    <div className="bg-indigo-50/70 border-t border-navy-150 p-2.5 px-4 flex items-center justify-between text-xs animate-fade-in relative z-20">
                      <div className="flex items-center gap-2 text-indigo-950 font-bold truncate mr-4">
                        <span className="bg-indigo-600 text-white text-[9px] font-black uppercase px-1.5 py-0.5 rounded tracking-wider shrink-0 shadow-sm">TAB</span>
                        <span className="truncate text-indigo-700 font-semibold">
                          Sugestão de Autocompletar: <span className="font-bold italic text-indigo-950">"{ghostText.length > 50 ? ghostText.substring(0, 50) + '...' : ghostText}"</span>
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setRawText(prev => prev + ghostText)}
                        className="shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white font-black px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer shadow-md shadow-indigo-600/10"
                      >
                        <Check size={12} />
                        Aceitar
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* DYNAMIC AUTO-APPEARING ASSISTS PANEL (NO BUTTONS, AUTOMATIC AS USER TYPES) */}
              <div className="space-y-3 bg-navy-50/50 p-4 border border-navy-150 rounded-2xl">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-[10px] font-black text-navy-500 uppercase tracking-widest block">
                    ⚡ Guia de Conformidade do Manual PMMS
                  </span>
                  <span className="text-[9px] bg-pink-50 text-pink-600 px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider border border-pink-100">
                    {NARRATIVE_REQUIREMENTS.filter(req => req.regex.test(rawText)).length} de {NARRATIVE_REQUIREMENTS.length} Requisitos Atendidos
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-navy-100 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-pink-600 h-full transition-all duration-300"
                    style={{ width: `${(NARRATIVE_REQUIREMENTS.filter(req => req.regex.test(rawText)).length / NARRATIVE_REQUIREMENTS.length) * 100}%` }}
                  />
                </div>

                {/* Dynamic Hint Hub */}
                {rawText.trim() === '' ? (
                  <div className="p-3 bg-white border border-navy-150 rounded-xl space-y-1">
                    <span className="text-xs font-black text-navy-900 block flex items-center gap-1.5">
                      <Plus className="text-pink-500 w-4 h-4 shrink-0" />
                      1. Como tudo começou? (Acionamento)
                    </span>
                    <p className="text-[11px] text-navy-500 leading-relaxed">
                      Comece informando como sua guarnição tomou conhecimento ou deparou-se com a ocorrência. 
                      <strong className="text-navy-700 block mt-1">Dica de escrita: "Esta equipe policial em patrulhamento ostensivo preventivo..." ou "Acionados via Copom para averiguar..."</strong>
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Next Missing Step (Displays the FIRST unmet requirement as the focused next step) */}
                    {NARRATIVE_REQUIREMENTS.some(req => !req.regex.test(rawText)) ? (
                      (() => {
                        const nextStep = NARRATIVE_REQUIREMENTS.find(req => !req.regex.test(rawText));
                        if (!nextStep) return null;
                        
                        // Map next step key to user friendly icons & custom action titles
                        let icon = "📍";
                        let friendlyTitle = "";
                        let detailedGuide = "";
                        
                        if (nextStep.id === 'acionamento') {
                          icon = "📡";
                          friendlyTitle = "Acionamento Inicial";
                          detailedGuide = "Informe como a guarnição foi alertada ou deparou-se com o fato (Ex: via rádio, Copom, ou em patrulhamento ostensivo).";
                        } else if (nextStep.id === 'abordagem') {
                          icon = "🔍";
                          friendlyTitle = "Abordagem e Busca";
                          detailedGuide = "Descreva detalhadamente as buscas realizadas, se busca pessoal no suspeito ou busca no veículo deparado.";
                        } else if (nextStep.id === 'algemas') {
                          icon = "⛓️";
                          friendlyTitle = "Justificativa do Uso de Algemas";
                          detailedGuide = "Se utilizou algemas para segurança ou contenção, justifique em consonância com a Súmula Vinculante 11 (Ex: receio de fuga, resistência ou agressividade). Se não houver detenção/algema, pode ignorar.";
                        } else if (nextStep.id === 'direitos') {
                          icon = "⚖️";
                          friendlyTitle = "Direitos do Detido";
                          detailedGuide = "Se houver infrator/conduzido, lembre-se de informar que ele foi advertido quanto aos seus direitos constitucionais, incluindo o de permanecer em silêncio.";
                        } else if (nextStep.id === 'saude') {
                          icon = "🏥";
                          friendlyTitle = "Estado de Saúde e Lesões";
                          detailedGuide = "Registre formalmente as condições físicas e de integridade corporal dos envolvidos (Ex: conduzido sem lesões corporais visíveis ou encaminhado à UPA).";
                        } else if (nextStep.id === 'destino') {
                          icon = "🚓";
                          friendlyTitle = "Destino da Ocorrência";
                          detailedGuide = "Indique para qual local ou delegacia as partes e objetos apreendidos foram encaminhados (Ex: entregue à Delegacia de Polícia Civil para providências).";
                        }

                        return (
                          <div className="p-3 bg-pink-50/50 border border-pink-100 rounded-xl space-y-1 animate-fade-in">
                            <span className="text-xs font-black text-pink-700 block flex items-center gap-1.5">
                              <span>{icon}</span>
                              Sugestão de Próximo Passo: {friendlyTitle}
                            </span>
                            <p className="text-[11px] text-navy-700 leading-relaxed">
                              {detailedGuide}
                            </p>
                          </div>
                        );
                      })()
                    ) : (
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1 animate-fade-in">
                        <span className="text-xs font-black text-emerald-800 block flex items-center gap-1.5">
                          <CheckCircle className="text-emerald-600 w-4 h-4 shrink-0" />
                          Excelente! Seu Relato Atende Todas as Diretrizes!
                        </span>
                        <p className="text-[11px] text-emerald-700 leading-relaxed">
                          Todos os requisitos processuais mínimos (Acionamento, Abordagem, Justificativas e Condução) foram detectados no seu texto bruto. O seu histórico está completo e bem estruturado!
                        </p>
                      </div>
                    )}

                    {/* Compact Checklist Display to show what has been done */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-2 border-t border-dashed border-navy-150">
                      {NARRATIVE_REQUIREMENTS.map((req) => {
                        const detected = req.regex.test(rawText);
                        return (
                          <div
                            key={req.id}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[9px] font-bold transition-all ${
                              detected
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-white text-navy-400 border-navy-100'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${detected ? 'bg-emerald-500' : 'bg-navy-300'}`} />
                            <span className="truncate">{req.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* ACTION BUTTON TO ENHANCE NARRATIVE */}
            <div className="flex justify-center md:justify-end">
              <button
                id="btn-enhance-narrative"
                onClick={handleEnhance}
                disabled={isEnhancing || !rawText.trim()}
                className="w-full md:w-auto flex items-center justify-center gap-2 bg-pink-600 hover:bg-pink-700 text-white font-black py-4 px-8 rounded-2xl text-xs uppercase tracking-widest transition-all shadow-lg shadow-pink-600/20 disabled:opacity-50 active:scale-[0.98] cursor-pointer"
              >
                {isEnhancing ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    Formatando Histórico...
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    Gerar Histórico de Ocorrência (IA)
                  </>
                )}
              </button>
            </div>

            {/* Generated Results Card */}
            {enhancedText && (
              <div className="bg-navy-950 text-white rounded-3xl p-5 md:p-6 border border-navy-850 shadow-xl relative animate-fade-in space-y-4">
                <div className="flex items-center justify-between border-b border-navy-850 pb-4 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="text-pink-400 font-bold animate-pulse" size={20} />
                    <h4 className="font-black text-xs uppercase tracking-widest text-pink-300">Histórico Oficial PMMS Gerado</h4>
                  </div>
                  <button
                    id="btn-copy-enhanced"
                    onClick={() => copyToClipboard(enhancedText, setCopiedEnhanced)}
                    className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white px-3.5 py-2 rounded-xl text-[10px] font-black uppercase transition-all cursor-pointer"
                  >
                    {copiedEnhanced ? (
                      <>
                        <Check size={12} className="text-emerald-400" />
                        <span className="text-emerald-400">Copiado</span>
                      </>
                    ) : (
                      <>
                        <Copy size={12} />
                        <span>Copiar Texto</span>
                      </>
                    )}
                  </button>
                </div>

                <div 
                  id="enhanced-narrative-result"
                  className="text-xs font-semibold leading-relaxed font-mono whitespace-pre-wrap text-navy-100 p-3 max-h-[450px] overflow-y-auto uppercase border border-navy-850 bg-navy-900/30 rounded-2xl"
                >
                  {enhancedText}
                </div>
                
                <div className="p-3 bg-pink-950/20 rounded-2xl border border-pink-900/40 text-[10px] uppercase font-bold text-pink-200 leading-normal">
                  <i className="fas fa-info-circle mr-1.5"></i> Copie este texto e cole diretamente no formulário oficial do sistema Sigo/Boletim de Ocorrência.
                </div>
              </div>
            )}

          </div>
        )}

        {/* Tab 3: Advisor (Operational Guide Chat) */}
        {activeTab === 'advisor' && (
          <div className="bg-white border border-navy-100 rounded-3xl p-6 shadow-sm flex flex-col min-h-[500px]">
            <div className="border-b border-navy-100 pb-3 mb-4">
              <h3 className="text-navy-950 font-black uppercase tracking-tight text-lg flex items-center gap-2">
                <MessageSquare className="text-navy-600" size={20} />
                Consultor de POP e Procedimento
              </h3>
              <p className="text-navy-500 text-xs mt-1">
                Faça perguntas operacionais sobre apreensões, como qualificar acusados, cadeia de custódia, ou procedimentos de conduta.
              </p>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 space-y-4 max-h-[380px] overflow-y-auto mb-4 p-2" id="chat-messages-container">
              {chatMessages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm font-medium leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-navy-950 text-white rounded-br-none font-bold'
                        : 'bg-navy-50 text-navy-900 rounded-bl-none border border-navy-100 font-semibold'
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{msg.text}</div>
                  </div>
                </div>
              ))}
              {isAnswering && (
                <div className="flex justify-start animate-pulse">
                  <div className="bg-navy-50 text-navy-900 rounded-2xl rounded-bl-none border border-navy-100 px-4 py-3 text-xs font-black uppercase tracking-widest">
                    <span>Analisando diretrizes e formulando resposta...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Suggestions Cards */}
            {chatMessages.length === 1 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <button
                  id="suggest-clone-vehicle"
                  onClick={() => setChatInput('Como prosseguir na abordagem de veículo suspeito com sinal identificador adulterado (clone)?')}
                  className="text-left p-3 border border-navy-100 hover:border-navy-300 rounded-xl text-xs text-navy-600 font-bold bg-navy-50/50 hover:bg-white transition-all flex flex-col justify-between"
                >
                  <span>MOTO/CARRO CLONADO</span>
                  <span className="text-[10px] text-indigo-600 font-black mt-2 uppercase tracking-wide">Qual enquadramento e POP? →</span>
                </button>
                <button
                  id="suggest-drug-weighing"
                  onClick={() => setChatInput('Quais as diretrizes corretas para narrar a pesagem e apreensão de substâncias entorpecentes em biqueira?')}
                  className="text-left p-3 border border-navy-100 hover:border-navy-300 rounded-xl text-xs text-navy-600 font-bold bg-navy-50/50 hover:bg-white transition-all flex flex-col justify-between"
                >
                  <span>APREENSÃO DE DROGAS</span>
                  <span className="text-[10px] text-indigo-600 font-black mt-2 uppercase tracking-wide">Como descrever materiais? →</span>
                </button>
                <button
                  id="suggest-search-warrant"
                  onClick={() => setChatInput('Quais as condições exigidas pelo STJ/STF hoje para validação de entrada em domicílio sem mandado judicial?')}
                  className="text-left p-3 border border-navy-100 hover:border-navy-300 rounded-xl text-xs text-navy-600 font-bold bg-navy-50/50 hover:bg-white transition-all flex flex-col justify-between"
                >
                  <span>VIOLAÇÃO DE DOMICÍLIO</span>
                  <span className="text-[10px] text-indigo-600 font-black mt-2 uppercase tracking-wide">Verificar julgados de invasão →</span>
                </button>
                <button
                  id="suggest-saw-protocol"
                  onClick={() => setChatInput('Quais informações sobre o indivíduo devem obrigatoriamente constar na narrativa e consulta do sistema?')}
                  className="text-left p-3 border border-navy-100 hover:border-navy-300 rounded-xl text-xs text-navy-600 font-bold bg-navy-50/50 hover:bg-white transition-all flex flex-col justify-between"
                >
                  <span>CADASTRO DE INDIVÍDUO</span>
                  <span className="text-[10px] text-indigo-600 font-black mt-2 uppercase tracking-wide">Campos cruciais no R.O. →</span>
                </button>
              </div>
            )}

            {/* Input Bar */}
            <div className="flex gap-2 items-center bg-navy-50 p-2 border-2 border-navy-100 focus-within:border-navy-900 rounded-2xl transition-all">
              <input
                id="advisor-chat-input"
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendChatMessage()}
                placeholder="Ex: Qual o procedimento correto para flagrante de receptação?"
                className="flex-1 bg-transparent border-none outline-none text-sm font-semibold text-navy-950 px-2 py-1 placeholder:text-navy-400"
              />
              <button
                id="btn-send-advisor-chat"
                onClick={handleSendChatMessage}
                disabled={isAnswering || !chatInput.trim()}
                className="bg-navy-950 hover:bg-navy-800 text-white p-2.5 rounded-xl transition-all disabled:opacity-50"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RoAssistant;
