import React, { useState, useEffect, useCallback } from 'react';
import { db, handleFirestoreError, OperationType, logAction } from '../firebase';
import { collection, query, orderBy, getDocs, doc, setDoc, updateDoc, deleteDoc, writeBatch, onSnapshot } from 'firebase/firestore';
import { User, UserRole } from '../types';
import { Plus, Edit2, Trash2, FileText, Check, RefreshCw, AlertTriangle, Save, X, PlusCircle, ArrowLeft, ClipboardList } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface OccurrenceTemplate {
  id: string;
  label: string;
  defaultNature: string;
  structure: string[];
  referenceModel: string;
  referenceModels?: string[];
  stepRegexes?: string[]; // stored as string regex patterns
  stepSuggestions?: string[];
  presetData?: {
    cidade?: string;
    endereco?: string;
    vtr?: string;
    equipe?: string;
    rawText?: string;
  };
}

interface RoTemplatesProps {
  user: User | null;
}

const DEFAULT_TEMPLATES_TO_SEED: OccurrenceTemplate[] = [
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
      "patrulha|acionad|copom|vtr|viatura",
      "contato|vítima|solicitante|relatou|maria|rosalina",
      "testemunha|presenciou|ronaldo",
      "autor|suspeito|sinais|embriaguez|agressiv|revista|faca",
      "manifest|represent|prisão|voz|direitos|silêncio",
      "conduzido|entregue|delegacia|lesões"
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
      "patrulha|ostensivo|preventivo|deparou",
      "aborda|suspeito|nervos|fuga|descarte",
      "busca pessoal|revelou|posse|drog|maconha|invóluc|células|moed|dinheiro",
      "prisão|direitos|silêncio|voz de|algema",
      "conduzido|lesões|delegacia|entorpecente"
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
      rawText: `Esta equipe policial militar, em patrulhamento ostensivo preventivo na Avenida Brasil, se deparou com o autor em atitude suspeita. Procedida à abordagem do indivíduo, foi revelada na busca pessoal a posse de 12 invólucros de substância análoga à maconha e a quantia de R$ 150,00 em cédulas fracionadas, além de um aparelho celular de marca Samsung. Indagado, o autor confessou a prática do tráfico. Diante dos fatos, foi dada voz de prisão ao conduzido, sendo-lhe devidamente apresentados e lidos os direitos constitucionais, incluindo o de permanecer em silêncio. Foi empregado o uso de algemas em razão de comportamento agressivo e risco de fuga, preservando a integridade física de todos. O envolvido foi conduzido sem lesões corporais visíveis à delegacia de polícia civil juntamente com o entorpecente para as providências cabíveis.`
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
      "acionada|copom|chamado|emergência",
      "contato|vítima|lesões|agredida|ameaçada",
      "separ|aborda|quintal|residência|segurança",
      "prisão|lei maria da penha|direitos|silêncio|algema",
      "upa|atendimento médico|conduzidas|delegacia|deam|providências"
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
      "composta|acionada|viatura|solicitação|riquelme",
      "local|constatou|discussão|injuriada|madeira|faca|agredi",
      "lesão|hematoma|escoriações|corte|sangramento|embriaguez|fala|etílico",
      "anterior|semelhante|entrada|autorizada|proprietário|tibúrcio",
      "buscas|procura|localizados|descarte|matagal|sumiu",
      "prisão|direitos|conduzido|trajeto|ameaças|hospital|atendimento|delegacia"
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
      "equipe|viatura|patrulhamento|abordada",
      "solicitante|marido|elza|jordemir|marques",
      "pedra|madeira|garrafa|estilhaços|corte|sangramento|agressão",
      "recusou|médico|upa|pronto socorro",
      "diligências|rondas|busca|localizar|encontrar|êxito",
      "registrado|encaminhado|delegacia|civil|providências"
    ],
    stepSuggestions: [
      'ESTA EQUIPE POLICIAL, COMPOSTA PELO CABO HELENILSO E PELO SOLDADO ALBERT, A BORDO DA VIATURA 10-3355, REALIZAVA POLICIAMENTO OSTENSIVO E PREVENTIVO NO MUNICÍPIO DE ALCINÓPOLIS QUANDO FOI ABORDADA, NA RUA EMÍLIO OSCAR NEUBERT, PELA SOLICITANTE. ',
      'A SOLICITANTE SENHORA ELZA MARIA DOS SANTOS (CPF: 967.695.991-04) RELATOU QUE SEU MARIDO, O SENHOR JORDEMIR MARQUES GOMES (CPF: 056.025.871-28), HAVIA SIDO AGREDIDO POR UM INDIVÍDUO IDENTIFICADO COMO EVER JOSE MEDINA MEJIAS, CONHECIDO PELA ALCUNHA DE "VENEZUELANO". ',
      'SEGUNDO O RELATO COLHIDO NO LOCAL, O AUTOR TERIA ARREMESSADO UMA PEDRA CONTRA A SENHORA ELZA. DIANTE DA SITUAÇÃO, O SENHOR JORDEMIR TENTOU DEFENDÊ-LA UTILIZANDO UM PEDAÇO DE MADEIRA, MAS O AUTOR LANÇOU UMA GARRAFA DE VIDRO QUE, AO QUEBRAR, ATINGIU A PERNA ESQUERDA DA VÍTIMA WITH ESTILHAÇOS, PROVOCANDO CORTE E SANGRAMENTO INTENSO. ',
      'APESAR DA LESÃO CONSTATADA PELA EQUIPE POLICIAL NO LOCAL, O SENHOR JORDEMIR MARQUES GOMES RECUSOU SER ENCAMINHADO PARA ATENDIMENTO MÉDICO OR PRONTO SOCORRO. ',
      'DIANTE DOS FATOS, ESTA EQUIPE REALIZOU DILIGÊNCIAS E RONDAS EM VIA PÚBLICA NAS IMEDIAÇÕES COM O INTUITO DE LOCALIZAR O AUTOR, PORÉM NÃO LOGROU ÊXITO EM ENCONTRÁ-LO ATÉ O ENCERRAMENTO DESTA OCORRÊNCIA. ',
      'CABE RESSALTAR QUE FOI VERIFICADO QUE OS ENVOLVIDOS JÁ POSSUEM REGISTROS DE OCORRÊNCIAS ANTERIORES. O CASO FOI REGISTRADO E ENCAMINHADO À DELEGACIA DE POLÍCIA DE ALCINÓPOLIS PARA AS PROVIDÊNCIAS LEGAIS CABÍVEIS. '
    ],
    referenceModel: `ESTA EQUIPE POLICIAL, COMPOSTA PELO CABO HELENILSO E PELO SOLDADO ALBERT, A BORDO DA VIATURA 10-3355, REALIZAVA POLICIAMENTO OSTENSIVO E PREVENTIVO NO MUNICÍPIO DE ALCINÓPOLIS QUANDO FOI ABORDADA, NA RUA EMÍLIO OSCAR NEUBERT, PELA SENHORA ELZA MARIA DOS SANTOS (CPF: 967.695.991-04). A SOLICITANTE RELATOU QUE SEU MARIDO, O SENHOR JORDEMIR MARQUES GOMES (CPF: 056.025.871-28), HAVIA SIDO AGREDIDO POR UM INDIVÍDUO IDENTIFICADO COMO EVER JOSE MEDINA MEJIAS, CONHECIDO PELA ALCUNHA DE "VENEZUELANO". SEGUNDO O RELATO COLHIDO NO LOCAL, O AUTOR TERIA ARREMESSADO UMA PEDRA CONTRA A SENHORA ELZA. DIANTE DA SITUAÇÃO, O SENHOR JORDEMIR TENTOU DEFENDÊ-LA UTILIZANDO UM PEDAÇO DE MADEIRA. NA SEQUÊNCIA, O AUTOR LANÇOU UMA GARRAFA DE VIDRO QUE, AO QUEBRAR, ATINGIU A PERNA ESQUERDA DA VÍTIMA COM ESTILHAÇOS, PROVOCANDO UM CORTE E SANGRAMENTO INTENSO. APESAR DA LESÃO CONSTATADA PELA EQUIPE, O SENHOR JORDEMIR RECUSOU SER ENCAMINHADO PARA ATENDIMENTO MÉDICO. DIANTE DOS FATOS, ESTA EQUIPE REALIZOU DILIGÊNCIAS E RONDAS EM VIA PÚBLICA NAS IMEDIAÇÕES COM O INTUITO DE LOCALIZAR O AUTOR, PORÉM NÃO LOGROU ÊXITO EM ENCONTRÁ-LO ATÉ O ENCERRAMENTO DESTA OCORRÊNCIA. FOI VERIFICADO QUE OS ENVOLVIDOS JÁ POSSUEM REGISTROS DE OCORRÊNCIAS ANTERIORES. O CASO FOI REGISTRADO E ENCAMINHADO À DELEGACIA DE POLÍCIA DE ALCINÓPOLIS PARA AS PROVIDÊNCIAS LEGAIS CABÍVEIS.`,
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
      "equipe|viatura|acionada|furto",
      "contato|vítima|constatado|juarez|silva",
      "energia|lateral|janela|arrombamento|jukebox|subtraiu|moedas|doces|bebidas",
      "câmeras|segurança|imagens|monitoramento",
      "contaminado|perícia",
      "orientado|comparecer|delegacia|civil|investigações"
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

