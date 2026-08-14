
export enum UserRole {
  ADMIN = 'ADMIN',
  OPERATOR = 'OPERATOR',
  MASTER = 'MASTER',
  CHEFE_DE_EQUIPE = 'CHEFE_DE_EQUIPE',
  PATRULHEIRO = 'PATRULHEIRO',
  SUPERVISOR_DE_OPERACOES = 'SUPERVISOR_DE_OPERACOES'
}

export interface User {
  id: string;
  matricula: string;
  nome: string;
  nome_completo?: string;
  senha: string;
  role: UserRole;
  primeiro_acesso: boolean;
  ord?: number;
  unidade?: string;
  unidades_extras?: string[];
  
  // Novos campos originados da migração policial (CSV)
  telefone?: string;
  avatar_url?: string;
  rank?: string;
  status_funcional?: string;
  garrison?: string;
  email_pm?: string;
  cpf?: string;
  data_inclusao?: string;
  tempo_servico?: string;
  filiacao?: string;
  naturalidade?: string;
  endereco?: string;
  dependentes?: any[];
  cursos?: any[];
  promocoes?: any[];
  licenca_especial?: any;
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
  created_at?: string;
}

export interface Shift {
  id: string;
  comandante: string;
  motorista: string;
  patrulheiro_1?: string;
  patrulheiro_2?: string;
  horario_inicio: string;
  horario_fim?: string;
  status: 'ATIVO' | 'ENCERRADO';
  encerrado_por_nome?: string;
  unidade?: string;
  viatura_id?: string;
  viatura_prefixo?: string;
  viatura_modelo?: string;
  km_inicial?: number;
  km_final?: number;
  criado_por?: string;
}

export interface PhotoRecord {
  id: string;
  path: string;
  is_primary: boolean;
  individuo_id?: string;
  sort_order?: number;
  created_at?: string;
}

export interface Individual {
  id: string;
  nome: string;
  alcunha?: string;
  documento?: string;
  data_nascimento?: string;
  mae?: string;
  endereco?: string;
  faccao?: string;
  observacao?: string;
  unidade?: string;
  cidade?: string;
  created_at?: string;
  updated_at?: string;
  fotos_individuos?: PhotoRecord[];
}

export interface ConfidentialInfo {
  id: string;
  individuo_id: string;
  conteudo: string;
  operador_nome: string;
  operador_id: string;
  created_at: string;
}

export interface Relationship {
  id: string;
  individuo_id: string;
  relacionado_id: string;
  tipo: 'COMPARSA' | 'FAMILIAR';
  created_at: string;
  created_by?: string;
  relacionado_nome?: string;
  relacionado_alcunha?: string;
}

export interface Attachment {
  id: string;
  individuo_id: string;
  nome_arquivo: string;
  tipo_mime: string;
  path: string;
  legenda?: string;
  created_by?: string;
  created_at: string;
}

export interface DBApproach {
  id: string;
  data: string;
  horario: string;
  local: string;
  relatorio: string;
  objetos_apreendidos?: string;
  resultado?: string;
  individuo_nome?: string;
  individuo_id?: string;
  unidade?: string;
  criado_por?: string;
  created_at?: string;
  foto_path?: string;
  is_saw?: boolean;
}

export interface Unit {
  id: string;
  nome: string;
  created_at?: any;
  enabled_features?: string[];
}

export interface SystemVersion {
  id: string;
  version: string;
  type: 'ATUALIZAÇÃO' | 'REPARO';
  description: string;
  date: string;
  created_at?: any;
}

export enum CrimeType {
  DRUGS = 'DROGAS',
  WEAPONS = 'ARMAS',
  ROBBERY = 'ROUBOS'
}

export enum CrimeMemberRole {
  DISTRIBUIDOR = 'DISTRIBUIDOR',
  BOCA_DE_FUMO = 'BOCA_DE_FUMO',
  VAPOR = 'VAPOR',
  USUARIO = 'USUARIO'
}

export interface CrimeGroup {
  id: string;
  nome: string;
  cidade: string;
  tipo: CrimeType;
  created_at: string;
  updated_at: string;
}

export interface CrimeMember {
  id: string;
  group_id: string;
  individual_id: string;
  role: CrimeMemberRole;
  parent_id?: string; // For hierarchy
  drugs?: string[]; // MACONHA, COCAINA, HAXIXE, CRACK, ECSTASY, OUTROS
  funcao_especifica?: string;
  created_at: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
}

export interface LogEntry {
  id: string;
  userId: string;
  userName: string;
  action: string;
  details: string;
  timestamp: any;
  metadata?: any;
}

export interface OccurrenceSS {
  id: string;
  nr_ss: string;
  tipo_ss: 'Rondas' | 'Policiamento em evento' | 'Policiamento Medidas Protetivas' | 'Atendimento de Chamada';
  gu_servico: string[];
  unidade?: string;
  cidade?: string;
  criado_por: string;
  created_at: string;
  date?: string;
  time?: string;
  facts?: string;
  personnel?: string;
  eventoComunicado?: string;
  roAddress?: string;
}

export interface OccurrenceRO {
  id: string;
  nr_ro: string;
  fato: string | string[];
  unidade?: string;
  cidade?: string;
  criado_por: string;
  created_at: string;
  gu_servico?: string[];
  roData?: string[];
  roAddress?: string;
  date?: string;
  time?: string;
  facts?: string;
  personnel?: string;
  eventoComunicado?: string;
}

export type RequerimentoTipo = 
  | 'OUTROS'
  | 'acesso-sistemas' | 'ajuda-custo' | 'ajuda-curso' | 'auxilio-fardamento' | 'averbacao-ficha-oficial' | 'averbacao-tempo-inss' | 'averbacao-tempo-servico-militar' | 'certidao-tempo-contribuicao' | 'correcao-dados' | 'designacao-funcao' | 'despesas-funeral' | 'identidade-funcional' | 'inclusao-dependentes' | 'licenciamento-pedido' | 'ltip' | 'progressao-funcional' | 'regularizacao-ferias' | 'reserva-remunerada' | 'ressarcimento-promocao' | 'transferencia-interesse-proprio';

export interface Requerimento {
  id: string;
  matricula: string;
  nome_operador: string;
  unidade: string;
  tipo: RequerimentoTipo;
  tipo_descricao: string;
  descricao: string;
  status: 'PENDENTE' | 'DEFERIDO' | 'INDEFERIDO';
  resposta_admin?: string;
  analisado_por_nome?: string;
  analisado_por_id?: string;
  analisado_em?: string;
  created_at: string;
  created_by: string;
  
  // Custom fields
  amparo_legal?: string;
  sexo?: string;
  data_nascimento_req?: string;
  fator_rh?: string;
  situacao_funcional?: string;
  identidade_funcional?: string;
  certidao_nivel_classe?: string;
  certidao_quadro?: string;
  certidao_municipio?: string;
  certidao_orgao?: string;
  certidao_exercendo?: string;
  certidao_periodo_inicio?: string;
  certidao_periodo_fim?: string;
  certidao_total_bruto?: string;
  certidao_averbacao?: string;
  certidao_interrupcao?: string;
  certidao_faltas?: string;
  certidao_licencas?: string;
  certidao_suspensoes?: string;
  certidao_outros?: string;
  certidao_soma?: string;
  certidao_total_liquido?: string;
  certidao_tempo_efetivo?: string;
  certidao_total_tempo_efetivo?: string;
  certidao_finalidade?: string;
  certidao_responsavel?: { nome: string; patente: string; funcao: string; matricula: string };
  certidao_gestor_rh?: { nome: string; patente: string; funcao: string; matricula: string };
}
