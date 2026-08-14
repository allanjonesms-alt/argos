export interface MigratedPolice {
  matricula: string;
  nome_completo: string;
  nome: string; // nome_de_guerra
  telefone: string;
  avatar_url?: string;
  rank: string;
  status_funcional: string;
  garrison: string;
  email_pm: string;
  cpf: string;
  data_inclusao?: string;
  tempo_servico?: string;
  filiacao?: string;
  naturalidade?: string;
  endereco?: string;
  dependentes?: any[];
  cursos?: any[];
  promocoes?: any[];
  licenca_especial?: any;
  unidade?: string;
  pai?: string;
  mae?: string;
  rg?: string;
  doe_inclusao?: string;
  data_diario?: string;
  pagina?: string;
  averbacao?: any[];
  incorporacao?: string;
  deducao?: any[];
  sexo?: string;
  situacao_funcional?: string;
  identidade_funcional?: string;
  fator_rh?: string;
  data_nascimento?: string;
}

export const MIGRATED_POLICE_DATA: MigratedPolice[] = [
  {
    matricula: "484506021",
    nome_completo: "MANOEL MOREIRA DE OLIVEIRA",
    nome: "Moreira",
    telefone: "67992253277",
    avatar_url: "",
    rank: "1º Tenente",
    status_funcional: "Disponível",
    garrison: "Administrativo",
    email_pm: "mmoreira.direito@hotmail.com",
    cpf: "033.440.651-06",
    data_inclusao: "2020-03-02",
    naturalidade: "Campo Grande - MS",
    endereco: "Rua 11 de Abril, 398 - Flávio Garcia - Coxim -MS CEP 79.400-000",
    dependentes: [],
    cursos: [],
    promocoes: [],
    licenca_especial: { concessao: "", fruicao: "" },
    unidade: "5º BPM/ CPA-6/Coxim-MS",
    pai: "Manoel Sotero de Oliveira",
    mae: "Aparecida de Lourdes Moreira de Oliveira",
    rg: "1442618 SSP/MS",
    doe_inclusao: "10.097",
    data_diario: "2020-02-19",
    averbacao: [],
    deducao: []
  },
  {
    matricula: "62406022",
    nome_completo: "PATRICIA DE KASSIA VASCONCELOS",
    nome: "Kassia",
    telefone: "67999280787",
    avatar_url: "https://wkdeilnwlhnnvmvkbgjd.supabase.co/storage/v1/object/public/avatars/b4c8bf18-f856-414a-a19f-b7907cbfd80f/avatar.jpg",
    rank: "Soldado",
    status_funcional: "Disponível",
    garrison: "Força Tática",
    email_pm: "patthyvasconcelos@hotmail.com",
    cpf: "042.596.781-67",
    naturalidade: "COXIM - MS",
    endereco: "RUA CINCO, 51 - JD BELA VISTA - COXIM/MS CEP79400-000",
    dependentes: [],
    cursos: [],
    promocoes: [],
    licenca_especial: {
      concessao: {
        primeiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        segundoDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        terceiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" }
      },
      fruicao: {
        primeiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        segundoDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        terceiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" }
      }
    },
    unidade: "5º BPM/ CPA-6/Coxim-MS",
    pai: "Ivair Gama de Vasconcelos ",
    mae: "Zelia Gomes da Conceicao Vasconcelos ",
    rg: "1862574",
    averbacao: [],
    deducao: [],
    sexo: "Feminino",
    fator_rh: "A+",
    data_nascimento: "2026-04-24"
  },
  {
    matricula: "114069022",
    nome_completo: "AUGUSTO MANDOR GOMES DA SILVA",
    nome: "Gomes",
    telefone: "67 99904-8398",
    avatar_url: "",
    rank: "1º Sargento",
    status_funcional: "Disponível",
    garrison: "Rádio Patrulha",
    email_pm: "augustomandor@hotmail.com",
    cpf: "828.593.881-68",
    data_inclusao: "2003-12-01",
    naturalidade: "Coxim - MS",
    endereco: "Rua Roraima, Nº 232, Bairro Altos São Pedro, Coxim – MS, CEP: 79400-000",
    dependentes: [],
    cursos: [
      { ano: "2003", curso: "CFSD", id: "42dafc8a-fd32-4ccc-88af-e261d5e55a2e", local: "5° BPM / COXIM-MS" },
      { ano: "2013", curso: "CFC", id: "4381e41e-ba85-4646-bd6e-a3e2d8f6be6e", local: "CEFAP/ CAMPO GRANDE - MS" },
      { ano: "2018", curso: "CFS", id: "724ab490-ba47-4b9a-9e40-cd545a27f259", local: "CEFAP/ CAMPO GRANDE - MS" },
      { ano: "2023", curso: "CAS", id: "a7854b9a-d0dc-40a9-a2bc-8c0d979a1cd1", local: "CEFAP/ CAMPO GRANDE - MS" }
    ],
    promocoes: [],
    licenca_especial: {
      concessao: {
        primeiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        segundoDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        terceiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" }
      },
      fruicao: {
        primeiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        segundoDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        terceiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" }
      }
    },
    unidade: "5º BPM/ CPA-6/Coxim-MS",
    pai: "Francisco Sipriano da Silva ",
    mae: "Jorcília Gomes da Silva",
    rg: "935457",
    doe_inclusao: "6.311",
    data_diario: "2004-08-18",
    pagina: "35",
    averbacao: [],
    deducao: []
  },
  {
    matricula: "814058021",
    nome_completo: "CAMILA DE SOUZA GONÇALVES",
    nome: "Camila",
    telefone: "67984053026",
    avatar_url: "",
    rank: "Soldado",
    status_funcional: "Disponível",
    garrison: "Força Tática",
    email_pm: "camilasouzacx@gmail.com",
    cpf: "034.731.441-42",
    data_inclusao: "2024-10-07",
    naturalidade: "Coxim-MS",
    endereco: "Rua Tulipas, 235-A, Senhor Divino, Coxim-MS",
    dependentes: [],
    cursos: [
      { ano: "2024", curso: "CFSD", id: "32e05bbe-f695-4803-8342-f359edab8a5f", local: "5° BPM - COXIM/MS" }
    ],
    promocoes: [],
    licenca_especial: { concessao: "", fruicao: "" },
    unidade: "5º BPM/ CPA-6/Coxim-MS",
    pai: "Oronte Domingos Gonçalves ",
    mae: "Doralice Jesus de Souza",
    doe_inclusao: "11.640",
    data_diario: "2024-10-10",
    averbacao: [],
    deducao: []
  },
  {
    matricula: "48735021",
    nome_completo: "NAERCIO CALVI CARDOSO",
    nome: "Calvi",
    telefone: "67 99641-0190",
    avatar_url: "",
    rank: "Capitão",
    status_funcional: "Disponível",
    garrison: "Administrativo",
    email_pm: "capitaocalvi@gmail.com",
    cpf: "003.468.241-41",
    data_inclusao: "2014-03-26",
    naturalidade: "Aquidauana - MS",
    endereco: "Rua Oscar Costa, 732 - Flávio Garcia - Coxim -MS CEP 79.400-000",
    dependentes: [],
    cursos: [],
    promocoes: [],
    licenca_especial: { concessao: "", fruicao: "" },
    unidade: "5º BPM/ CPA-6/Coxim-MS",
    pai: "Naercio Cardoso",
    mae: "Fatima Maria Calvi",
    rg: "1098727",
    doe_inclusao: "8.652",
    data_diario: "2014-04-07",
    averbacao: [],
    deducao: []
  },
  {
    matricula: "38347021",
    nome_completo: "HEREK ALEXANDRE DA SILVA",
    nome: "Alexandre",
    telefone: "(67) 99687-5713",
    avatar_url: "",
    rank: "1º Sargento",
    status_funcional: "Disponível",
    garrison: "Administrativo",
    email_pm: "herek_alexandre@hotmail.com",
    cpf: "029.330.061-54",
    data_inclusao: "2008-09-01",
    naturalidade: "Coxim-MS",
    endereco: "Rua Nova Canaã, 54 - Jd Vista Alegre, Coxim-MS CEP: 79400-000",
    dependentes: [
      { dataNascimento: "1992-04-25", id: "b33f96ff-710d-4bfb-8740-37e909bf4e68", nome: "Juliana Silva Barros", tipo: "Cônjuge" }
    ],
    cursos: [
      { ano: "2008", curso: "CFSD", id: "ae4c0148-51dc-442d-98fc-743ec0c86775", local: "5° BPM / COXIM-MS" },
      { ano: "2014", curso: "CFC", id: "8b0afad4-251a-4c9b-a7d5-5621b40dd800", local: "CEFAP / CAMPO GRANDE - MS" },
      { ano: "2016", curso: "CFS", id: "d93f9888-1f55-4e40-b6a2-a2091e94bbbc", local: "CEFAP / CAMPO GRANDE - MS" },
      { ano: "2022", curso: "CAS", id: "e55c9700-4445-41ea-a0e2-cb3cc473ff21", local: "CEFAP / CAMPO GRANDE - MS" }
    ],
    promocoes: [
      { dataDoe: "2015-07-03", dataPromocao: "2015-06-15", doe: "8.954", id: "62f19b39-9038-45ee-8f7f-1240eec80e35", postoGrad: "Cabo" },
      { dataDoe: "2025-05-16", dataPromocao: "2014-04-14", doe: "11.830", id: "36ec0f58-01e6-42c2-a483-2d44bec9d9bb", postoGrad: "3º Sargento" },
      { dataDoe: "2021-05-04", dataPromocao: "2020-09-05", doe: "10.494", id: "63543228-6ade-4768-b2a0-34fbb7c40a92", postoGrad: "2º Sargento" },
      { dataDoe: "2022-09-09", dataPromocao: "2022-09-05", doe: "1.935", id: "8ffeedbf-44dd-4e79-81c3-4c33c01852c7", postoGrad: "1º Sargento" }
    ],
    licenca_especial: { concessao: "", fruicao: "" },
    unidade: "5º BPM/ CPA-6/Coxim-MS",
    pai: "ZENILDO PEDROSA DA SILVA",
    mae: "MARIA ALEXANDRE BATISTA DA SILVA",
    rg: "1475821",
    doe_inclusao: "7343",
    data_diario: "2008-11-20",
    averbacao: [],
    deducao: []
  },
  {
    matricula: "130548021",
    nome_completo: "JOSE MANOEL FERREIRA DE MELO",
    nome: "De Melo",
    telefone: "67 99126-3224",
    avatar_url: "",
    rank: "2º Tenente",
    status_funcional: "Disponível",
    garrison: "Administrativo",
    email_pm: "patamo17@gmail.com",
    cpf: "966.064.601-15",
    data_inclusao: "2006-12-04",
    naturalidade: "MIRANDA - MS",
    endereco: "Rua General Mendes de Morais, 190 - Jd Aerporto - Coxim/MS CEP 79.400-000",
    dependentes: [
      { dataNascimento: "2009-10-13", id: "536c77e3-50b4-4687-8323-0e5e12e17544", nome: "OTAVIO MANOEL RODRIGUES FERREIRA DE MELO", tipo: "Filho(a)" },
      { dataNascimento: "1982-07-15", id: "c85c42e3-6989-4efe-8401-33aa8e4b72cd", nome: "ELISANGELA RODRIGUES", tipo: "Cônjuge" },
      { dataNascimento: "2022-05-19", id: "fd95a152-b3d7-4ae5-86db-63ddf1063eb3", nome: "JOAQUIM MIGUEL RODRIGUES FERREIRA MELO", tipo: "Filho(a)" }
    ],
    cursos: [
      { ano: "2006", curso: "CFSD", id: "61139242-2625-473b-babe-9e79b81cc884", local: "3° BPM - DOURADOS/MS" },
      { ano: "2011", curso: "CFS", id: "d3c434d7-9256-492f-98ff-b87841a93464", local: "CEFAP - CAMPO GRANDE/MS" },
      { ano: "2022", curso: "CFO", id: "08fec073-c3c2-49d0-a4bd-c4c7c5dca7fd", local: "APM - CAMPO GRANDE/MS" }
    ],
    promocoes: [
      { dataDoe: "2012-04-02", dataPromocao: "2012-02-15", doe: "8.164", id: "e7f8b96d-8c5c-4966-9649-28e51980c7b4", postoGrad: "3º Sargento" },
      { dataDoe: "2024-04-19", dataPromocao: "2024-04-19", doe: "11.471", id: "f3231eb9-65b7-49f7-917e-97eee7827425", postoGrad: "2º Tenente" }
    ],
    licenca_especial: {
      concessao: {
        primeiroDecenio: { bcg: "9.382", dataBcg: "2017-04-03", qtdDias: "18" },
        segundoDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        terceiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" }
      },
      fruicao: {
        primeiroDecenio: { bcg: "143/2018", dataBcg: "2018-08-02", qtdDias: "18" },
        segundoDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        terceiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" }
      }
    },
    unidade: "5º BPM/ CPA-6/Coxim-MS",
    pai: "JANIO FERREIRA DE MELO",
    mae: "DOLORES FERREIRA DE MELO",
    rg: "1416235 SSPMS",
    doe_inclusao: "6.877",
    data_diario: "2006-12-28",
    pagina: "38",
    averbacao: [],
    deducao: []
  },
  {
    matricula: "814436021",
    nome_completo: "GABRIELLA GAZOLA DE MELO",
    nome: "Gazola",
    telefone: "66999366239",
    avatar_url: "",
    rank: "Soldado",
    status_funcional: "Disponível",
    garrison: "Rádio Patrulha",
    email_pm: "gabs.melo13@gmail.com",
    cpf: "059.629.681-90",
    data_inclusao: "2024-10-07",
    naturalidade: "Rondonópolis - MT",
    endereco: "RUA PITIGUARI, 3889 - Jd Tancredo Neves - Rondonópolis - MT CEP 78.750-772",
    dependentes: [],
    cursos: [
      { ano: "2024/2025", curso: "CFSD", id: "a3b14fdb-4965-4ff2-8a0b-5f4a9c6a44d6", local: "5° BPM - COXIM/MS" }
    ],
    promocoes: [],
    licenca_especial: {
      concessao: {
        primeiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        segundoDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        terceiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" }
      },
      fruicao: {
        primeiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        segundoDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        terceiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" }
      }
    },
    unidade: "3º PEL/1ª CIA/5º BPM/CPA-6/Alcinópolis-MS",
    pai: "Osmarino Teodoro de Melo",
    mae: "Ademilda Gazola ",
    rg: "24049085 SSPMT",
    doe_inclusao: "11.640",
    data_diario: "2024-10-10",
    averbacao: [],
    deducao: []
  },
  {
    matricula: "425007021",
    nome_completo: "JOSIANE NEPOMUCENO MAIA",
    nome: "Josiane",
    telefone: "67 999250378",
    avatar_url: "",
    rank: "Cabo",
    status_funcional: "Disponível",
    garrison: "Administrativo",
    email_pm: "josiane_maiams@hotmail.com",
    cpf: "728.572.691-53",
    data_inclusao: "2014-09-22",
    naturalidade: "Corumbá - MS",
    endereco: "Rua Roraima, 465, Morada Alto São Pedro - Coxim/MS",
    dependentes: [
      { dataNascimento: "2017-11-19", id: "3bf0db43-9309-4e1b-a85c-87d33ab6be6d", nome: "FERNANDA NEPOMUCENO MAIA JAHN", tipo: "Filho(a)" }
    ],
    cursos: [
      { ano: "2014", curso: "CFSD", id: "46465cb4-525e-4bf7-8896-e09152e57139", local: "CEFAP / CAMPO GRANDE-MS" },
      { ano: "2021", curso: "CFC", id: "d4d2f63e-a325-45d8-8769-a4a3defdd984", local: "CEFAP / CAMPO GRANDE-MS" }
    ],
    promocoes: [
      { dataDoe: "2022-03-18", dataPromocao: "2022-03-14", doe: "10.780", id: "3e4a0dc9-d470-4527-badf-7d31390880f3", postoGrad: "Cabo" }
    ],
    licenca_especial: {
      concessao: {
        primeiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        segundoDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        terceiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" }
      },
      fruicao: {
        primeiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        segundoDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        terceiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" }
      }
    },
    unidade: "5º BPM/ CPA-6/Coxim-MS",
    pai: "JORGE ANTONIO PINHEIRO MAIA",
    mae: "ROSELY NEPOMUCENO MAIA ",
    rg: "1283991 SSPMS",
    doe_inclusao: "8.772",
    data_diario: "2014-10-06",
    pagina: "50",
    averbacao: [
      { dataCertidao: "", dataPublicacao: "", doe: "", id: "f184e75b-3eda-485d-961f-877a309c49c0", nrCertidao: "", tipo: "INSS", totalDias: "4111" }
    ],
    deducao: []
  },
  {
    matricula: "92264021",
    nome_completo: "JORGE CLEUBE RODRIGUES DOS SANTOS",
    nome: "Jorge",
    telefone: "67 99647-6949",
    avatar_url: "",
    rank: "3º Sargento",
    status_funcional: "Disponível",
    garrison: "Administrativo",
    email_pm: "jorgecleube@hotmail.com",
    cpf: "627.790.521-04",
    data_inclusao: "2004-09-27",
    naturalidade: "Pedro Gomes MS",
    endereco: "Av. Mato Grosso do Sul, 1149 - Senhor Divino - Coxim/MS CEP 79400-000",
    dependentes: [],
    cursos: [],
    promocoes: [],
    licenca_especial: {
      concessao: {
        primeiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        segundoDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        terceiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" }
      },
      fruicao: {
        primeiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        segundoDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        terceiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" }
      }
    },
    unidade: "5º BPM/ CPA-6/Coxim-MS",
    pai: "SEVERINO RUFINO DOS SANTOS",
    mae: "ANTONIA RODRIGUES DOS SANTOS",
    rg: "996927 SSPMT",
    doe_inclusao: "6.361",
    data_diario: "2024-11-08",
    pagina: "49",
    averbacao: [],
    deducao: []
  },
  {
    matricula: "42085021",
    nome_completo: "ERMESON DE ALENCAR BEZERRA",
    nome: "Alencar",
    telefone: "67 99657-3645",
    avatar_url: "",
    rank: "1º Sargento",
    status_funcional: "Disponível",
    garrison: "Rádio Patrulha",
    email_pm: "ermeson.pm.32@gmail.com",
    cpf: "003.098.451-30",
    data_inclusao: "2008-08-01",
    naturalidade: "CAARAPO -MS",
    endereco: "RUA TRAVESSA MUTUM, Nº 193 - JD SÃO PAULO - COXIM/MS 79.400-000",
    dependentes: [
      { dataNascimento: "2005-09-26", id: "df1d2a53-db3f-4389-935a-9ab10970ad15", nome: "EMILLY RAYSSA PIEMONTEZ BEZERRA", tipo: "Filho(a)" },
      { dataNascimento: "2017-06-30", id: "6f07787c-4de0-43ef-8859-10ba5caa8fdf", nome: "LUCAS GABRIEL DE ALMEIDA BEZERRA", tipo: "Filho(a)" },
      { dataNascimento: "1987-05-21", id: "59a269ea-34bf-4d44-925a-ec6dd5637a79", nome: "REGIANE FERNANDES DE ALMEIDA", tipo: "Cônjuge" }
    ],
    cursos: [
      { ano: "2008", curso: "CFSD", id: "20506a8b-388d-49c5-b91f-bfb736e7e18a", local: "5° BPM / COXIM-MS" },
      { ano: "2016", curso: "CFS", id: "a9918d66-058a-4c3f-b5a5-c786969a531f", local: "CEFAP / CAMPO GRANDE -MS" },
      { ano: "2022", curso: "CAS", id: "f449aeaf-d647-4bd9-89c9-197cced814c1", local: "CEFAP / CAMPO GRANDE - MS" }
    ],
    promocoes: [
      { dataDoe: "2025-05-16", dataPromocao: "2014-04-16", doe: "11.830", id: "351cd874-ba1c-4f6b-8742-9357d77fc1bf", postoGrad: "3º Sargento" },
      { dataDoe: "2021-05-04", dataPromocao: "2020-09-05", doe: "10.494", id: "d26ccf4f-af92-4961-a71b-2ee32b5c0501", postoGrad: "2º Sargento" },
      { dataDoe: "2022-09-09", dataPromocao: "2022-09-05", doe: "10.935", id: "9ecaeda9-838b-44bf-8866-ea1815b5dbf4", postoGrad: "1º Sargento" }
    ],
    licenca_especial: {
      concessao: {
        primeiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        segundoDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        terceiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" }
      },
      fruicao: {
        primeiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        segundoDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        terceiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" }
      }
    },
    unidade: "5º BPM/ CPA-6/Coxim-MS",
    pai: "MOIZES DE ALENCAR BEZERRA",
    mae: "ESMERALDA DA SILVA BEZERRA",
    rg: "1.363.717 SSPMMS",
    doe_inclusao: "7343",
    data_diario: "2008-11-20",
    pagina: "35",
    averbacao: [
      { dataCertidao: "", dataPublicacao: "2020-08-27", doe: "10.263", id: "ce7c7c59-847e-42f6-aa1c-d529b6a8433d", nrCertidao: "", tipo: "Exército", totalDias: "2373" }
    ],
    deducao: []
  },
  {
    matricula: "97838021",
    nome_completo: "ADRIANO RODRIGUES DE OLIVEIRA",
    nome: "Adriano",
    telefone: "67981308145",
    avatar_url: "",
    rank: "Tenente-Coronel",
    status_funcional: "Disponível",
    garrison: "Administrativo",
    email_pm: "alfaoscar08@gmail.com",
    cpf: "69082448149",
    data_inclusao: "1996-03-01",
    naturalidade: "Glória de Dourados - MS",
    endereco: "Rua Simão Abraão, 256, Mato do Jacinto, Campo Grande – MS, CEP: 79033-810",
    dependentes: [
      { dataNascimento: "1981-06-12", id: "0541639e-3282-456f-865a-d60a7cde7e50", nome: "ADRIANA CRISTINA ALENCAR DE OLIVEIRA", tipo: "Cônjuge" },
      { dataNascimento: "2003-02-18", id: "d93c57f1-0135-471c-a9f3-1897c9a0a08d", nome: "SARAH CRISTINA DE OLIVEIRA", tipo: "Filho(a)" },
      { dataNascimento: "2005-06-12", id: "71bcc5f3-bc8f-47e6-b638-98e2f5c09684", nome: "MATHEUS ALENCAR DE OLIVEIRA", tipo: "Filho(a)" },
      { dataNascimento: "2010-03-18", id: "a82f2607-cf93-48b7-b1c6-cbf60f5f10be", nome: "RAPHAEL ALENCAR DE OLIVEIRA", tipo: "Filho(a)" }
    ],
    cursos: [
      { ano: "1996", curso: "CFO", id: "eb2e8d22-d32f-4913-a238-a4f221f63dc2", local: "PMMG" },
      { ano: "2013", curso: "CAO", id: "2884dca2-7d9c-43d0-8fcb-b5589d19104f", local: "CEFAP / CAMPO GRANDE-MS" },
      { ano: "2021", curso: "CSP", id: "dd1b50a5-8d3c-4535-9bbc-c0c3545e80f4", local: "APM - PMMS" }
    ],
    promocoes: [
      { dataDoe: "1999-12-07", dataPromocao: "1999-10-22", doe: "BCG 237", id: "827801bd-ac9f-4067-a040-c1be118ce6c5", postoGrad: "Aspirante" },
      { dataDoe: "2000-11-24", dataPromocao: "2000-09-05", doe: "BCG 220", id: "52680479-75ed-483a-9029-2f9c8a3450c9", postoGrad: "2º Tenente" },
      { dataDoe: "2000-03-24", dataPromocao: "2003-01-30", doe: "BCG 056", id: "93c48d6f-5ad1-43ad-b7bd-fe5273b3a68f", postoGrad: "1º Tenente" },
      { dataDoe: "2006-12-18", dataPromocao: "2006-11-27", doe: "6.870", id: "70341672-f781-439d-811a-fc4d0b154bf4", postoGrad: "Capitão" },
      { dataDoe: "2013-12-12", dataPromocao: "2013-04-21", doe: "8.575", id: "d320dbe3-2141-4edc-848e-247cbb4a2ada", postoGrad: "Major" },
      { dataDoe: "2018-06-06", dataPromocao: "2018-06-02", doe: "9.670", id: "5a3a37c9-0275-4843-9a9d-b1ee22844e70", postoGrad: "Tenente-Coronel" }
    ],
    licenca_especial: { concessao: "", fruicao: "" },
    unidade: "5º BPM/ CPA-6/Coxim-MS",
    pai: "Valdino Rodrigues de Oliveira",
    mae: "Irene Macena de Oliveira",
    rg: "750.837 SSPMS",
    doe_inclusao: "BCG 048",
    data_diario: "1996-03-11",
    pagina: "0504",
    averbacao: [
      { dataCertidao: "", dataPublicacao: "2020-08-27", doe: "10.263", id: "6f67547b-ab22-4326-8093-c968970a1d5a", nrCertidao: "", tipo: "Exército", totalDias: "262" }
    ],
    deducao: []
  },
  {
    matricula: "133947021",
    nome_completo: "CLEITON COSTA DE LIMA",
    nome: "Cleiton",
    telefone: "67 99950-5917",
    avatar_url: "",
    rank: "1º Sargento",
    status_funcional: "Disponível",
    garrison: "Rádio Patrulha",
    email_pm: "cleitondabarra@yahoo.com",
    cpf: "997.138.961-49",
    data_inclusao: "2008-09-01",
    naturalidade: "COXIM - MS",
    endereco: "RUA COUTO PONTES, 118-B - SENHOR DIVINO - COXIM/MS CEP 79.400-000",
    dependentes: [
      { dataNascimento: "2005-12-05", id: "f10293b1-3014-4ad6-a1a7-b5d5785030fc", nome: "THALITA RANIELE SOUZA COSTA", tipo: "Filho(a)" },
      { dataNascimento: "2008-02-28", id: "fb063a87-ee8e-4048-8c91-bca85115f90c", nome: "VITOR LUCAS SOUZA COSTA", tipo: "Filho(a)" }
    ],
    cursos: [
      { ano: "2008", curso: "CFSD", id: "21f79c36-054d-450e-a92d-dea192052592", local: "5° BPM - COXIM/MS" },
      { ano: "2016", curso: "CFS", id: "cad7bc76-d853-4c0f-b4a7-83d05737f0c3", local: "CEFAP - CAMPO GRANDE/MS" },
      { ano: "2022", curso: "CAS", id: "f40bf0b5-736b-4f63-ab2b-6ef0d74ec33c", local: "CEFAP- CAMPO GRANDE/MS" }
    ],
    promocoes: [
      { dataDoe: "2025-05-16", dataPromocao: "2014-04-16", doe: "11.830", id: "6c3401a1-f20c-42d6-9a7e-6990766d5a62", postoGrad: "3º Sargento" },
      { dataDoe: "2021-05-04", dataPromocao: "2020-09-05", doe: "10.494", id: "d552d723-4c67-4346-bb91-32750ae1e88f", postoGrad: "2º Sargento" },
      { dataDoe: "2022-09-09", dataPromocao: "2022-09-05", doe: "10.935", id: "c81ba697-b21d-4ac4-a826-f958ea78bd8a", postoGrad: "1º Sargento" }
    ],
    licenca_especial: {
      concessao: {
        primeiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        segundoDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        terceiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" }
      },
      fruicao: {
        primeiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        segundoDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        terceiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" }
      }
    },
    unidade: "5º BPM/ CPA-6/Coxim-MS",
    pai: "NABOR BISPO DE LIMA",
    mae: "ANTONIA MARIA COSTA LIMA",
    rg: "1.257.078 SSPMS",
    doe_inclusao: "7.343",
    data_diario: "2008-11-20",
    averbacao: [
      { dataCertidao: "2020-09-15", dataPublicacao: "2020-11-13", doe: "10.323", id: "a7c0b5ba-9af7-4fa3-8079-ba38398458ce", nrCertidao: "016", tipo: "Exército", totalDias: "2558" }
    ],
    deducao: []
  },
  {
    matricula: "133613021",
    nome_completo: "ALLAN JONES RODRIGUES",
    nome: "Jones",
    telefone: "(67) 98437-3039",
    avatar_url: "",
    rank: "3º Sargento",
    status_funcional: "Disponível",
    garrison: "Administrativo",
    email_pm: "allanjonesms@gmail.com",
    cpf: "994.737.711-34",
    data_inclusao: "2008-09-01",
    naturalidade: "Coxim-MS",
    endereco: "Rua Tulipas, 235-A, Senhor Divino, Coxim-MS",
    dependentes: [],
    cursos: [
      { ano: "2008", curso: "CFSD", id: "57961b02-8a80-49ab-a78b-96f2308478e9", local: "5° BPM/COXIM-MS" },
      { ano: "2017", curso: "CFC", id: "31ab7f60-138e-472b-b956-3095f617cb80", local: "CEFAP/CAMPO GRANDE-MS" },
      { ano: "2023", curso: "CFS", id: "f372ff99-f6f0-4b5a-84ad-a227fde0f157", local: "CEFAP/CAMPOGRANDE-MS" }
    ],
    promocoes: [
      { dataDoe: "2025-05-15", dataPromocao: "2014-04-16", doe: "11.786", id: "407c70c6-8592-4eba-8a18-abff2bf1a603", postoGrad: "Cabo" },
      { dataDoe: "2025-05-15", dataPromocao: "2014-04-16", doe: "11.786", id: "15d46612-26c4-4a99-93e2-90b96c80fc16", postoGrad: "3º Sargento" }
    ],
    licenca_especial: { concessao: "", fruicao: "" },
    unidade: "5º BPM/ CPA-6/Coxim-MS",
    mae: "Zilda Alvicio Rodrigues",
    rg: "1320401 SSPMS",
    doe_inclusao: "9651",
    data_diario: "2008-10-01",
    pagina: "35",
    averbacao: [
      { dataCertidao: "2023-01-01", dataPublicacao: "2023-09-01", doe: "2435", id: "eca313dd-b6b2-4190-921d-bf7fb114630a", nrCertidao: "0001", tipo: "INSS", totalDias: "2290" }
    ],
    deducao: [],
    sexo: "Masculino",
    situacao_funcional: "Ativo",
    identidade_funcional: "8864",
    fator_rh: "O+",
    data_nascimento: "1982-12-17"
  },
  {
    matricula: "1079021",
    nome_completo: "JOAO PAULO SILVERIO LOPES",
    nome: "Silverio",
    telefone: "67 99946-6564",
    avatar_url: "",
    rank: "3º Sargento",
    status_funcional: "Disponível",
    garrison: "Rádio Patrulha",
    email_pm: "jplopes84@hotmail.com",
    cpf: "010.455.911-06",
    data_inclusao: "2008-09-01",
    naturalidade: "COXIM-MS",
    endereco: "RUA GOIAS, 60 - VILA SAO PAULO - COXIM/MS CEP: 79400-000",
    dependentes: [
      { dataNascimento: "2006-07-11", id: "243f0b51-ebd3-4efe-86c5-93bfe221f6c3", nome: "YASMIN FERREIRA LOPES", tipo: "Filho(a)" }
    ],
    cursos: [
      { ano: "2008", curso: "CFSD", id: "b1ff6a9e-5303-43fb-a690-bb1c864ed99f", local: "5° BPM/ COXIM - MS" },
      { ano: "2017", curso: "CFC", id: "f6f5b747-06ce-4023-8b3d-ca40ea6f494f", local: "CEFAP/ CAMPO GRANDE - MS" },
      { ano: "2022", curso: "CFS", id: "c0f685f3-e4c1-4018-83ea-66912c518851", local: "CEFAP/ CAMPO GRANDE - MS" }
    ],
    promocoes: [
      { dataDoe: "2017-05-04", dataPromocao: "2017-04-19", doe: "9.401", id: "87cff2ca-9181-4810-8617-ac58d0191021", postoGrad: "Cabo" },
      { dataDoe: "2022-12-06", dataPromocao: "2022-12-06", doe: "11.010", id: "2e351023-0f62-4595-866b-f07757745826", postoGrad: "3º Sargento" }
    ],
    licenca_especial: {
      concessao: {
        primeiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        segundoDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        terceiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" }
      },
      fruicao: {
        primeiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        segundoDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        terceiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" }
      }
    },
    unidade: "5º BPM/ CPA-6/Coxim-MS",
    pai: "SEBASTIAO SILVERIO PEREIRA",
    mae: "MARIA APARECIDA LOPES",
    rg: "1424905 SSPMS",
    doe_inclusao: "7.343",
    data_diario: "2008-11-20",
    averbacao: [
      { dataCertidao: "2026-01-26", dataPublicacao: "2026-03-26", doe: "12.110", id: "c5d5fabf-5dd1-4e60-aae3-83e6f89c1d3c", nrCertidao: "020-2026", tipo: "Exército", totalDias: "2348" }
    ],
    deducao: [],
    situacao_funcional: "Ativo"
  },
  {
    matricula: "7831021",
    nome_completo: "ELIZAINE DUARTE DA SILVA",
    nome: "ELIZAINE",
    telefone: "",
    avatar_url: "",
    rank: "3º Sargento",
    status_funcional: "Disponível",
    garrison: "Administrativo",
    email_pm: "li.dk@hotmail.com",
    cpf: "001.364.791-11",
    data_inclusao: "2008-09-01",
    naturalidade: "RIO VERDE DE MT - MS",
    endereco: "RUA HERCULANO PENA, 50 - CENTRO - COXIM/MS 79400-000",
    dependentes: [
      { dataNascimento: "2012-08-22", id: "34ceb18b-f2ae-4e18-9f7f-07eba4ac3e1c", nome: "ARTHUR DUARTE DUTRA", tipo: "Filho(a)" }
    ],
    cursos: [
      { ano: "2008", curso: "CFSD", id: "154221dc-f5b6-4c6a-99a5-1603f40f6ea8", local: "5° BPM / COXIM-MS" },
      { ano: "2017", curso: "CFC", id: "5296bcfa-67dc-4baf-a8c2-9f23562b0491", local: "CEFAP / CAMPO GRANDE-MS" },
      { ano: "2022", curso: "CFS", id: "27c1c307-3302-4622-8759-41a0fa968c53", local: "CEFAP / CAMPO GRANDE-MS" }
    ],
    promocoes: [
      { dataDoe: "2017-04-17", dataPromocao: "2017-04-19", doe: "9.401", id: "fdf4ce39-56e2-4389-8aac-3c003e386536", postoGrad: "Cabo" },
      { dataDoe: "2022-12-06", dataPromocao: "2022-12-06", doe: "11.010", id: "15be4ba9-8d0f-4562-9e03-3a49e5a2332b", postoGrad: "Sargento" }
    ],
    licenca_especial: {
      concessao: {
        primeiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        segundoDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        terceiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" }
      },
      fruicao: {
        primeiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        segundoDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        terceiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" }
      }
    },
    unidade: "5º BPM/ CPA-6/Coxim-MS",
    pai: "ELIEZE RODRIGUES DA SILVA",
    mae: "LIONIRA DUARTE ALVARENGA",
    rg: "1142856",
    doe_inclusao: "7.343",
    data_diario: "2008-11-20",
    averbacao: [],
    deducao: [],
    sexo: "Feminino",
    situacao_funcional: "Ativo",
    identidade_funcional: "8703",
    fator_rh: "O+",
    data_nascimento: "1985-05-28"
  },
  {
    matricula: "7253021",
    nome_completo: "ELTON MESSIAS DA SILVA",
    nome: "Elton",
    telefone: "67 99625-2526",
    avatar_url: "",
    rank: "Cabo",
    status_funcional: "Disponível",
    garrison: "Rádio Patrulha",
    email_pm: "elton.ems.messias@gmail.com",
    cpf: "012.920.321-11",
    data_inclusao: "2008-10-01",
    naturalidade: "Coxim-MS",
    endereco: "RUA BEM-TE-VI, 111 - CONJUNTO TAQUARI - COXIM/MS",
    dependentes: [
      { dataNascimento: "2014-06-09", id: "2399606f-5979-4c7a-99fa-d8ba7db7e5b6", nome: "EMILLY MESSIAS GUERRA", tipo: "Filho(a)" },
      { dataNascimento: "2021-08-27", id: "cc2b1faa-4f84-4716-9f83-c9fa1b461ef8", nome: "ASAFE MESSIAS GUERRA", tipo: "Filho(a)" }
    ],
    cursos: [
      { ano: "2008", curso: "CFSD", id: "ad176708-f960-4ead-903a-b5f6a5fa985a", local: "5° BPM / COXIM-MS" },
      { ano: "2017", curso: "CFC", id: "65ccbedc-5894-49d5-9f57-a9aae7d5a892", local: "CEFAP - CAMPO GRANDE/MS" }
    ],
    promocoes: [
      { dataDoe: "2018-04-02", dataPromocao: "2018-03-02", doe: "9.625", id: "8b3c32ba-35ba-4afb-b2e7-083f2b8145ff", postoGrad: "Cabo" }
    ],
    licenca_especial: {
      concessao: {
        primeiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        segundoDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        terceiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" }
      },
      fruicao: {
        primeiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        segundoDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        terceiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" }
      }
    },
    unidade: "5º BPM/ CPA-6/Coxim-MS",
    pai: "EDSON SEVERINO DA SILVA",
    mae: "LENIR MESSIAS VITAL",
    rg: "1.426.134",
    doe_inclusao: "7364",
    data_diario: "2008-12-18",
    averbacao: [
      { dataCertidao: "2015-07-06", dataPublicacao: "2015-10-05", doe: "9.018", id: "1d74a163-4545-4e65-abf6-e6f566870b83", nrCertidao: "011", tipo: "Exército", totalDias: "1670" }
    ],
    deducao: []
  },
  {
    matricula: "134090021",
    nome_completo: "FLAVIO BORGES RODRIGUES DE SOUZA",
    nome: "Flavio",
    telefone: "67 99651-8904",
    avatar_url: "",
    rank: "Cabo",
    status_funcional: "Disponível",
    garrison: "Rádio Patrulha",
    email_pm: "fbrs22@hotmail.com",
    cpf: "998.817.641-49",
    data_inclusao: "2008-09-01",
    naturalidade: "COXIM=MS",
    endereco: "RUA CEARA, 1494 - VISTA DO LAGO - SONORA/MS CEP:79415-000",
    dependentes: [],
    cursos: [
      { ano: "2008", curso: "CFSD", id: "73b03400-43b3-4090-8ca5-ee6533ae934b", local: "5° BPM / COXIM-MS" },
      { ano: "2017", curso: "CFC", id: "d76157d0-920c-4210-8f3b-0a5f44d0e715", local: "CEFAP / CAMPO GRANDE-MS" }
    ],
    promocoes: [
      { dataDoe: "2018-04-02", dataPromocao: "2018-03-02", doe: "9.625", id: "0137dd70-1e50-4193-b8af-b5056700a4d3", postoGrad: "Cabo" }
    ],
    licenca_especial: {
      concessao: {
        primeiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        segundoDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        terceiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" }
      },
      fruicao: {
        primeiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        segundoDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        terceiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" }
      }
    },
    unidade: "5º BPM/ CPA-6/Coxim-MS",
    pai: "IRMO RODRIGUES DE SOUZA",
    mae: "HILDA BORGES DE CASTILHO",
    rg: "1100944 SSPMS",
    doe_inclusao: "7343",
    data_diario: "2008-11-20",
    averbacao: [
      { dataCertidao: "2024-07-09", dataPublicacao: "2025-04-09", doe: "11,798", id: "467b0b94-a9b0-40b3-ad67-65e504baf9f9", nrCertidao: "1279733038-4", tipo: "INSS", totalDias: "1762" }
    ],
    deducao: []
  },
  {
    matricula: "101492021",
    nome_completo: "EZEQUIEL SANTOS SILVA",
    nome: "Santos Silva",
    telefone: "67 99229-5071",
    avatar_url: "",
    rank: "3º Sargento",
    status_funcional: "Disponível",
    garrison: "Rádio Patrulha",
    email_pm: "kielraybrum@gmail.com",
    cpf: "007.155.741-59",
    data_inclusao: "2010-07-01",
    naturalidade: "Brasília -DF",
    endereco: "Rua 03, n.35 - Vila São Paulo - Coxim/MS CEP 79400-000",
    dependentes: [],
    cursos: [],
    promocoes: [
      { dataDoe: "2018-03-12", dataPromocao: "2018-03-02", doe: "9612", id: "2525b7b4-edb4-4c0e-afc7-d3b8f586e573", postoGrad: "Cabo" },
      { dataDoe: "2022-12-09", dataPromocao: "2022-12-06", doe: "11010", id: "583c5bc8-621d-4cfb-b430-9d5a893fa530", postoGrad: "3º Sargento" }
    ],
    licenca_especial: {
      concessao: {
        primeiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        segundoDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        terceiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" }
      },
      fruicao: {
        primeiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        segundoDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        terceiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" }
      }
    },
    unidade: "5º BPM/ CPA-6/Coxim-MS",
    pai: "RAIMUNDO FERREIRA DA SILVA",
    mae: "LENICE MARIA DOS SANTOS",
    rg: "1258058",
    doe_inclusao: "7741",
    data_diario: "2010-07-07",
    averbacao: [],
    deducao: []
  },
  {
    matricula: "434066021",
    nome_completo: "JULIANO SILVA SOARES",
    nome: "SOARES",
    telefone: "",
    avatar_url: "",
    rank: "Cabo",
    status_funcional: "Disponível",
    garrison: "Rádio Patrulha",
    email_pm: "juliano2s1983@gmail.com",
    cpf: "005.951.611-97",
    dependentes: [],
    cursos: [],
    promocoes: [],
    licenca_especial: {
      concessao: {
        primeiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        segundoDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        terceiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" }
      },
      fruicao: {
        primeiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        segundoDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        terceiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" }
      }
    },
    unidade: "5º BPM/ CPA-6/Coxim-MS",
    rg: "1328443",
    averbacao: [],
    deducao: []
  },
  {
    matricula: "108326021",
    nome_completo: "DENILSON LEMES VIEIRA TEODORO",
    nome: "DENILSON",
    telefone: "",
    avatar_url: "",
    rank: "3º Sargento",
    status_funcional: "Disponível",
    garrison: "Rádio Patrulha",
    email_pm: "lemesteodoro@hotmail.com",
    cpf: "007.884.041-48",
    data_inclusao: "2003-12-01",
    naturalidade: "COXIM - MS",
    endereco: "RUA JOSÉ DOS ANJOS, 50 - SANTA MARIA - COXIM/MS CEP 79.400-000",
    dependentes: [
      { dataNascimento: "2012-02-16", id: "cd80e2dd-44c6-4be1-9ad9-7b70dd0c7479", nome: "DIMITRI AZAMBUJA VIEIRA TEODORO", tipo: "Filho(a)" },
      { dataNascimento: "2007-12-01", id: "16d47ee1-4a9c-4586-8d28-b357724c34d6", nome: "SOPHIA AZAMBUJA VIEIRA TEODORO", tipo: "Filho(a)" }
    ],
    cursos: [],
    promocoes: [],
    licenca_especial: {
      concessao: {
        primeiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        segundoDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        terceiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" }
      },
      fruicao: {
        primeiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        segundoDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        terceiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" }
      }
    },
    unidade: "5º BPM/ CPA-6/Coxim-MS",
    pai: "VANDERLEI VIEIRA TEODORO",
    mae: "JANDIRA VIEIRA TEODORO",
    rg: "1195819",
    doe_inclusao: "6.336",
    data_diario: "2004-09-28",
    pagina: "23",
    averbacao: [],
    deducao: []
  },
  {
    matricula: "114904021",
    nome_completo: "RODRIGO DOS SANTOS",
    nome: "Dos Santos",
    telefone: "(67) 99614-8333",
    avatar_url: "",
    rank: "1º Sargento",
    status_funcional: "Disponível",
    garrison: "Rádio Patrulha",
    email_pm: "rodrigosrad750@hotmail.com",
    cpf: "834.795.201-97",
    data_inclusao: "2008-09-01",
    naturalidade: "Pelotas - RS",
    endereco: "Rua Paulo Américo dos Reis, 436 - Senhor Divino - Coxim/MS CEP 79.400-000",
    dependentes: [],
    cursos: [
      { ano: "2008", curso: "CFSD", id: "91674b54-3732-43a5-931b-429dc71fb8b5", local: "5° BPM / COXIM-MS" },
      { ano: "2016", curso: "CFS", id: "6bf93a5c-b28c-43ce-a59f-ff3a35842883", local: "CEFAP / CAMPO GRANDE - MS" },
      { ano: "2022", curso: "CAS", id: "4397348a-6bfd-4dab-a5f9-90de9843d25a", local: "CEFAP / CAMPO GRANDE - MS" }
    ],
    promocoes: [
      { dataDoe: "2025-05-16", dataPromocao: "2014-04-16", doe: "11.830", id: "252bcb46-b209-4643-9b44-99f6d1970b9d", postoGrad: "3º Sargento" },
      { dataDoe: "2021-05-04", dataPromocao: "2020-09-05", doe: "10.494", id: "d3c474c1-c53d-4f43-a178-e6ded771adc1", postoGrad: "2º Sargento" },
      { dataDoe: "2022-09-09", dataPromocao: "2022-09-05", doe: "10,935", id: "8bf98979-a4cf-4d47-a647-287eaa7aacbe", postoGrad: "1º Sargento" }
    ],
    licenca_especial: {
      concessao: {
        primeiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        segundoDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        terceiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" }
      },
      fruicao: {
        primeiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        segundoDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        terceiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" }
      }
    },
    unidade: "5º BPM/ CPA-6/Coxim-MS",
    pai: "PEDRO RENATO DOS SANTOS",
    mae: "VANIA ELOA DOS SANTOS",
    rg: "1.070.181",
    doe_inclusao: "7.343",
    data_diario: "2008-11-20",
    pagina: "35",
    averbacao: [
      { dataCertidao: "2026-01-30", dataPublicacao: "2026-03-30", doe: "12.113", id: "7ee8c11b-338f-401e-92f0-e056efdf2a6e", nrCertidao: "037", tipo: "Exército", totalDias: "2922" },
      { dataCertidao: "", dataPublicacao: "2025-09-01", doe: "11.928", id: "a950082b-e66a-4cf3-bebe-4e5c0995d42b", nrCertidao: "", tipo: "INSS", totalDias: "1331" },
      { dataCertidao: "2026-01-30", dataPublicacao: "2026-03-30", doe: "12.113", id: "aeed2fe9-c201-422a-8de1-ebbd1d2b8a1a", nrCertidao: "037", tipo: "Exército", totalDias: "910" }
    ],
    deducao: []
  },
  {
    matricula: "492276021",
    nome_completo: "PEDRO PAULO DE MORAES BORGES BISCARRA",
    nome: "PEDRO",
    telefone: "",
    avatar_url: "",
    rank: "Soldado",
    status_funcional: "Disponível",
    garrison: "Rádio Patrulha",
    email_pm: "pedro.biscarra@outlook.com",
    cpf: "054.593.181-90",
    data_inclusao: "2021-10-07",
    naturalidade: "Rondonópolis - MT",
    endereco: "RUA TRABALHADORES RURAIS, 573 - SENHOR DIVINO - COXIM/MS 79400-000",
    dependentes: [
      { dataNascimento: "2022-12-07", id: "07d41d74-5ab6-4947-8e9f-193f2db889d9", nome: "PIETRO GABRIEL GOMES BISCARRA", tipo: "Filho(a)" }
    ],
    cursos: [
      { ano: "2021", curso: "CFSD", id: "f49f7cf0-2e1a-432d-8fa0-adba1e943f78", local: "CEFAP / CAMPO GRANDE - MS" }
    ],
    promocoes: [],
    licenca_especial: {
      concessao: {
        primeiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        segundoDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        terceiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" }
      },
      fruicao: {
        primeiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        segundoDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        terceiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" }
      }
    },
    unidade: "5º BPM/ CPA-6/Coxim-MS",
    pai: "MARCELO BISCARRA",
    mae: "SUELENE DE MORAES BORGES BISCARRA",
    rg: "25849018",
    doe_inclusao: "10.662",
    data_diario: "2021-10-25",
    averbacao: [],
    deducao: [],
    sexo: "Masculino",
    situacao_funcional: "Ativo",
    fator_rh: "O+",
    data_nascimento: "1995-06-29"
  },
  {
    matricula: "109155021",
    nome_completo: "CARLOS ROBERTO DO NASCIMENTO",
    nome: "NASCIMENTO",
    telefone: "67 99652-7546",
    avatar_url: "",
    rank: "3º Sargento",
    status_funcional: "Disponível",
    garrison: "Trânsito",
    email_pm: "carlosrnascimento01@gmail.com",
    cpf: "794.664.271-72",
    data_inclusao: "2004-09-27",
    naturalidade: "SAO PAULO - SP",
    endereco: "RUA DOIS, 40 - JD BELA VISTA - COXIM/MS CEP 79400-000",
    dependentes: [],
    cursos: [],
    promocoes: [],
    licenca_especial: {
      concessao: {
        primeiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        segundoDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        terceiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" }
      },
      fruicao: {
        primeiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        segundoDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        terceiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" }
      }
    },
    unidade: "5º BPM/ CPA-6/Coxim-MS",
    pai: "FRANCISCO ROMUALDO DO NASCIMENTO",
    mae: "MARIA DE LOURDES DO NASCIMENTO",
    rg: "943403",
    doe_inclusao: "6.361",
    averbacao: [],
    deducao: []
  },
  {
    matricula: "133519022",
    nome_completo: "FABIO PEREIRA LIMA",
    nome: "LIMA",
    telefone: "(67) 99622-3114",
    avatar_url: "",
    rank: "Cabo",
    status_funcional: "Disponível",
    garrison: "Rádio Patrulha",
    email_pm: "fabiolimacoxim@gmail.com",
    cpf: "994.267.571-04",
    data_inclusao: "2008-10-01",
    endereco: "COXIM - MS",
    dependentes: [],
    cursos: [],
    promocoes: [],
    licenca_especial: {
      concessao: {
        primeiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        segundoDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        terceiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" }
      },
      fruicao: {
        primeiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        segundoDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        terceiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" }
      }
    },
    unidade: "5º BPM/ CPA-6/Coxim-MS",
    pai: "LUIZ FERREIRA LIMA",
    mae: "JONILDE PEREIRA LIMA",
    rg: "1175602",
    averbacao: [],
    deducao: []
  },
  {
    matricula: "814008021",
    nome_completo: "WESLEY SOUZA ALMEIDA",
    nome: "ALMEIDA",
    telefone: "66 99625-6776",
    avatar_url: "",
    rank: "Soldado",
    status_funcional: "Disponível",
    garrison: "Trânsito",
    email_pm: "wesleysousa11f@gmail.com",
    cpf: "069.333.061-94",
    data_inclusao: "2024-10-06",
    endereco: "SONORA - MS",
    dependentes: [],
    cursos: [],
    promocoes: [],
    licenca_especial: {
      concessao: {
        primeiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        segundoDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        terceiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" }
      },
      fruicao: {
        primeiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        segundoDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        terceiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" }
      }
    },
    unidade: "5º BPM/ CPA-6/Coxim-MS",
    pai: "Francisco Wberlino de Almeida",
    mae: "Cristiane Paula de Souza ",
    averbacao: [],
    deducao: []
  },
  {
    matricula: "426848021",
    nome_completo: "ALIFER NEPUMUCENO MOREIRA",
    nome: "ALIFER",
    telefone: "67 99915-6271",
    avatar_url: "",
    rank: "Cabo",
    status_funcional: "Disponível",
    garrison: "Rádio Patrulha",
    email_pm: "alifernm@hotmail.com",
    cpf: "004.067.681-10",
    endereco: "CAMPO GRANDE - MS",
    dependentes: [],
    cursos: [],
    promocoes: [],
    licenca_especial: {
      concessao: {
        primeiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        segundoDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        terceiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" }
      },
      fruicao: {
        primeiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        segundoDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        terceiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" }
      }
    },
    unidade: "5º BPM/ CPA-6/Coxim-MS",
    pai: "FRANCISCO DE ASSIS MOREIRA ARAUJO",
    mae: "ROSELY NEPUMUCENO SAO JOSE",
    rg: "2037853 ",
    averbacao: [],
    deducao: []
  },
  {
    matricula: "504890022",
    nome_completo: "ELIS FERNANDA DA SILVA OLIVEIRA",
    nome: "ELIS",
    telefone: "",
    avatar_url: "",
    rank: "Soldado",
    status_funcional: "Disponível",
    garrison: "Trânsito",
    email_pm: "elis_fernanda.ol@hotmail.com",
    cpf: "038.085.651-44",
    dependentes: [],
    cursos: [],
    promocoes: [],
    licenca_especial: {
      concessao: {
        primeiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        segundoDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        terceiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" }
      },
      fruicao: {
        primeiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        segundoDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        terceiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" }
      }
    },
    unidade: "5º BPM/ CPA-6/Coxim-MS",
    averbacao: [],
    deducao: []
  },
  {
    matricula: "429598022",
    nome_completo: "THALIA DA SILVA BEZERRA",
    nome: "THALIA",
    telefone: "",
    avatar_url: "",
    rank: "Soldado",
    status_funcional: "Disponível",
    garrison: "Administrativo",
    email_pm: "thalia.bezerra.cx@gmail.com",
    cpf: "061.285.521-02",
    dependentes: [],
    cursos: [],
    promocoes: [],
    licenca_especial: {
      concessao: {
        primeiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        segundoDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        terceiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" }
      },
      fruicao: {
        primeiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        segundoDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        terceiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" }
      }
    },
    unidade: "5º BPM/ CPA-6/Coxim-MS",
    rg: "2.101.201",
    averbacao: [],
    deducao: []
  },
  {
    matricula: "509114021",
    nome_completo: "DALVAN BATISTA DE SOUZA",
    nome: "DALVAN",
    telefone: "",
    avatar_url: "",
    rank: "Soldado",
    status_funcional: "Disponível",
    garrison: "Rádio Patrulha",
    email_pm: "dalvan_batista2015@hotmail.com",
    cpf: "705.905.861-30",
    dependentes: [],
    cursos: [],
    promocoes: [],
    licenca_especial: {
      concessao: {
        primeiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        segundoDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        terceiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" }
      },
      fruicao: {
        primeiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        segundoDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        terceiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" }
      }
    },
    unidade: "3º PEL/1ª CIA/5º BPM/CPA-6/Alcinópolis-MS",
    averbacao: [],
    deducao: []
  },
  {
    matricula: "66534021",
    nome_completo: "JUNIOR APARECIDO SILVA DE SOUZA",
    nome: "APARECIDO",
    telefone: "67 99927-3816",
    avatar_url: "",
    rank: "Cabo",
    status_funcional: "Disponível",
    garrison: "Rádio Patrulha",
    email_pm: "sd.junior1985@hotmail.com",
    cpf: "004.523.521-00",
    data_inclusao: "2008-10-01",
    naturalidade: "COXIM/MS",
    endereco: "RUA AMOR PERFEITO, 137, VILA BELA, COXIM-MS",
    dependentes: [],
    cursos: [
      { ano: "2008", curso: "CFSD", id: "13bb4070-d1e0-4c71-a952-231a5886f5e4", local: "SEDE/5º BPM / CPA-6 / COXIM-MS" },
      { ano: "2017", curso: "CFC", id: "edbe32af-77c8-4c5c-8d36-270f9b1e8bcc", local: "CEFAP / CAMPO GRANDE-MS" }
    ],
    promocoes: [
      { dataDoe: "2018-04-02", dataPromocao: "2018-03-02", doe: "9625", id: "b55ce571-5bb7-4c1c-85fe-c5adda5a61d7", postoGrad: "Cabo" }
    ],
    licenca_especial: {
      concessao: {
        primeiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        segundoDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        terceiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" }
      },
      fruicao: {
        primeiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        segundoDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        terceiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" }
      }
    },
    unidade: "3º PEL/1ª CIA/5º BPM/CPA-6/Alcinópolis-MS",
    pai: "ALVINO APARECIDO DE SOUZA",
    mae: "MARIA DE FATIMA SILVA E SOUZA",
    rg: "1217432",
    doe_inclusao: "7364",
    data_diario: "2008-12-18",
    pagina: "63",
    averbacao: [
      { dataCertidao: "", dataPublicacao: "", doe: "", id: "3654184b-285f-4c60-9191-c93c748ef353", nrCertidao: "", tipo: "INSS", totalDias: "349" },
      { dataCertidao: "", dataPublicacao: "", doe: "", id: "2c12dcb8-c783-4cef-b3f1-5fc06f0c6332", nrCertidao: "", tipo: "INSS", totalDias: "1305" }
    ],
    deducao: [],
    sexo: "Masculino",
    fator_rh: "O+",
    data_nascimento: "1985-08-17"
  },
  {
    matricula: "483939021",
    nome_completo: "LEANDRO BUENO TEIXEIRA DA CUNHA",
    nome: "Bueno",
    telefone: "",
    avatar_url: "",
    rank: "Soldado",
    status_funcional: "Disponível",
    garrison: "Rádio Patrulha",
    email_pm: "leandrobueno@gmail.com",
    cpf: "039.977.021-60",
    data_inclusao: "2020-03-02",
    naturalidade: "CUIABÁ - MT",
    endereco: "RODOVIA ARQUITETO HÉLDER CÂNDIA, 198, CUIABÁ – MT, CEP: 78048-150",
    dependentes: [],
    cursos: [
      { ano: "2020", curso: "CFSD", id: "cc08c21a-fe59-4704-9e1b-5a34b8489a2c", local: "CEFAP/CAMPO GRANDE - MS" }
    ],
    promocoes: [],
    licenca_especial: {
      concessao: {
        primeiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        segundoDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        terceiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" }
      },
      fruicao: {
        primeiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        segundoDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        terceiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" }
      }
    },
    unidade: "3º PEL/2ª CIA/5º BPM/CPA-6/Sonora-MS",
    pai: "OTACILIO TEIXEIRA DA CUNHA",
    mae: "DORALICE FIGUEIREDO BUENO",
    rg: "1667392-1 SSP/MT",
    doe_inclusao: "10.097",
    data_diario: "2020-02-19",
    averbacao: [],
    deducao: []
  },
  {
    matricula: "115632023",
    nome_completo: "NILDO JESUS DE SOUZA",
    nome: "Nildo",
    telefone: "",
    avatar_url: "",
    rank: "1º Sargento",
    status_funcional: "Disponível",
    garrison: "Administrativo",
    email_pm: "nildoantigao@gmail.com",
    cpf: "840.882.061-34",
    data_inclusao: "1998-08-01",
    naturalidade: "Pedro Gomes",
    endereco: "RUA PARANA, 108, JD SÃO PAULO - COXIM/MS",
    dependentes: [],
    cursos: [
      { ano: "1998", curso: "CFSD", id: "33c4e17f-90e7-4ade-b3de-5aab0f287c36", local: "5° BPM - COXIM/MS" },
      { ano: "2013", curso: "CFC", id: "eb0b66d6-c59a-46a7-9de0-044746fbcac8", local: "CEFAP - CAMPO GRANDE/MS" },
      { ano: "2017", curso: "CFS", id: "8268cfb8-5c43-4a01-b0fe-7ca65187b63a", local: "CEFAP - CAMPO GRANDE/MS" },
      { ano: "2022", curso: "CAS", id: "bc7b34b4-a543-456b-9bcf-c4a5d5eb04f4", local: "CEFAP - CAMPO GRANDE/MS" }
    ],
    promocoes: [
      { dataDoe: "2013-12-17", dataPromocao: "2013-11-27", doe: "8.578", id: "c9348707-cddd-4242-8baa-3f9427877fac", postoGrad: "Cabo" },
      { dataDoe: "2018-06-22", dataPromocao: "2018-06-18", doe: "9.618", id: "732f9767-3714-4e4c-9ffd-0f9e23c1cdd7", postoGrad: "3º Sargento" },
      { dataDoe: "2022-09-09", dataPromocao: "2022-09-05", doe: "10.935", id: "c93f328f-57b3-40ba-8720-59aa1b3d270c", postoGrad: "2º Sargento" },
      { dataDoe: "2026-05-04", dataPromocao: "2025-04-21", doe: "12.144", id: "e0b03e8c-73ae-4172-a986-44dbc18fb793", postoGrad: "1º Sargento" }
    ],
    licenca_especial: {
      concessao: {
        primeiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        segundoDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        terceiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" }
      },
      fruicao: {
        primeiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        segundoDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        terceiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" }
      }
    },
    unidade: "5º BPM/ CPA-6/Coxim-MS",
    pai: "SEBASTIAO UMBELINO DE SOUZA",
    mae: "ALCINDA JESUS DE SOUZA",
    rg: "899.681",
    doe_inclusao: "4.828",
    data_diario: "1998-08-04",
    pagina: "43 e 44",
    averbacao: [
      { dataCertidao: "", dataPublicacao: "2009-05-04", doe: "", id: "1ba966dc-e56a-4a5b-b6ce-92460792aafa", nrCertidao: "", tipo: "Exército", totalDias: "730" }
    ],
    deducao: [],
    sexo: "Masculino",
    situacao_funcional: "Ativo",
    identidade_funcional: "6863",
    fator_rh: "A+",
    data_nascimento: "1977-10-31"
  },
  {
    matricula: "508978021",
    nome_completo: "MATHEUS MOLINA CALISTO",
    nome: "CALISTO",
    telefone: "67 99122-8792",
    avatar_url: "",
    rank: "2º Tenente",
    status_funcional: "Disponível",
    garrison: "Administrativo",
    email_pm: "matheus.calisto92@gmail.com",
    cpf: "046.689.261-67",
    data_inclusao: "2024-01-15",
    naturalidade: "São Gabriel do Oeste-MS",
    dependentes: [],
    cursos: [
      { ano: "24/25", curso: "CFO", id: "66f6f3ae-31d2-4936-aa74-8687ed59172c", local: "APM - CAMPO GRANDE" }
    ],
    promocoes: [
      { dataDoe: "2025-11-28", dataPromocao: "2025-11-28", doe: "12008", id: "e63982c5-ce08-44b5-8df5-990989e36848", postoGrad: "Aspirante" },
      { dataDoe: "2026-06-03", dataPromocao: "2026-06-02", doe: "12177", id: "c6cf66fc-85ee-4bd8-892d-61fede0aaf99", postoGrad: "2º Tenente" }
    ],
    licenca_especial: {
      concessao: {
        primeiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        segundoDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        terceiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" }
      },
      fruicao: {
        primeiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        segundoDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        terceiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" }
      }
    },
    unidade: "5º BPM/ CPA-6/Coxim-MS",
    pai: "Edival Alves Calisto",
    mae: "Daisy Aparecida Parron Molina Calisto",
    rg: "1405871",
    doe_inclusao: "11386",
    data_diario: "2024-01-17",
    averbacao: [],
    deducao: []
  },
  {
    matricula: "69465021",
    nome_completo: "JOSE DA SILVA PRUDENCIA",
    nome: "Silva",
    telefone: "67 99662-0930",
    avatar_url: "",
    rank: "3º Sargento",
    status_funcional: "Disponível",
    garrison: "Rádio Patrulha",
    email_pm: "prudenciajose48@gmail.com",
    cpf: "00473794136",
    data_inclusao: "2008-10-01",
    naturalidade: "Pedro Gomes MS",
    endereco: "Rua Pereira Gomes, 30 - Senhor Divino - Coxim/MS CEP 79.400-000",
    dependentes: [
      { dataNascimento: "2013-01-14", id: "23f81993-077d-4871-8f91-f286c10fd777", nome: "MARIA EDUARDA FREITAS DA SILVA", tipo: "Filho(a)" }
    ],
    cursos: [
      { ano: "2008", curso: "CFSD", id: "c8230ea0-970e-48fd-973b-92ec6d2462ba", local: "5° BPM / COXIM-MS" },
      { ano: "2017", curso: "CFC", id: "8469910f-44bd-4856-8a7c-ed26b19a733b", local: "CEFAP / CAMPO GRANDE-MS" },
      { ano: "2022", curso: "CFS", id: "b6ed9e24-e75b-4eb4-b264-01aee44af473", local: "CEFAP / CAMPO GRANDE - MS" }
    ],
    promocoes: [
      { dataDoe: "2017-05-04", dataPromocao: "2017-04-19", doe: "9401", id: "920d96d3-279f-4ece-bad2-220240928fa2", postoGrad: "Cabo" },
      { dataDoe: "2025-05-16", dataPromocao: "2014-04-16", doe: "11830", id: "37d46001-da67-41e2-b4d7-d029ae633081", postoGrad: "3º Sargento" }
    ],
    licenca_especial: {
      concessao: {
        primeiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        segundoDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        terceiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" }
      },
      fruicao: {
        primeiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        segundoDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        terceiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" }
      }
    },
    unidade: "5º BPM/ CPA-6/Coxim-MS",
    pai: "JACONIAS PEREIRA DA SILVA",
    mae: "MARIA CONCEICAO PRUDENCIA",
    rg: "1291226",
    doe_inclusao: "7364",
    data_diario: "2008-12-18",
    averbacao: [
      { dataCertidao: "2020-08-20", dataPublicacao: "2020-09-18", doe: "10,282", id: "9de89820-b483-4e5c-ba33-e0024e112a2b", nrCertidao: "015", tipo: "Exército", totalDias: "2401" }
    ],
    deducao: []
  },
  {
    matricula: "424835021",
    nome_completo: "EDUARDO HENRIQUE DO CARMO",
    nome: "EDUARDO",
    telefone: "",
    avatar_url: "",
    rank: "Cabo",
    status_funcional: "Disponível",
    garrison: "Rádio Patrulha",
    email_pm: "sdeduardo_henrique@hotmail.com",
    cpf: "051.401.741-46",
    data_inclusao: "2014-09-22",
    dependentes: [],
    cursos: [],
    promocoes: [],
    licenca_especial: {
      concessao: {
        primeiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        segundoDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        terceiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" }
      },
      fruicao: {
        primeiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        segundoDecenio: { bcg: "", dataBcg: "", qtdDias: "" },
        terceiroDecenio: { bcg: "", dataBcg: "", qtdDias: "" }
      }
    },
    unidade: "5º BPM/ CPA-6/Coxim-MS",
    rg: "001955200",
    doe_inclusao: "8772",
    averbacao: [],
    deducao: []
  }
];
