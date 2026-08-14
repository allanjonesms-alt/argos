export type GraduacaoPMMS = 
  | 'Soldado'
  | 'Cabo'
  | '3º Sargento'
  | '2º Sargento'
  | '1º Sargento'
  | 'Subtenente'
  | '2º Tenente'
  | '1º Tenente'
  | 'Capitão'
  | 'Major'
  | 'Tenente-Coronel'
  | 'Coronel';

export type QuadroPMMS = 'QPPM' | 'QOPM' | 'QOPMA' | 'QAE';

export type SituacaoFuncionalPMMS = 'ATIVO' | 'AGREGADO' | 'LICENÇA' | 'RESERVA' | 'REFORMADO';

export type CriterioPromocao = 'ANTIGUIDADE' | 'MERECIMENTO' | 'BRAVURA' | 'POST_MORTEM' | 'RESSARCIMENTO';

export interface HistoricoPromocaoMilitar {
  id: string;
  militar_id: string;
  graduacao_de: GraduacaoPMMS;
  graduacao_para: GraduacaoPMMS;
  data_evento: string; // YYYY-MM-DD
  criterio: CriterioPromocao;
  bcg_numero: string;
  bcg_data: string;
  observacoes?: string;
}

export interface MilitarPromocao {
  id: string;
  matricula: string;
  nome: string;
  nome_guerra: string;
  graduacao: GraduacaoPMMS;
  quadro: QuadroPMMS;
  unidade: string;
  data_praca: string; // Data de inclusão/praça YYYY-MM-DD
  ultima_promocao: string; // Data da última promoção YYYY-MM-DD
  ordem_antiguidade: number; // Posição no almanaque/fila
  pos_na_graduacao?: number; // Posição/classificação na graduação
  intersticio_meses: number; // Interstício necessário para a graduação atual (ex: 60 meses)
  situacao_funcional: SituacaoFuncionalPMMS;
  foto_url?: string;
  email?: string;
  telefone?: string;
  cpf?: string;
  cadastrado_argos?: boolean;
  observacoes?: string;
  historico?: HistoricoPromocaoMilitar[];
  created_at?: string;
  updated_at?: string;
}

export interface VagaQuadro {
  id: string;
  quadro: QuadroPMMS;
  graduacao: GraduacaoPMMS;
  vagas_previstas: number;
  vagas_ocupadas: number;
  vagas_abertas: number;
}

export interface BCGRecord {
  id: string;
  numero: string;
  ano: number;
  data_publicacao: string;
  arquivo_nome: string;
  arquivo_url?: string;
  status: 'PROCESSADO' | 'PENDENTE' | 'ERRO';
  promocoes_extraidas: number;
  reservas_extraidas: number;
  transferencias_extraidas: number;
  processado_por: string;
  created_at: string;
}

export interface ReservaReformaRecord {
  id: string;
  militar_id: string;
  militar_nome: string;
  graduacao: GraduacaoPMMS;
  quadro: QuadroPMMS;
  tipo: 'RESERVA_REMUNERADA' | 'REFORMA';
  data_evento: string;
  bcg_numero: string;
  motivo?: string;
}

export interface ConfiguracaoPMMS {
  intersticios: Record<GraduacaoPMMS, number>;
  proximas_datas_promocao: Array<{
    data: string; // YYYY-MM-DD
    nome: string; // ex: "21 de Abril - Dia de Tiradentes"
  }>;
}

export interface SimulacaoResultado {
  militar: MilitarPromocao;
  posicao_fila: number;
  intersticio_cumprido: boolean;
  meses_cumpridos: number;
  percentual_intersticio: number;
  elegivel_vaga: boolean;
  previsao_promocao_data: string;
  motivo_inelegibilidade?: string;
  proxima_graduacao?: GraduacaoPMMS;
}

export type PromocaoUserLevel = 'ADMIN' | 'EDITOR' | 'CONSULTA';