const RoTemplates: React.FC<RoTemplatesProps> = ({ user }) => {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<OccurrenceTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<OccurrenceTemplate | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError: boolean } | null>(null);

  // Form Field States
  const [formId, setFormId] = useState('');
  const [formLabel, setFormLabel] = useState('');
  const [formNature, setFormNature] = useState('');
  const [formStructure, setFormStructure] = useState<string[]>([]);
  const [formRegexes, setFormRegexes] = useState<string[]>([]);
  const [formSuggestions, setFormSuggestions] = useState<string[]>([]);
  const [formReferenceModel, setFormReferenceModel] = useState('');
  
  // Preset Data States
  const [presetCidade, setPresetCidade] = useState('');
  const [presetEndereco, setPresetEndereco] = useState('');
  const [presetVtr, setPresetVtr] = useState('');
  const [presetEquipe, setPresetEquipe] = useState('');
  const [presetRawText, setPresetRawText] = useState('');

  // Auxiliary state for adding structural items
  const [newStructureText, setNewStructureText] = useState('');
  const [newRegexText, setNewRegexText] = useState('');
  const [newSuggestionText, setNewSuggestionText] = useState('');

  const isMaster = user?.role === UserRole.MASTER || user?.role === UserRole.ADMIN;

  useEffect(() => {
    // Realtime listener for templates
    const q = query(collection(db, 'ro_templates'), orderBy('label', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as OccurrenceTemplate));
      setTemplates(list);
      setIsLoading(false);
    }, (error) => {
      console.error("Error loading templates:", error);
      handleFirestoreError(error, OperationType.LIST, 'ro_templates');
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSeedDefaults = async () => {
    setIsSaving(true);
    setStatusMessage({ text: 'Injetando modelos padrão na base de dados...', isError: false });
    try {
      const batch = writeBatch(db);
      for (const t of DEFAULT_TEMPLATES_TO_SEED) {
        const ref = doc(db, 'ro_templates', t.id);
        batch.set(ref, t);
      }
      await batch.commit();
      
      await logAction(
        user?.id || '',
        user?.nome || 'Sistema',
        'TEMPLATE_SEED',
        'Modelos padrão de RO injetados e redefinidos pelo MASTER.',
        {}
      );

      setStatusMessage({ text: 'Modelos padrão injetados com sucesso!', isError: false });
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err: any) {
      console.error("Error seeding:", err);
      setStatusMessage({ text: 'Erro ao injetar padrões: ' + err.message, isError: true });
    } finally {
      setIsSaving(false);
    }
  };

  const startEdit = (t: OccurrenceTemplate) => {
    setSelectedTemplate(t);
    setFormId(t.id);
    setFormLabel(t.label);
    setFormNature(t.defaultNature);
    setFormStructure(t.structure || []);
    setFormRegexes(t.stepRegexes || []);
    setFormSuggestions(t.stepSuggestions || []);
    setFormReferenceModel(t.referenceModel || '');
    
    setPresetCidade(t.presetData?.cidade || '');
    setPresetEndereco(t.presetData?.endereco || '');
    setPresetVtr(t.presetData?.vtr || '');
    setPresetEquipe(t.presetData?.equipe || '');
    setPresetRawText(t.presetData?.rawText || '');

    setIsEditing(true);
    setIsCreating(false);
  };

  const startCreate = () => {
    setFormId('');
    setFormLabel('');
    setFormNature('');
    setFormStructure([]);
    setFormRegexes([]);
    setFormSuggestions([]);
    setFormReferenceModel('');
    
    setPresetCidade('');
    setPresetEndereco('');
    setPresetVtr('');
    setPresetEquipe('');
    setPresetRawText('');

    setNewStructureText('');
    setNewRegexText('');
    setNewSuggestionText('');

    setIsEditing(false);
    setIsCreating(true);
    setSelectedTemplate(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formId.trim() || !formLabel.trim() || !formNature.trim() || !formReferenceModel.trim()) {
      setStatusMessage({ text: 'Por favor, preencha todos os campos obrigatórios.', isError: true });
      return;
    }

    const cleanId = formId.toLowerCase().trim().replace(/[^a-z0-9_-]/g, '_');

    setIsSaving(true);
    setStatusMessage({ text: 'Salvando modelo de ocorrência...', isError: false });

    const payload: OccurrenceTemplate = {
      id: cleanId,
      label: formLabel.trim(),
      defaultNature: formNature.toUpperCase().trim(),
      structure: formStructure,
      referenceModel: formReferenceModel.trim(),
      stepRegexes: formRegexes,
      stepSuggestions: formSuggestions,
      presetData: {
        cidade: presetCidade.trim() || undefined,
        endereco: presetEndereco.trim() || undefined,
        vtr: presetVtr.trim() || undefined,
        equipe: presetEquipe.trim() || undefined,
        rawText: presetRawText.trim() || undefined,
      }
    };

    try {
      await setDoc(doc(db, 'ro_templates', cleanId), payload);

      await logAction(
        user?.id || '',
        user?.nome || 'Sistema',
        isCreating ? 'TEMPLATE_CREATED' : 'TEMPLATE_UPDATED',
        `Modelo de ocorrência "${payload.label}" (${payload.id}) foi salvo pelo MASTER.`,
        { templateId: payload.id }
      );

      setStatusMessage({ text: `Modelo "${payload.label}" salvo com sucesso!`, isError: false });
      setTimeout(() => setStatusMessage(null), 3000);
      setIsEditing(false);
      setIsCreating(false);
      setSelectedTemplate(payload);
    } catch (err: any) {
      console.error("Error saving template:", err);
      setStatusMessage({ text: 'Erro operacional ao salvar: ' + err.message, isError: true });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (templateId: string, label: string) => {
    if (!window.confirm(`Tem certeza absoluta de que deseja excluir o modelo de ocorrência "${label}"?`)) {
      return;
    }

    setIsSaving(true);
    setStatusMessage({ text: 'Excluindo modelo...', isError: false });
    try {
      await deleteDoc(doc(db, 'ro_templates', templateId));

      await logAction(
        user?.id || '',
        user?.nome || 'Sistema',
        'TEMPLATE_DELETED',
        `Modelo de ocorrência "${label}" (${templateId}) foi excluído pelo MASTER.`,
        { templateId }
      );

      setStatusMessage({ text: 'Modelo excluído com sucesso!', isError: false });
      setTimeout(() => setStatusMessage(null), 3000);
      setSelectedTemplate(null);
      setIsEditing(false);
    } catch (err: any) {
      console.error("Error deleting template:", err);
      setStatusMessage({ text: 'Erro ao excluir modelo: ' + err.message, isError: true });
    } finally {
      setIsSaving(false);
    }
  };

  const addStructureStep = () => {
    if (!newStructureText.trim()) return;
    
    setFormStructure(prev => [...prev, newStructureText.trim()]);
    setFormRegexes(prev => [...prev, newRegexText.trim() || '.*']);
    setFormSuggestions(prev => [...prev, newSuggestionText.trim()]);

    setNewStructureText('');
    setNewRegexText('');
    setNewSuggestionText('');
  };

  const removeStructureStep = (index: number) => {
    setFormStructure(prev => prev.filter((_, i) => i !== index));
    setFormRegexes(prev => prev.filter((_, i) => i !== index));
    setFormSuggestions(prev => prev.filter((_, i) => i !== index));
  };

  const filteredTemplates = templates.filter(t => 
    t.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.defaultNature.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isMaster) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="bg-red-50 p-6 rounded-full mb-6">
          <AlertTriangle className="text-red-500 w-16 h-16" />
        </div>
        <h2 className="text-3xl font-black text-navy-950 mb-4 font-mono">Acesso Restrito</h2>
        <p className="text-navy-400 uppercase font-black text-xs tracking-widest max-w-md">
          Apenas administradores MASTER ou ADMIN do sistema possuem autorização para gerenciar e calibrar os modelos de Ocorrências (RO).
        </p>
        <button
          onClick={() => navigate('/')}
          className="mt-6 bg-navy-900 hover:bg-navy-800 text-white font-black py-3 px-6 rounded-xl uppercase text-xs transition-all flex items-center gap-2 cursor-pointer"
        >
          <ArrowLeft size={14} /> Voltar ao Início
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-navy-100 pb-6">
        <div>
          <h2 className="text-3xl font-black text-navy-950 uppercase tracking-tighter flex items-center gap-3">
            <ClipboardList className="text-pink-600 w-8 h-8" />
            Modelos de Ocorrência (RO)
          </h2>
          <p className="text-navy-400 text-xs uppercase font-black tracking-widest mt-1">
            Gestão e Calibração de Estruturas, Sugestões e Modelos de Referência para o Assistente PMMS
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSeedDefaults}
            disabled={isSaving}
            className="bg-navy-50 border border-navy-150 text-navy-900 hover:bg-navy-100 font-black py-2.5 px-4 rounded-xl text-xs uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer"
            title="Redefine a base de dados com as 6 ocorrências padrão do sistema"
          >
            <RefreshCw size={14} className={isSaving ? 'animate-spin' : ''} />
            Injetar Padrões PMMS
          </button>
          <button
            onClick={startCreate}
            className="bg-pink-600 hover:bg-pink-700 text-white font-black py-2.5 px-4 rounded-xl text-xs uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-md shadow-pink-600/10"
          >
            <Plus size={14} /> Novo Modelo
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className={`p-4 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-3 border ${
          statusMessage.isError ? 'bg-red-50 text-red-700 border-red-100' : 'bg-green-50 text-green-700 border-green-100'
        }`}>
          <Check size={16} />
          {statusMessage.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Templates List Side */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-navy-100 space-y-3">
            <span className="text-[10px] font-black text-navy-400 uppercase tracking-widest block">Pesquisa</span>
            <div className="relative">
              <input
                type="text"
                placeholder="Filtrar por nome, fato..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-navy-50/50 border border-navy-100 rounded-xl py-2 px-3 text-xs text-navy-900 focus:outline-none focus:border-navy-300"
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-navy-100 overflow-hidden max-h-[600px] overflow-y-auto">
            <div className="bg-navy-50/50 px-4 py-3 border-b border-navy-100 flex items-center justify-between">
              <span className="text-[10px] font-black text-navy-900 uppercase tracking-widest">Modelos Disponíveis ({filteredTemplates.length})</span>
            </div>
            {isLoading ? (
              <div className="p-8 text-center text-navy-400 text-xs font-black uppercase tracking-widest animate-pulse">
                Carregando Modelos...
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="p-8 text-center text-navy-400 text-xs">
                Nenhum modelo encontrado. Clique em "Injetar Padrões PMMS" para começar.
              </div>
            ) : (
              <div className="divide-y divide-navy-50">
                {filteredTemplates.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setSelectedTemplate(t);
                      setIsEditing(false);
                      setIsCreating(false);
                    }}
                    className={`w-full text-left p-4 transition-all flex items-start gap-3 hover:bg-navy-50/50 ${
                      selectedTemplate?.id === t.id ? 'bg-navy-50 border-l-4 border-pink-600' : ''
                    }`}
                  >
                    <div className="bg-navy-100 p-2 rounded-lg text-navy-700 mt-0.5">
                      <FileText size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm text-navy-900 truncate">{t.label}</div>
                      <div className="text-[10px] font-black text-navy-400 uppercase tracking-wider mt-0.5">{t.defaultNature}</div>
                      <div className="text-[10px] text-pink-600 font-semibold mt-1">{t.structure?.length || 0} Passos estruturados</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* View / Edit Detail Area */}
        <div className="lg:col-span-8">
          {isEditing || isCreating ? (
            <form onSubmit={handleSave} className="bg-white p-6 rounded-3xl border border-navy-150 space-y-6">
              <div className="flex items-center justify-between border-b border-navy-100 pb-4">
                <h3 className="text-lg font-black text-navy-950 uppercase tracking-tight">
                  {isCreating ? 'Criar Novo Modelo de RO' : `Editar Modelo: ${formLabel}`}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    setIsCreating(false);
                  }}
                  className="text-navy-400 hover:text-navy-900 transition-all p-1"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Core Information Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-navy-400 uppercase tracking-widest block">Identificador ID (Ex: furto, ameaca)*</label>
                  <input
                    type="text"
                    value={formId}
                    onChange={(e) => setFormId(e.target.value)}
                    disabled={isEditing}
                    placeholder="id_unico_da_ocorrencia"
                    className="w-full bg-navy-50/50 border border-navy-100 rounded-xl py-2.5 px-3 text-xs text-navy-900 focus:outline-none focus:border-navy-300 disabled:opacity-60 font-mono"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-navy-400 uppercase tracking-widest block">Nome / Rótulo de Exibição*</label>
                  <input
                    type="text"
                    value={formLabel}
                    onChange={(e) => setFormLabel(e.target.value)}
                    placeholder="Ex: Violência Doméstica"
                    className="w-full bg-navy-50/50 border border-navy-100 rounded-xl py-2.5 px-3 text-xs text-navy-900 focus:outline-none focus:border-navy-300"
                    required
                  />
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-[10px] font-black text-navy-400 uppercase tracking-widest block">Natureza Padrão do Boletim*</label>
                  <input
                    type="text"
                    value={formNature}
                    onChange={(e) => setFormNature(e.target.value)}
                    placeholder="Ex: VIOLÊNCIA DOMÉSTICA"
                    className="w-full bg-navy-50/50 border border-navy-100 rounded-xl py-2.5 px-3 text-xs text-navy-900 focus:outline-none focus:border-navy-300"
                    required
                  />
                </div>
              </div>

              {/* Recommended Steps & Checklist */}
              <div className="space-y-4 border-t border-navy-100 pt-4">
                <span className="text-[10px] font-black text-navy-400 uppercase tracking-widest block">Mapeamento de Passos Estruturados</span>
                
                {formStructure.length > 0 && (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {formStructure.map((step, idx) => (
                      <div key={idx} className="bg-navy-50/50 p-3 rounded-xl border border-navy-100 flex items-start justify-between gap-3 text-xs">
                        <div className="flex-1 space-y-1">
                          <div className="font-bold text-navy-900">{step}</div>
                          <div className="text-[9px] text-navy-400 font-mono">Regex: <span className="text-pink-600 font-semibold">/{formRegexes[idx]}/i</span></div>
                          {formSuggestions[idx] && (
                            <div className="text-[10px] text-teal-700 bg-teal-50 p-1.5 rounded mt-1 italic">Sugestão: {formSuggestions[idx]}</div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeStructureStep(idx)}
                          className="text-red-500 hover:text-red-700 p-1"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Adding new item */}
                <div className="bg-navy-50 p-4 rounded-2xl border border-navy-150 space-y-3">
                  <span className="text-[9px] font-black text-navy-600 uppercase tracking-widest block">Adicionar Passo / Tópico</span>
                  
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Ex: 1. ACIONAMENTO: Viatura, equipe e forma de acionamento."
                      value={newStructureText}
                      onChange={(e) => setNewStructureText(e.target.value)}
                      className="w-full bg-white border border-navy-100 rounded-xl py-2 px-3 text-xs text-navy-900 focus:outline-none"
                    />
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Regex de Validação (Ex: composto|vtr|viatura)"
                        value={newRegexText}
                        onChange={(e) => setNewRegexText(e.target.value)}
                        className="w-full bg-white border border-navy-100 rounded-xl py-2 px-3 text-xs text-navy-900 focus:outline-none font-mono text-pink-600"
                      />
                      <input
                        type="text"
                        placeholder="Texto Sugerido / Snippet para Autocomplete"
                        value={newSuggestionText}
                        onChange={(e) => setNewSuggestionText(e.target.value)}
                        className="w-full bg-white border border-navy-100 rounded-xl py-2 px-3 text-xs text-navy-900 focus:outline-none"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={addStructureStep}
                    className="w-full bg-navy-900 hover:bg-navy-800 text-white font-black py-2 px-4 rounded-xl text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <PlusCircle size={12} /> Incluir Passo ao Modelo
                  </button>
                </div>
              </div>

              {/* Reference Text Model */}
              <div className="space-y-1.5 border-t border-navy-100 pt-4">
                <label className="text-[10px] font-black text-navy-400 uppercase tracking-widest block">Relatório de Exemplo Oficial / Modelo de Referência*</label>
                <textarea
                  rows={6}
                  value={formReferenceModel}
                  onChange={(e) => setFormReferenceModel(e.target.value)}
                  placeholder="Cole aqui o texto final completo e ideal deste tipo de boletim, servindo de modelo de treinamento e base de comparação..."
                  className="w-full bg-navy-50/50 border border-navy-100 rounded-xl py-2.5 px-3 text-xs text-navy-900 focus:outline-none focus:border-navy-300 font-mono resize-y"
                  required
                />
              </div>

              {/* Quick Preset Data */}
              <div className="space-y-4 border-t border-navy-100 pt-4">
                <div>
                  <span className="text-[10px] font-black text-navy-400 uppercase tracking-widest block">Dados de Preenchimento Rápido / Exemplo PMMS</span>
                  <p className="text-[10px] text-navy-400">Dados fictícios para preenchimento de teste com o botão vermelho do assistente.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-navy-400 uppercase tracking-wider">Cidade</label>
                    <input
                      type="text"
                      value={presetCidade}
                      onChange={(e) => setPresetCidade(e.target.value)}
                      placeholder="Ex: ALCINÓPOLIS"
                      className="w-full bg-navy-50/50 border border-navy-100 rounded-xl py-2 px-3 text-xs text-navy-900 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-navy-400 uppercase tracking-wider">Endereço / Logradouro</label>
                    <input
                      type="text"
                      value={presetEndereco}
                      onChange={(e) => setPresetEndereco(e.target.value)}
                      placeholder="Ex: RUA URSINO COELHO DE SOUZA"
                      className="w-full bg-navy-50/50 border border-navy-100 rounded-xl py-2 px-3 text-xs text-navy-900 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-navy-400 uppercase tracking-wider">Viatura (Prefixo/Pref)</label>
                    <input
                      type="text"
                      value={presetVtr}
                      onChange={(e) => setPresetVtr(e.target.value)}
                      placeholder="Ex: 10-3355"
                      className="w-full bg-navy-50/50 border border-navy-100 rounded-xl py-2 px-3 text-xs text-navy-900 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-navy-400 uppercase tracking-wider">Equipe Policial</label>
                    <input
                      type="text"
                      value={presetEquipe}
                      onChange={(e) => setPresetEquipe(e.target.value)}
                      placeholder="Ex: 3º SGT SILVÉRIO, SD EDUARDA OLIVEIRA"
                      className="w-full bg-navy-50/50 border border-navy-100 rounded-xl py-2 px-3 text-xs text-navy-900 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black text-navy-400 uppercase tracking-wider">Texto Bruto do Relatório de Entrada (Rascunho Policial)</label>
                  <textarea
                    rows={4}
                    value={presetRawText}
                    onChange={(e) => setPresetRawText(e.target.value)}
                    placeholder="O texto desorganizado ou em rascunho que simula o preenchimento inicial pelo operador..."
                    className="w-full bg-navy-50/50 border border-navy-100 rounded-xl py-2 px-3 text-xs text-navy-900 focus:outline-none font-mono"
                  />
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex items-center justify-end gap-3 border-t border-navy-100 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    setIsCreating(false);
                  }}
                  className="bg-navy-50 hover:bg-navy-100 text-navy-900 font-black py-2.5 px-5 rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="bg-pink-600 hover:bg-pink-700 text-white font-black py-2.5 px-6 rounded-xl text-xs uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Save size={14} /> Salvar Modelo
                </button>
              </div>
            </form>
          ) : selectedTemplate ? (
            <div className="bg-white p-6 rounded-3xl border border-navy-150 space-y-6 animate-fade-in">
              {/* Detail Header */}
              <div className="flex items-start justify-between border-b border-navy-100 pb-4">
                <div>
                  <h3 className="text-xl font-black text-navy-900">{selectedTemplate.label}</h3>
                  <div className="text-[10px] font-black text-navy-400 uppercase tracking-widest mt-1">ID: {selectedTemplate.id}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => startEdit(selectedTemplate)}
                    className="bg-navy-50 hover:bg-navy-100 text-navy-900 p-2.5 rounded-xl border border-navy-150 transition-all flex items-center justify-center cursor-pointer"
                    title="Editar"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(selectedTemplate.id, selectedTemplate.label)}
                    className="bg-red-50 hover:bg-red-100 text-red-600 p-2.5 rounded-xl border border-red-100 transition-all flex items-center justify-center cursor-pointer"
                    title="Excluir"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Detail Content */}
              <div className="space-y-4">
                <div>
                  <span className="text-[10px] font-black text-navy-400 uppercase tracking-widest block">Natureza Principal</span>
                  <span className="text-sm font-bold text-navy-900 bg-navy-50 px-3 py-1.5 rounded-lg border border-navy-100 inline-block mt-1 font-mono">
                    {selectedTemplate.defaultNature}
                  </span>
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] font-black text-navy-400 uppercase tracking-widest block">Estrutura de Checklist ({selectedTemplate.structure?.length || 0} Passos)</span>
                  <div className="space-y-1.5">
                    {selectedTemplate.structure?.map((step, idx) => (
                      <div key={idx} className="bg-navy-50/30 p-3 rounded-xl border border-navy-100 text-xs text-navy-800 space-y-1">
                        <div className="font-semibold text-navy-950">{step}</div>
                        {selectedTemplate.stepRegexes?.[idx] && (
                          <div className="text-[9px] text-navy-400 font-mono">
                            Regex: <span className="text-pink-600 font-semibold">/{selectedTemplate.stepRegexes[idx]}/i</span>
                          </div>
                        )}
                        {selectedTemplate.stepSuggestions?.[idx] && (
                          <div className="text-[10px] text-teal-700 font-medium">
                            Autocomplete: <span className="italic">"{selectedTemplate.stepSuggestions[idx]}"</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 border-t border-navy-100 pt-4">
                  <span className="text-[10px] font-black text-navy-400 uppercase tracking-widest block">Relatório de Exemplo / Treinamento</span>
                  <div className="bg-navy-50 p-4 rounded-2xl border border-navy-100 text-xs text-navy-900 font-mono whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto">
                    {selectedTemplate.referenceModel}
                  </div>
                </div>

                {selectedTemplate.presetData && (
                  <div className="border-t border-navy-100 pt-4 space-y-3">
                    <span className="text-[10px] font-black text-navy-400 uppercase tracking-widest block">Informações de Exemplo Acopladas (Preset)</span>
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-navy-400 block font-bold text-[10px] uppercase">Cidade:</span>
                        <span className="text-navy-900 font-semibold">{selectedTemplate.presetData.cidade || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-navy-400 block font-bold text-[10px] uppercase">Endereço:</span>
                        <span className="text-navy-900 font-semibold">{selectedTemplate.presetData.endereco || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-navy-400 block font-bold text-[10px] uppercase">Viatura:</span>
                        <span className="text-navy-900 font-semibold">{selectedTemplate.presetData.vtr || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-navy-400 block font-bold text-[10px] uppercase">Equipe:</span>
                        <span className="text-navy-900 font-semibold">{selectedTemplate.presetData.equipe || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-navy-50/50 rounded-3xl border border-dashed border-navy-200 p-12 text-center text-navy-400 flex flex-col items-center justify-center min-h-[400px]">
              <FileText className="w-16 h-16 text-navy-200 mb-4" />
              <p className="text-xs font-black uppercase tracking-widest text-navy-400">Selecione um modelo à esquerda ou crie um novo</p>
              <p className="text-xs text-navy-400 mt-1">Configure as regras estruturais e os relatórios oficiais de referência que o Assistente de Inteligência usará para calibrar as ocorrências.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RoTemplates;
