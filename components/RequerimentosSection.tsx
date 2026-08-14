import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, Plus, Check, X, ShieldAlert, FileClock, 
  Trash2, AlertCircle, ChevronDown, ChevronUp, Send, CheckCircle2, XCircle,
  Monitor, Wallet, GraduationCap, Shirt, Clock, Shield, PenLine, HeartPulse,
  CreditCard, UserPlus, Stethoscope, TrendingUp, Plane, Home, Receipt,
  ArrowRightLeft, ClipboardCheck, Search, Settings
} from 'lucide-react';
import { User, Requerimento, RequerimentoTipo } from '../types';
import { db, logAction } from '../firebase';
import { 
  collection, query, where, orderBy, onSnapshot, 
  doc, addDoc, updateDoc, deleteDoc, serverTimestamp,
  getDoc, getDocs
} from 'firebase/firestore';
import { generateRequestPdf } from '../utils/pdfGenerator';
import RequerimentosSettingsModal from './RequerimentosSettingsModal';

interface RequerimentosSectionProps {
  user: User | null;
  canManage: boolean;
}

const TIPO_LABELS: Record<string, string> = {
  OUTROS: 'Outros Assuntos',
  'outros': 'Outros Assuntos',

  'acesso-sistemas': 'Acesso a Sistemas',
  'ajuda-custo': 'Ajuda de Custo',
  'ajuda-curso': 'Ajuda de Curso',
  'auxilio-fardamento': 'Auxílio Fardamento',
  'averbacao-ficha-oficial': 'Averbação em Ficha de Oficial',
  'averbacao-tempo-inss': 'Averbação de Tempo de INSS',
  'averbacao-tempo-servico-militar': 'Averbação de Tempo de Serviço Militar',
  'certidao-tempo-contribuicao': 'Certidão Tempo de Contribuição',
  'correcao-dados': 'Correção de Dados',
  'designacao-funcao': 'Designação de Função',
  'despesas-funeral': 'Despesas de Funeral',
  'identidade-funcional': 'Identidade Funcional',
  'inclusao-dependentes': 'Inclusão de Dependentes',
  'licenciamento-pedido': 'Licenciamento a Pedido',
  'ltip': 'LTIP',
  'progressao-funcional': 'Progressão Funcional',
  'regularizacao-ferias': 'Regularização de Férias',
  'reserva-remunerada': 'Reserva Remunerada',
  'ressarcimento-promocao': 'Ressarcimento de Promoção',
  'transferencia-interesse-proprio': 'Transferência por Interesse Próprio',

  // Legacy keys
  'IDENTIDADE_FUNCIONAL': 'Identidade Funcional',
  'CERTIDAO_TEMPO_CONTRIBUICAO': 'Certidão Tempo de Contribuição',
  'LICENCA_ESPECIAL': 'Licença Especial',
  'ABONO': 'Abono de Permanência',
  'FERIAS': 'Regularização de Férias',
  'DISPENSA': 'Dispensa do Serviço',
  'PROMOCOES': 'Ressarcimento de Promoção'
};

const TIPO_COLORS: Record<RequerimentoTipo, string> = {
  OUTROS: 'bg-slate-50 text-slate-700 border-slate-200',

  'acesso-sistemas': 'bg-cyan-50 text-cyan-700 border-cyan-200',
  'ajuda-custo': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'ajuda-curso': 'bg-teal-50 text-teal-700 border-teal-200',
  'auxilio-fardamento': 'bg-blue-50 text-blue-700 border-blue-200',
  'averbacao-ficha-oficial': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'averbacao-tempo-inss': 'bg-violet-50 text-violet-700 border-violet-200',
  'averbacao-tempo-servico-militar': 'bg-purple-50 text-purple-700 border-purple-200',
  'correcao-dados': 'bg-amber-50 text-amber-700 border-amber-200',
  'designacao-funcao': 'bg-sky-50 text-sky-700 border-sky-200',
  'despesas-funeral': 'bg-rose-50 text-rose-700 border-rose-200',
  'inclusao-dependentes': 'bg-pink-50 text-pink-700 border-pink-200',
  'licenciamento-pedido': 'bg-orange-50 text-orange-700 border-orange-200',
  'ltip': 'bg-lime-50 text-lime-700 border-lime-200',
  'progressao-funcional': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'regularizacao-ferias': 'bg-blue-50 text-blue-700 border-blue-200',
  'reserva-remunerada': 'bg-stone-50 text-stone-700 border-stone-200',
  'ressarcimento-promocao': 'bg-amber-50 text-amber-700 border-amber-200',
  'transferencia-interesse-proprio': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'identidade-funcional': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'certidao-tempo-contribuicao': 'bg-emerald-50 text-emerald-700 border-emerald-200'
};

const TIPO_ICONS: Record<RequerimentoTipo, React.ComponentType<any>> = {
  OUTROS: FileText,

  'acesso-sistemas': Monitor,
  'ajuda-custo': Wallet,
  'ajuda-curso': GraduationCap,
  'auxilio-fardamento': Shirt,
  'averbacao-ficha-oficial': FileText,
  'averbacao-tempo-inss': Clock,
  'averbacao-tempo-servico-militar': Shield,
  'certidao-tempo-contribuicao': FileText,
  'correcao-dados': PenLine,
  'designacao-funcao': ClipboardCheck,
  'despesas-funeral': HeartPulse,
  'identidade-funcional': CreditCard,
  'inclusao-dependentes': UserPlus,
  'licenciamento-pedido': FileText,
  'ltip': Stethoscope,
  'progressao-funcional': TrendingUp,
  'regularizacao-ferias': Plane,
  'reserva-remunerada': Home,
  'ressarcimento-promocao': Receipt,
  'transferencia-interesse-proprio': ArrowRightLeft
};

const PREDEFINED_SOLICITACOES: Record<RequerimentoTipo, Array<{ label: string; text: string; amparo?: string }>> = {
  OUTROS: [
    { 
      label: 'Petição Geral', 
      text: 'REQUER a Vossa Senhoria a concessão de [DESCREVA SEU PEDIDO].',
      amparo: "Art. 5º, Inciso XXXIV, alínea 'a' da Constituição Federal de 1988."
    }
  ],
  'acesso-sistemas': [
    {
      label: 'Solicitação de Acesso a Sistemas Corporativos',
      text: 'REQUER a Vossa Senhoria se digne conceder autorização de acesso e criação de credenciais para os systems corporativos de segurança pública e de gestão de dados institucionais, para fins de desempenho das funções regulamentares.',
      amparo: "Art. 5º, Inciso XXXIV, alínea 'a' da Constituição Federal de 1988."
    }
  ],
  'ajuda-custo': [
    {
      label: 'AJUDA DE CUSTO POR TER SIDO TRANSFERIDO POR NECESSIDADE DO SERVIÇO - SEM DEPENDENTES',
      text: 'AJUDA DE CUSTO POR TER SIDO TRANSFERIDO POR NECESSIDADE DO SERVIÇO DO XXXXXXXXXXXXXXXXXXX – MS PARA O 5º BPM/CPA-6/COXIM – MS, CONFORME PORTARIA “P” DGP-1/DGP/PMMS N.1011, DE 24 DE SETEMBRO DE 2024, PUBLICADA NO DOE Nº XXXXXX DE XX DE SETEMBRO DE 2026 – PÁGINA 196 EM ANEXO.',
      amparo: 'Artigo 5º, inciso I c/c Art. 6º § 1º e Art. 7º, inciso I da Lei Complementar nº 127, de 15 de maio de 2008.'
    }
  ],
  'ajuda-curso': [
    {
      label: 'Auxílio de Curso / Especialização',
      text: 'REQUER a concessão de auxílio financeiro / ajuda de curso para custeio de capacitação profissional e especialização de interesse da corporação, conforme regulamento vigente.',
      amparo: 'Regulamento de Ensino e Instrução da Polícia Militar.'
    }
  ],
  'auxilio-fardamento': [
    {
      label: 'Auxílio Fardamento por ter sido promovido',
      text: 'Adiantamento de Soldo para aquisição de uniformes por por ter sido promovido na graduação de 1º SGT PM\nconforme promoção a contar de 06 de dezembro de 2022 publicado em DOE nº 11.010 de 06 de dezembro de 2022.',
      amparo: 'Art. 19 da Lei Complementar nº 127, de 15 de maio de 2008.'
    },
    {
      label: 'Auxílio Fardamento por permanecer acima do insterstício na mesma graduação',
      text: 'Adiantamento de Soldo para aquisição de uniformes por permanecer mais de 3 (três) anos como 3º SGT PM\nconforme promoção a contar de 06 de dezembro de 2022 publicado em DOE nº 11.010 de 06 de dezembro de 2022.',
      amparo: '§3° do Art. 19 da Lei Complementar nº 127, de 15 de maio de 2008.'
    }
  ],
  'averbacao-ficha-oficial': [
    {
      label: 'Averbação na Ficha de Promoção de Oficiais',
      text: 'Averbar na Ficha de Promoção de Oficiais os Elogios exarados pelo Comandante do Comando de Policiamento de\nÁrea-6 ( CPA-6), publicado no BCG nº 236 de 19 de dezembro de 2025 página 7.',
      amparo: 'Item 7.3 do ANEXO C DO DECRETO Nº 10.768, DE 9 DE MAIO DE 2002. (redação dada pelo Anexo II do Decreto nº 15.252, de 4 de julho de 2019),'
    }
  ],
  'averbacao-tempo-inss': [
    {
      label: 'Averbação de Tempo de Contribuição do INSS',
      text: 'REQUER a averbação de tempo de serviço prestado junto à iniciativa privada e recolhido perante o INSS, totalizando [DIAS] dias de contribuição, para todos os efeitos legais.',
      amparo: 'Lei Complementar Estadual de Previdência dos Militares.'
    }
  ],
  'averbacao-tempo-servico-militar': [
    {
      label: 'Averbação de 1/3 de Categoria Especial A do Exército',
      text: 'Averbação do acréscimo de 1/3 de Tempo de Serviço Militar prestados junto ao Exército Brasileiro passado pelo militar na guarnição especial de Categoria A, conforme consta na Certidão de Tempo de Serviço Militar nº 006 de 03 de maio de 2016.',
      amparo: 'Artigo 131, inciso I da Lei Complementar n.º 053, de 30 de agosto de 1990 (Estatuto da PMMS) c/c o artigo 1º, inciso I do Decreto 6.555 de 17 Jun. 92.'
    },
    {
      label: 'Averbar Tempo de Serviço Militar',
      text: 'Averbação de Tempo de Serviço Militar prestados junto ao Exército Brasileiro, com acréscimo de 1/3 de na guarnição especial de Categoria A, conforme consta na Certidão de Tempo de Serviço Militar nº XX de XX de XXXXXXX de 2026.',
      amparo: 'Artigo 131, inciso I da Lei Complementar n.º 053, de 30 de agosto de 1990 (Estatuto da PMMS) c/c o artigo 1º, inciso I do Decreto 6.555 de 17 Jun. 92.'
    }
  ],
  'certidao-tempo-contribuicao': [
    {
      label: 'Certidão de Tempo de Contribuição para Reserva',
      text: 'REQUER a expedição de Certidão de Tempo de Contribuição e Efetivo Serviço para fins de instruir processo de transferência para a Reserva Remunerada a pedido.',
      amparo: "Art. 5º, Inciso XXXIV, alínea 'a' da Constituição Federal de 1988."
    }
  ],
  'correcao-dados': [
    {
      label: 'Correção de Dados Cadastrais',
      text: 'REQUER a retificação e correção de seus dados cadastrais (ex: nome, CPF, RG, filiação, data de nascimento) constantes no sistema de gestão de recursos humanos da Corporação, anexando documento comprobatório.',
      amparo: "Art. 5º, Inciso XXXIV, alínea 'a' da Constituição Federal de 1988."
    }
  ],
  'designacao-funcao': [
    {
      label: 'Designação de função de Chefe de Equipe',
      text: 'Designação de função de Chefe de Equipe pelo desempenho no serviço operacional de comandante de guarnição do PROMUSE, conforme escalas de serviço anexas',
      amparo: 'Art. 23, Inciso VI da Lei Complementar nr. 127/2008 com redação dada pela LC 291/2021'
    }
  ],
  'despesas-funeral': [
    {
      label: 'Reembolso de Despesas de Funeral',
      text: 'REQUER o reembolso / pagamento de Auxílio Funeral em decorrência do falecimento do dependente legal [NOME], conforme comprovantes de despesas fúnebres anexados ao presente processo.',
      amparo: 'Lei de Remuneração dos Militares Estaduais.'
    }
  ],
  'identidade-funcional': [
    {
      label: 'Emissão de 2ª via de Identidade Funcional',
      text: 'REQUER a emissão da 2ª via de sua Cédula de Identidade Funcional em razão de [MOTIVO - perda/extravio/desgaste].',
      amparo: "Art. 5º, Inciso XXXIV, alínea 'a' da Constituição Federal de 1988."
    }
  ],
  'inclusao-dependentes': [
    {
      label: 'Inclusão de filhos',
      text: 'Inclusão no rol de dependente, o filho menor: XXXXXXXXXXXXXX, nascida em XX/XX/XXXX, CPF nº 000.000.000-00, conforme Certidão de Nascimento matrícula nº 000000 00 00 0000 0 00000 000 0000000 00, conforme cópia da certidão e documentos pessoais em anexo.',
      amparo: 'Artigo art. 47, § 2º, letra “b” da Lei Complementar n.º 053, de 30 de agosto de 1990, c/c Art. 50, § 2º inciso II, da Lei nº 6.880, de 9 de dezembro de 1980, com nova redação dada pela Lei n. 13.954, de 16 de dezembro de 2019'
    },
    {
      label: 'Inclusão de Conjuge',
      text: 'Inclusão no rol de dependentes a cônjuge XXXXXXXXXXXXXXXXXX nascida em 00/00/0000 conforme certidão de Casamento nr. XXXXXXXXXXXXXX XXXXX XX XXXX XXXXXXXXXX',
      amparo: 'Art. 47, § 2º, letra “a” da Lei Complementar n.º 053, de 30 de agosto de 1990, c/c Art. 50, § 2º inciso I, da Lei nº 6.880, de 9 de dezembro de 1980, com nova redação dada pela Lei n. 13.954, de 16 de dezembro de 2019.'
    }
  ],
  'licenciamento-pedido': [
    {
      label: 'Licenciamento a Pedido',
      text: 'Licenciamento a pedido do cargo de policial militar do Estado de Mato Grosso do Sul',
      amparo: 'artigo art. 47, item XV, da Lei Complementar n.º 053, de 30 de agosto de 1990, c/c art. 121-I e §1°-A-I, art. 50-IV, item P, da Lei nº 6.880, de 9 de dezembro de 1980, incluso pela Lei 13.954 de 2019'
    }
  ],
  'ltip': [
    {
      label: 'Licença para Tratamento de Interesse Particular (LTIP)',
      text: 'REQUER a concessão de Licença para Tratamento de Interesse Particular (LTIP), pelo prazo de [PRAZO], sem remuneração, para fins de resolução de pendências de caráter pessoal.',
      amparo: 'Art. 68, da Lei Complementar nº 053/1990.'
    }
  ],
  'progressao-funcional': [
    {
      label: 'Progressão Funcional',
      text: 'Progressão Funcional Militar, NÍVEL VII, a contar 01 de março de 2026, por completar 30 (trinta) anos de efetivo serviço na Polícia Militar do Estado de Mato Grosso do Sul na referida data.',
      amparo: 'Artigo 26-A, Inciso VII, da Lei Complementar nº 127, de 15 de maio de 2008, acrescentado pela Lei Complementar nº 335, de 02 de outubro de 2024.'
    }
  ],
  'regularizacao-ferias': [
    {
      label: 'Regularização de Período de Férias Acumuladas',
      text: 'REQUER a regularização e agendamento para gozo de férias regulamentares atrasadas relativas ao período aquisitivo [ANO_AQUISITIVO], visando evitar acúmulo ilícito.',
      amparo: 'Art. 61, da Lei Complementar nº 053/1990.'
    }
  ],
  'reserva-remunerada': [
    {
      label: 'Transferência para a Reserva Remunerada a Pedido',
      text: 'REQUER a transferência para a inatividade mediante Reserva Remunerada a Pedido, por contar com o tempo de serviço e contribuição previdenciária exigidos por lei, conforme certidões anexadas.',
      amparo: 'Art. 98, da Lei Complementar nº 053/1990.'
    }
  ],
  'ressarcimento-promocao': [
    {
      label: 'Ressarcimento de Peromoção',
      text: 'POR TER SIDO PROMOVIDO A GRADUAÇÃO DE 3° SGT QPPM A CONTAR DE 21/04/2014, CONFORME PUBLICADO NO DOE Nº 11.830 DE 16 DE MAIO DE 2025 – PÁGINA 140 EM ANEXO.',
      amparo: 'Artigo 56, inciso I, item a, §§ 1º e 2º da Lei Complementar nº 127, de 15 de maio de 2008 com redação dada pela LC n° 210 de 30 de novembro de 2015, bem como art. 21, inciso I do decreto 10.769 de 09 de maio de 2002.'
    }
  ],
  'transferencia-interesse-proprio': [
    {
      label: 'Tranferência por interesse próprio',
      text: 'Transferência por interesse próprio da unidade para unidade.',
      amparo: 'Artigo 5º § 1º alínea “b” e Artigo 16 inciso IX do Decreto nº 1.093 de 12 jun 81 (Regulamento de Movimentação de Oficiais e Praças).'
    }
  ]
};

export const RequerimentosSection: React.FC<RequerimentosSectionProps> = ({ user, canManage }) => {
  const navigate = useNavigate();
  const [requerimentos, setRequerimentos] = useState<Requerimento[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [dbConfig, setDbConfig] = useState<any>(null);

  const loadConfig = async () => {
    try {
      const docRef = doc(db, 'requerimento_configs', 'default');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setDbConfig(docSnap.data());
      }
    } catch (err) {
      console.error("Erro ao buscar configurações de requerimentos:", err);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const getTemplatesForType = (currentTipo: RequerimentoTipo): Array<{ label: string; text: string; amparo?: string }> => {
    if (dbConfig?.predefined_solicitacoes?.[currentTipo] && Array.isArray(dbConfig.predefined_solicitacoes[currentTipo]) && dbConfig.predefined_solicitacoes[currentTipo].length > 0) {
      return dbConfig.predefined_solicitacoes[currentTipo];
    }
    return PREDEFINED_SOLICITACOES[currentTipo] || [];
  };
  
  // Form State
  const [tipo, setTipo] = useState<RequerimentoTipo>('OUTROS');
  const [descricao, setDescricao] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Custom states matching the rich form
  const [selectedSolicitacaoLabel, setSelectedSolicitacaoLabel] = useState<string>('');
  const [amparoLegal, setAmparoLegal] = useState<string>('');

  // Search User state (only for admins)
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<User | null>(user);
  const [searchTerm, setSearchTerm] = useState('');
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  // Identidade Funcional custom fields
  const [sexo, setSexo] = useState('');
  const [dataNascimentoReq, setDataNascimentoReq] = useState('');
  const [fatorRh, setFatorRh] = useState('');
  const [situacaoFuncional, setSituacaoFuncional] = useState('');
  const [identidadeFuncional, setIdentidadeFuncional] = useState('');

  // Certidão Tempo de Contribuição custom fields
  const [certidaoNivelClasse, setCertidaoNivelClasse] = useState('');
  const [certidaoQuadro, setCertidaoQuadro] = useState('Permanente');
  const [certidaoMunicipio, setCertidaoMunicipio] = useState('');
  const [certidaoOrgao, setCertidaoOrgao] = useState('Polícia Militar');
  const [certidaoExercendo, setCertidaoExercendo] = useState('Ativo');
  const [certidaoPeriodoInicio, setCertidaoPeriodoInicio] = useState('');
  const [certidaoPeriodoFim, setCertidaoPeriodoFim] = useState('');
  const [certidaoTotalBruto, setCertidaoTotalBruto] = useState('');
  const [certidaoAverbacao, setCertidaoAverbacao] = useState('');
  const [certidaoInterrupcao, setCertidaoInterrupcao] = useState('');
  const [certidaoFaltas, setCertidaoFaltas] = useState('');
  const [certidaoLicencas, setCertidaoLicencas] = useState('');
  const [certidaoSuspensoes, setCertidaoSuspensoes] = useState('');
  const [certidaoOutros, setCertidaoOutros] = useState('');
  const [certidaoSoma, setCertidaoSoma] = useState('');
  const [certidaoTotalLiquido, setCertidaoTotalLiquido] = useState('');
  const [certidaoTempoEfetivo, setCertidaoTempoEfetivo] = useState('');
  const [certidaoTotalTempoEfetivo, setCertidaoTotalTempoEfetivo] = useState('');
  const [certidaoFinalidade, setCertidaoFinalidade] = useState('');
  const [certidaoResponsavelNome, setCertidaoResponsavelNome] = useState('');
  const [certidaoResponsavelPatente, setCertidaoResponsavelPatente] = useState('');
  const [certidaoResponsavelFuncao, setCertidaoResponsavelFuncao] = useState('');
  const [certidaoResponsavelMatricula, setCertidaoResponsavelMatricula] = useState('');
  const [certidaoGestorRHNome, setCertidaoGestorRHNome] = useState('');
  const [certidaoGestorRHPatente, setCertidaoGestorRHPatente] = useState('');
  const [certidaoGestorRHFuncao, setCertidaoGestorRHFuncao] = useState('');
  const [certidaoGestorRHMatricula, setCertidaoGestorRHMatricula] = useState('');

  // Fetch all users for search if canManage is true
  useEffect(() => {
    if (canManage) {
      const fetchUsers = async () => {
        try {
          const querySnapshot = await getDocs(collection(db, 'users'));
          const usersList: User[] = [];
          querySnapshot.forEach((doc) => {
            usersList.push({ id: doc.id, ...doc.data() } as User);
          });
          setAllUsers(usersList);
        } catch (err) {
          console.error("Erro ao buscar usuários para formulário de requerimento:", err);
        }
      };
      fetchUsers();
    }
  }, [canManage]);

  // Sync custom inputs with profile info when profile changes
  useEffect(() => {
    if (selectedProfile) {
      setSexo(selectedProfile.sexo || '');
      setDataNascimentoReq(selectedProfile.data_nascimento || '');
      setFatorRh(selectedProfile.fator_rh || '');
      setSituacaoFuncional(selectedProfile.status_funcional || selectedProfile.situacao_funcional || '');
      setIdentidadeFuncional(selectedProfile.identidade_funcional || '');
      
      if (selectedProfile.data_inclusao) {
        setCertidaoPeriodoInicio(selectedProfile.data_inclusao);
      }
      const today = new Date().toISOString().split('T')[0];
      setCertidaoPeriodoFim(today);
    }
  }, [selectedProfile]);

  // Sync predefined solicitation select when nature/tipo changes
  useEffect(() => {
    const defaultSols = getTemplatesForType(tipo);
    if (defaultSols && defaultSols.length > 0) {
      setSelectedSolicitacaoLabel(defaultSols[0].label);
      setDescricao(defaultSols[0].text);
      setAmparoLegal(defaultSols[0].amparo || '');
    } else {
      setSelectedSolicitacaoLabel('');
      setDescricao('');
      setAmparoLegal('');
    }
  }, [tipo, dbConfig]);

  // Filter State
  const [statusFilter, setStatusFilter] = useState<'TODOS' | 'PENDENTE' | 'DEFERIDO' | 'INDEFERIDO'>('TODOS');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Admin Action State
  const [despacho, setDespacho] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [pdfLoadingId, setPdfLoadingId] = useState<string | null>(null);

  const handleDownloadPdf = async (req: Requerimento) => {
    setPdfLoadingId(req.id);
    setError(null);
    try {
      // 1. Fetch requester user profile from Firestore users collection
      let requesterData: any = null;
      if (req.created_by && typeof req.created_by === 'string' && req.created_by.trim() !== '') {
        try {
          const userDocRef = doc(db, 'users', req.created_by.trim());
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            requesterData = userDocSnap.data();
          }
        } catch (errUser) {
          console.warn("Não foi possível carregar o perfil do criador:", errUser);
        }
      }
      if (!requesterData) {
        if (user && user.id === req.created_by) {
          // Fallback to current user if the doc doesn't exist
          requesterData = user;
        } else {
          // Mock profile data if user cannot be found
          requesterData = {
            nome: req.nome_operador,
            matricula: req.matricula,
            unidade: req.unidade
          };
        }
      }

      // 2. Select amparo legal based on the request type
      let amparoLegal = req.amparo_legal || "Art. 5º, Inciso XXXIV, alínea 'a' da Constituição Federal de 1988.";
      if (!req.amparo_legal) {
        if ((req.tipo as string) === 'LICENCA_ESPECIAL') {
          amparoLegal = "Art. 136, § 1º, da Lei Complementar nº 053, de 30 de agosto de 1990.";
        } else if ((req.tipo as string) === 'ABONO') {
          amparoLegal = "Art. 15, Inciso I, do Decreto nº 14.225, de 10 de julho de 2015.";
        } else if ((req.tipo as string) === 'FERIAS') {
          amparoLegal = "Art. 61, da Lei Complementar nº 053, de 30 de agosto de 1990.";
        } else if ((req.tipo as string) === 'DISPENSA') {
          amparoLegal = "Art. 18, do Regulamento de Movimentação de Policiais Militares (R-2).";
        } else if ((req.tipo as string) === 'PROMOCOES') {
          amparoLegal = "Lei Complementar nº 156, de 03 de abril de 2012, de Promoção de Praças/Oficiais.";
        }
      }

      const formatDateStr = (dateStr?: string) => {
        if (!dateStr) return '-';
        try {
          const parts = dateStr.split('-');
          if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
          }
          return new Date(dateStr).toLocaleDateString('pt-BR');
        } catch (e) {
          return dateStr;
        }
      };

      let justificationText = req.descricao;
      if ((req.tipo as string) === 'IDENTIDADE_FUNCIONAL') {
        justificationText = `REQUER ao Senhor Comandante a emissão de Identidade Funcional com os seguintes dados:\n\n` +
          `• Sexo: ${req.sexo || '-'}\n` +
          `• Data de Nascimento: ${req.data_nascimento_req ? formatDateStr(req.data_nascimento_req) : '-'}\n` +
          `• Fator RH: ${req.fator_rh || '-'}\n` +
          `• Situação Funcional: ${req.situacao_funcional || '-'}\n` +
          `• N° ID Funcional: ${req.identidade_funcional || '-'}\n\n` +
          `Justificativa:\n${req.descricao}`;
      } else if ((req.tipo as string) === 'CERTIDAO_TEMPO_CONTRIBUICAO') {
        justificationText = `REQUER ao Senhor Comandante a emissão de Certidão de Tempo de Contribuição.\n\n` +
          `DADOS FUNCIONAIS:\n` +
          `• Nível/Classe/Referência: ${req.certidao_nivel_classe || '-'}\n` +
          `• Quadro: ${req.certidao_quadro || '-'}\n` +
          `• Município: ${req.certidao_municipio || '-'}\n` +
          `• Órgão: ${req.certidao_orgao || '-'}\n` +
          `• Exercendo no Momento: ${req.certidao_exercendo || '-'}\n` +
          `• Período: de ${req.certidao_periodo_inicio ? formatDateStr(req.certidao_periodo_inicio) : '-'} até ${req.certidao_periodo_fim ? formatDateStr(req.certidao_periodo_fim) : '-'}\n\n` +
          `DEMONSTRATIVO:\n` +
          `• Total Bruto: ${req.certidao_total_bruto || '-'}\n` +
          `• Averbação: ${req.certidao_averbacao || '-'}\n` +
          `• Interrupção: ${req.certidao_interrupcao || '-'}\n` +
          `• Faltas: ${req.certidao_faltas || '-'}\n` +
          `• Licenças: ${req.certidao_licencas || '-'}\n` +
          `• Suspensões: ${req.certidao_suspensoes || '-'}\n` +
          `• Outros: ${req.certidao_outros || '-'}\n` +
          `• Soma de Deduções: ${req.certidao_soma || '-'}\n` +
          `• Total Líquido: ${req.certidao_total_liquido || '-'}\n\n` +
          `TEMPO DE EFETIVO EXERCÍCIO:\n` +
          `• Tempo como PM: ${req.certidao_tempo_efetivo || '-'}\n` +
          `• Total Geral: ${req.certidao_total_tempo_efetivo || '-'}\n\n` +
          `FINALIDADE:\n${req.certidao_finalidade || '-'}\n\n` +
          `RESPONSÁVEIS:\n` +
          `• Responsável: ${req.certidao_responsavel?.nome || '-'} (${req.certidao_responsavel?.patente || '-'} - Mat: ${req.certidao_responsavel?.matricula || '-'})\n` +
          `• Gestor de RH: ${req.certidao_gestor_rh?.nome || '-'} (${req.certidao_gestor_rh?.patente || '-'} - Mat: ${req.certidao_gestor_rh?.matricula || '-'})\n\n` +
          `Justificativa:\n${req.descricao}`;
      }

      // 3. Map to RequestData
      const defaultDecenio = () => ({ qtdDias: "", bcg: "", dataBcg: "" });
      const licenca_especial = requesterData.licenca_especial || {};
      
      const rawTitle = req.tipo_descricao || (req.tipo ? TIPO_LABELS[req.tipo] : null) || req.tipo || 'REQUERIMENTO';
      const requestData = {
        requestTitle: String(rawTitle).toUpperCase(),
        comandante: dbConfig?.comandante || null,
        profile: {
          full_name: requesterData.nome_completo || requesterData.nome || req.nome_operador,
          war_name: requesterData.nome || req.nome_operador,
          registration: requesterData.matricula || req.matricula,
          phone: requesterData.telefone || "",
          email: requesterData.email_pm || "",
          rank: requesterData.rank || "",
          status: requesterData.status_funcional || requesterData.situacao_funcional || "",
          garrison: requesterData.garrison || "",
          unidade: requesterData.unidade || req.unidade || "5º BPM"
        },
        cpf: requesterData.cpf || "",
        rg: requesterData.rg || "",
        dataInclusao: requesterData.data_inclusao || "",
        doeInclusao: requesterData.doe_inclusao || "",
        dataDiario: requesterData.data_diario || "",
        pagina: requesterData.pagina || "",
        tempoServico: requesterData.tempo_servico || "",
        filiacao: requesterData.filiacao || "",
        pai: requesterData.pai || "",
        mae: requesterData.mae || "",
        naturalidade: requesterData.naturalidade || "",
        endereco: requesterData.endereco || "",
        dependentes: (requesterData.dependentes || []).map((dep: any, idx: number) => ({
          id: dep.id || String(idx),
          nome: dep.nome || dep.nome_completo || "",
          tipo: dep.tipo || dep.parentesco || "",
          dataNascimento: dep.dataNascimento || dep.data_nascimento || ""
        })),
        cursos: (requesterData.cursos || []).map((c: any, idx: number) => ({
          id: c.id || String(idx),
          curso: c.curso || c.nome || "",
          local: c.local || c.instituicao || "",
          ano: String(c.ano || c.conclusao || "")
        })),
        promocoes: (requesterData.promocoes || []).map((p: any, idx: number) => ({
          id: p.id || String(idx),
          postoGrad: p.postoGrad || p.posto_grad || p.patente || "",
          dataPromocao: p.dataPromocao || p.data_promocao || "",
          doe: p.doe || p.numero_doe || "",
          dataDoe: p.dataDoe || p.data_doe || ""
        })),
        licencaEspecial: {
          concessao: {
            primeiroDecenio: licenca_especial.concessao?.primeiroDecenio || defaultDecenio(),
            segundoDecenio: licenca_especial.concessao?.segundoDecenio || defaultDecenio(),
            terceiroDecenio: licenca_especial.concessao?.terceiroDecenio || defaultDecenio(),
          },
          fruicao: {
            primeiroDecenio: licenca_especial.fruicao?.primeiroDecenio || defaultDecenio(),
            segundoDecenio: licenca_especial.fruicao?.segundoDecenio || defaultDecenio(),
            terceiroDecenio: licenca_especial.fruicao?.terceiroDecenio || defaultDecenio(),
          }
        },
        justification: justificationText,
        amparoLegal: amparoLegal,
        incorporacao: requesterData.incorporacao || "",
        averbacao: (requesterData.averbacao || []).map((a: any, idx: number) => ({
          id: a.id || String(idx),
          tipo: a.tipo || "",
          nrCertidao: a.nrCertidao || a.numero_certidao || "",
          dataCertidao: a.dataCertidao || a.data_certidao || "",
          doe: a.doe || a.numero_doe || "",
          dataPublicacao: a.dataPublicacao || a.data_publicacao || "",
          totalDias: String(a.totalDias || a.total_dias || "0")
        })),
        deducao: (requesterData.deducao || []).map((d: any, idx: number) => ({
          id: d.id || String(idx),
          tipo: d.tipo || "",
          dataInicial: d.dataInicial || d.data_inicial || "",
          dataFinal: d.dataFinal || d.data_final || "",
          doe: d.doe || d.numero_doe || "",
          dataPublicacao: d.dataPublicacao || d.data_publicacao || ""
        })),
        licencaInteresseParticular: {
          sim: requesterData.licencaInteresseParticular?.sim || false,
          periodo: requesterData.licencaInteresseParticular?.periodo || ""
        },
        respondeProcesso: {
          sim: requesterData.respondeProcesso?.sim || false
        },
        condenacao: {
          sim: requesterData.condenacao?.sim || false,
          pena: requesterData.condenacao?.pena || ""
        }
      };

      // 4. Generate the PDF
      await generateRequestPdf(requestData);
      setSuccess("PDF oficial gerado e baixado com sucesso!");
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      console.error("Erro ao gerar PDF:", err);
      setError("Erro ao gerar PDF: " + err.message);
    } finally {
      setPdfLoadingId(null);
    }
  };

  useEffect(() => {
    if (!user) return;

    setIsLoading(true);
    let q;

    if (canManage) {
      // Admins see all requests
      q = query(
        collection(db, 'requerimentos'), 
        orderBy('created_at', 'desc')
      );
    } else {
      // Regular users only see their own requests
      q = query(
        collection(db, 'requerimentos'),
        where('created_by', '==', user.id),
        orderBy('created_at', 'desc')
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Requerimento));
      setRequerimentos(data);
      setIsLoading(false);
    }, (err) => {
      console.error("Erro ao buscar requerimentos:", err);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user, canManage]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!descricao.trim()) {
      setError("Por favor, preencha a justificativa/descrição do requerimento.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const activeProfile = selectedProfile || user;
      
      const newReq: any = {
        matricula: activeProfile.matricula,
        nome_operador: activeProfile.nome,
        unidade: activeProfile.unidade || 'SEM UNIDADE',
        tipo,
        tipo_descricao: TIPO_LABELS[tipo],
        descricao: descricao.trim(),
        status: 'PENDENTE' as const,
        created_by: activeProfile.id,
        created_at: new Date().toISOString()
      };

      if (amparoLegal) {
        newReq.amparo_legal = amparoLegal;
      }

      if ((tipo as string) === 'IDENTIDADE_FUNCIONAL' || tipo === 'identidade-funcional') {
        newReq.sexo = sexo;
        newReq.data_nascimento_req = dataNascimentoReq;
        newReq.fator_rh = fatorRh;
        newReq.situacao_funcional = situacaoFuncional;
        newReq.identidade_funcional = identidadeFuncional;
      } else if ((tipo as string) === 'CERTIDAO_TEMPO_CONTRIBUICAO' || tipo === 'certidao-tempo-contribuicao') {
        newReq.certidao_nivel_classe = certidaoNivelClasse;
        newReq.certidao_quadro = certidaoQuadro;
        newReq.certidao_municipio = certidaoMunicipio;
        newReq.certidao_orgao = certidaoOrgao;
        newReq.certidao_exercendo = certidaoExercendo;
        newReq.certidao_periodo_inicio = certidaoPeriodoInicio;
        newReq.certidao_periodo_fim = certidaoPeriodoFim;
        newReq.certidao_total_bruto = certidaoTotalBruto;
        newReq.certidao_averbacao = certidaoAverbacao;
        newReq.certidao_interrupcao = certidaoInterrupcao;
        newReq.certidao_faltas = certidaoFaltas;
        newReq.certidao_licencas = certidaoLicencas;
        newReq.certidao_suspensoes = certidaoSuspensoes;
        newReq.certidao_outros = certidaoOutros;
        newReq.certidao_soma = certidaoSoma;
        newReq.certidao_total_liquido = certidaoTotalLiquido;
        newReq.certidao_tempo_efetivo = certidaoTempoEfetivo;
        newReq.certidao_total_tempo_efetivo = certidaoTotalTempoEfetivo;
        newReq.certidao_finalidade = certidaoFinalidade;
        newReq.certidao_responsavel = {
          nome: certidaoResponsavelNome,
          patente: certidaoResponsavelPatente,
          funcao: certidaoResponsavelFuncao,
          matricula: certidaoResponsavelMatricula
        };
        newReq.certidao_gestor_rh = {
          nome: certidaoGestorRHNome,
          patente: certidaoGestorRHPatente,
          funcao: certidaoGestorRHFuncao,
          matricula: certidaoGestorRHMatricula
        };
      }

      await addDoc(collection(db, 'requerimentos'), newReq);
      
      await logAction(
        user.id,
        user.nome,
        'REQUERIMENTO_SUBMITTED',
        `Submeteu um requerimento do tipo ${TIPO_LABELS[tipo]}.`,
        { tipo }
      );

      setDescricao('');
      setIsAdding(false);
      setSuccess("Requerimento enviado com sucesso para análise do comando!");
      
      // Auto dismiss success
      setTimeout(() => setSuccess(null), 5000);
    } catch (err: any) {
      console.error("Erro ao salvar requerimento:", err);
      setError("Erro ao enviar requerimento: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAdminDecision = async (req: Requerimento, status: 'DEFERIDO' | 'INDEFERIDO') => {
    if (!user || !canManage) return;
    
    setActionLoadingId(req.id);
    try {
      const docRef = doc(db, 'requerimentos', req.id);
      const updateData = {
        status,
        resposta_admin: despacho.trim() || (status === 'DEFERIDO' ? 'Deferido conforme solicitação.' : 'Indeferido.'),
        analisado_por_nome: user.nome,
        analisado_por_id: user.id,
        analisado_em: new Date().toISOString()
      };

      await updateDoc(docRef, updateData);

      await logAction(
        user.id,
        user.nome,
        `REQUERIMENTO_${status}`,
        `${status === 'DEFERIDO' ? 'Deferiu' : 'Indeferiu'} o requerimento de ${req.nome_operador} (MAT: ${req.matricula}).`,
        { reqId: req.id, type: req.tipo }
      );

      setDespacho('');
      setExpandedId(null);
      setSuccess(`Requerimento de ${req.nome_operador} foi ${status === 'DEFERIDO' ? 'DEFERIDO' : 'INDEFERIDO'} com sucesso!`);
      setTimeout(() => setSuccess(null), 5000);
    } catch (err: any) {
      console.error("Erro ao despachar requerimento:", err);
      setError("Erro ao salvar despacho: " + err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDelete = async (reqId: string) => {
    if (!window.confirm("Tem certeza que deseja excluir este requerimento permanentemente?")) return;

    try {
      await deleteDoc(doc(db, 'requerimentos', reqId));
      setSuccess("Requerimento excluído com sucesso.");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error("Erro ao deletar requerimento:", err);
      setError("Erro ao excluir: " + err.message);
    }
  };

  const filteredList = requerimentos.filter(r => {
    if (statusFilter === 'TODOS') return true;
    return r.status === statusFilter;
  });

  return (
    <div className="space-y-6">
      {/* Alert Messages */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-red-700 animate-fade-in text-sm font-medium">
          <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-500" />
          <div>{error}</div>
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3 text-emerald-800 animate-fade-in text-sm font-medium">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5 text-emerald-500" />
          <div>{success}</div>
        </div>
      )}

      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white p-4 border border-navy-100 rounded-2xl shadow-sm">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-navy-600" />
          <span className="text-xs font-black text-navy-950 uppercase tracking-wider">Filtrar Status</span>
          <div className="flex bg-navy-50 p-1 rounded-xl gap-1">
            {(['TODOS', 'PENDENTE', 'DEFERIDO', 'INDEFERIDO'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                  statusFilter === status 
                    ? 'bg-navy-600 text-white shadow-sm' 
                    : 'text-navy-500 hover:text-navy-950'
                }`}
              >
                {status === 'TODOS' ? 'Todos' : status}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canManage && (
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="bg-white hover:bg-navy-50 text-navy-700 border border-navy-200 p-2.5 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-1.5"
              title="Ajustes de Requerimentos"
            >
              <Settings className="w-4 h-4 text-navy-600" />
              <span className="text-[10px] font-black uppercase tracking-wider hidden sm:inline">Ajustes</span>
            </button>
          )}

          {!isAdding && (
            <button
              onClick={() => {
                setIsAdding(true);
                setError(null);
                setSelectedProfile(user);
              }}
              className="bg-navy-600 hover:bg-navy-500 text-white px-5 py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Novo Requerimento
            </button>
          )}
        </div>
      </div>

      {/* New Request Form Modal/Collapsible */}
      {isAdding && (
        <div className="bg-white border border-navy-100 rounded-2xl shadow-lg p-6 space-y-6 animate-in slide-in-from-top duration-200">
          <div className="flex items-center justify-between border-b border-navy-50 pb-4">
            <div className="flex items-center gap-3">
              <div className="bg-navy-50 p-2.5 rounded-xl text-navy-600">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-black text-navy-950 uppercase tracking-tight">Formular Novo Requerimento</h4>
                <p className="text-[10px] text-navy-400 font-bold uppercase tracking-widest mt-0.5">Preencha sua petição oficial para o comando</p>
              </div>
            </div>
            <button 
              onClick={() => setIsAdding(false)}
              className="p-1.5 hover:bg-navy-50 text-navy-400 hover:text-navy-950 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Search User block for Admin */}
            {canManage && (
              <div className="bg-navy-50/50 border border-navy-100 rounded-2xl p-4 relative space-y-2">
                <label className="block text-[10px] font-black text-navy-900 uppercase tracking-widest">Buscar Policial Requerente (Admin)</label>
                <div className="relative">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setShowUserDropdown(true);
                    }}
                    onFocus={() => setShowUserDropdown(true)}
                    placeholder="Digite o nome, nome de guerra ou matrícula do policial..."
                    className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 placeholder-navy-300 focus:ring-1 focus:ring-navy-500 outline-none transition-all"
                  />
                  {showUserDropdown && searchTerm && (
                    <div className="absolute left-0 right-0 mt-1 bg-white border border-navy-100 rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto">
                      {allUsers
                        .filter(u => 
                          u.nome?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          u.nome_completo?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          u.matricula?.toLowerCase().includes(searchTerm.toLowerCase())
                        )
                        .map(u => (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => {
                              setSelectedProfile(u);
                              setSearchTerm(u.nome || u.nome_completo || '');
                              setShowUserDropdown(false);
                            }}
                            className="w-full text-left px-4 py-3 hover:bg-navy-50 flex items-center justify-between border-b border-navy-50/50 last:border-0"
                          >
                            <div className="min-w-0">
                              <p className="text-xs font-black text-navy-950 uppercase">{u.nome_completo || u.nome}</p>
                              <p className="text-[10px] font-bold text-navy-400 uppercase mt-0.5">MAT: {u.matricula} • {u.rank || 'Policial'}</p>
                            </div>
                            <span className="text-[8px] font-black bg-navy-100 text-navy-600 px-2 py-1 rounded uppercase tracking-wider">{u.unidade || '5º BPM'}</span>
                          </button>
                        ))
                      }
                      {allUsers.filter(u => 
                        u.nome?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        u.nome_completo?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        u.matricula?.toLowerCase().includes(searchTerm.toLowerCase())
                      ).length === 0 && (
                        <div className="p-4 text-center text-navy-400 text-xs font-semibold">Nenhum policial encontrado</div>
                      )}
                    </div>
                  )}
                </div>
                {selectedProfile && (
                  <div className="flex items-center justify-between bg-white px-4 py-2.5 rounded-xl border border-navy-100 mt-2">
                    <div>
                      <p className="text-xs font-black text-navy-950 uppercase">{selectedProfile.nome_completo || selectedProfile.nome}</p>
                      <p className="text-[9px] font-bold text-navy-400 uppercase mt-0.5">MAT: {selectedProfile.matricula} • Unidade: {selectedProfile.unidade || '5º BPM'}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedProfile(user);
                        setSearchTerm('');
                      }}
                      className="text-[9px] font-black text-rose-500 hover:text-rose-600 uppercase tracking-widest"
                    >
                      Remover
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Read-Only Profile details */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
              <div>
                <label className="block text-[9px] font-black text-navy-500 uppercase tracking-widest mb-1.5">Matrícula</label>
                <input 
                  type="text" 
                  value={selectedProfile?.matricula || ''} 
                  disabled 
                  className="w-full bg-navy-50/50 border border-navy-100 rounded-xl px-4 py-3 text-xs text-navy-700 font-bold uppercase"
                />
              </div>
              <div>
                <label className="block text-[9px] font-black text-navy-500 uppercase tracking-widest mb-1.5">Requerente</label>
                <input 
                  type="text" 
                  value={selectedProfile?.nome_completo || selectedProfile?.nome || ''} 
                  disabled 
                  className="w-full bg-navy-50/50 border border-navy-100 rounded-xl px-4 py-3 text-xs text-navy-700 font-bold uppercase"
                />
              </div>
              <div>
                <label className="block text-[9px] font-black text-navy-500 uppercase tracking-widest mb-1.5">Unidade</label>
                <input 
                  type="text" 
                  value={selectedProfile?.unidade || 'SEM UNIDADE'} 
                  disabled 
                  className="w-full bg-navy-50/50 border border-navy-100 rounded-xl px-4 py-3 text-xs text-navy-700 font-bold uppercase"
                />
              </div>
            </div>

            <div>
              <label className="block text-[9px] font-black text-navy-500 uppercase tracking-widest mb-1.5">Natureza do Requerimento</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {(Object.keys(TIPO_LABELS) as RequerimentoTipo[]).map((key) => {
                  const IconComp = TIPO_ICONS[key] || FileText;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        if (key !== 'OUTROS') {
                          const targetUserId = selectedProfile?.id || user?.id;
                          if (targetUserId && targetUserId !== user?.id) {
                            navigate(`/requerimentos/${key}?userId=${targetUserId}`);
                          } else {
                            navigate(`/requerimentos/${key}`);
                          }
                        } else {
                          setTipo(key);
                        }
                      }}
                      className={`border p-3 rounded-xl text-left transition-all flex items-start gap-2.5 min-h-[70px] ${
                        tipo === key
                          ? 'border-navy-600 bg-navy-50/40 shadow-sm ring-1 ring-navy-500'
                          : 'border-navy-100 bg-white hover:bg-navy-50/20'
                      }`}
                    >
                      <div className={`p-1.5 rounded-lg flex-shrink-0 mt-0.5 ${tipo === key ? 'bg-navy-100 text-navy-900' : 'bg-navy-50 text-navy-600'}`}>
                        <IconComp className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex flex-col justify-between h-full min-w-0">
                        <span className="text-[9.5px] font-black text-navy-950 uppercase tracking-tight line-clamp-2 leading-tight">{TIPO_LABELS[key]}</span>
                        <span className="text-[7.5px] font-black text-navy-400 uppercase tracking-wider mt-1">SELECIONAR</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Identidade Funcional custom fields */}
            {((tipo as string) === 'IDENTIDADE_FUNCIONAL' || tipo === 'identidade-funcional') && (
              <div className="bg-navy-50/30 border border-navy-100 rounded-2xl p-5 space-y-4">
                <h5 className="text-[11px] font-black text-navy-950 uppercase tracking-wider border-b border-navy-100 pb-2">Campos Específicos para Identidade Funcional</h5>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[9px] font-black text-navy-500 uppercase tracking-widest mb-1.5">Sexo</label>
                    <select
                      value={sexo}
                      onChange={(e) => setSexo(e.target.value)}
                      className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 outline-none transition-all"
                    >
                      <option value="">Selecione...</option>
                      <option value="Masculino">Masculino</option>
                      <option value="Feminino">Feminino</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-navy-500 uppercase tracking-widest mb-1.5">Data de Nascimento</label>
                    <input
                      type="date"
                      value={dataNascimentoReq}
                      onChange={(e) => setDataNascimentoReq(e.target.value)}
                      className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-navy-500 uppercase tracking-widest mb-1.5">Fator RH</label>
                    <input
                      type="text"
                      value={fatorRh}
                      onChange={(e) => setFatorRh(e.target.value)}
                      placeholder="Ex: O+, AB-"
                      className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 placeholder-navy-300 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-navy-500 uppercase tracking-widest mb-1.5">Situação Funcional</label>
                    <input
                      type="text"
                      value={situacaoFuncional}
                      onChange={(e) => setSituacaoFuncional(e.target.value)}
                      placeholder="Ex: Ativo, Reserva"
                      className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 placeholder-navy-300 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-navy-500 uppercase tracking-widest mb-1.5">N° Identidade Funcional</label>
                    <input
                      type="text"
                      value={identidadeFuncional}
                      onChange={(e) => setIdentidadeFuncional(e.target.value)}
                      placeholder="Ex: 123456-7"
                      className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 placeholder-navy-300 outline-none transition-all"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Certidão Tempo de Contribuição custom fields */}
            {((tipo as string) === 'CERTIDAO_TEMPO_CONTRIBUICAO' || tipo === 'certidao-tempo-contribuicao') && (
              <div className="bg-navy-50/30 border border-navy-100 rounded-2xl p-5 space-y-4">
                <h5 className="text-[11px] font-black text-navy-950 uppercase tracking-wider border-b border-navy-100 pb-2">Campos Específicos para Certidão de Tempo de Contribuição</h5>
                
                {/* Seção 1: Dados Funcionais */}
                <div className="space-y-3">
                  <h6 className="text-[9px] font-black text-navy-400 uppercase tracking-widest">1. Dados Funcionais do Cargo</h6>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[9px] font-black text-navy-500 uppercase tracking-widest mb-1.5">Nível / Classe / Referência</label>
                      <input
                        type="text"
                        value={certidaoNivelClasse}
                        onChange={(e) => setCertidaoNivelClasse(e.target.value)}
                        placeholder="Ex: Soldado, Cabo"
                        className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 placeholder-navy-300 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-black text-navy-500 uppercase tracking-widest mb-1.5">Quadro</label>
                      <input
                        type="text"
                        value={certidaoQuadro}
                        onChange={(e) => setCertidaoQuadro(e.target.value)}
                        placeholder="Ex: Permanente"
                        className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 placeholder-navy-300 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-black text-navy-500 uppercase tracking-widest mb-1.5">Município de Exercício</label>
                      <input
                        type="text"
                        value={certidaoMunicipio}
                        onChange={(e) => setCertidaoMunicipio(e.target.value)}
                        placeholder="Ex: Porto Velho"
                        className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 placeholder-navy-300 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-black text-navy-500 uppercase tracking-widest mb-1.5">Órgão Expedidor</label>
                      <input
                        type="text"
                        value={certidaoOrgao}
                        onChange={(e) => setCertidaoOrgao(e.target.value)}
                        placeholder="Ex: Polícia Militar"
                        className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 placeholder-navy-300 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-black text-navy-500 uppercase tracking-widest mb-1.5">Cargo Exercendo no Momento</label>
                      <input
                        type="text"
                        value={certidaoExercendo}
                        onChange={(e) => setCertidaoExercendo(e.target.value)}
                        placeholder="Ex: Policial Militar Ativo"
                        className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 placeholder-navy-300 outline-none transition-all"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2 col-span-1 md:col-span-1">
                      <div>
                        <label className="block text-[9px] font-black text-navy-500 uppercase tracking-widest mb-1.5">Período Início</label>
                        <input
                          type="date"
                          value={certidaoPeriodoInicio}
                          onChange={(e) => setCertidaoPeriodoInicio(e.target.value)}
                          className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-2 py-3 text-[11px] font-semibold text-navy-950 outline-none transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-black text-navy-500 uppercase tracking-widest mb-1.5">Período Fim</label>
                        <input
                          type="date"
                          value={certidaoPeriodoFim}
                          onChange={(e) => setCertidaoPeriodoFim(e.target.value)}
                          className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-2 py-3 text-[11px] font-semibold text-navy-950 outline-none transition-all"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Seção 2: Demonstrativo de Frequência */}
                <div className="space-y-3 pt-2 border-t border-navy-100">
                  <h6 className="text-[9px] font-black text-navy-400 uppercase tracking-widest">2. Demonstrativo de Frequência (Dias)</h6>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[8px] font-black text-navy-500 uppercase tracking-widest mb-1">Total Bruto</label>
                      <input
                        type="text"
                        value={certidaoTotalBruto}
                        onChange={(e) => setCertidaoTotalBruto(e.target.value)}
                        placeholder="Ex: 3650"
                        className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-3 py-2 text-xs font-semibold text-navy-950 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[8px] font-black text-navy-500 uppercase tracking-widest mb-1">Averbação</label>
                      <input
                        type="text"
                        value={certidaoAverbacao}
                        onChange={(e) => setCertidaoAverbacao(e.target.value)}
                        placeholder="Ex: 0"
                        className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-3 py-2 text-xs font-semibold text-navy-950 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[8px] font-black text-navy-500 uppercase tracking-widest mb-1">Interrupção</label>
                      <input
                        type="text"
                        value={certidaoInterrupcao}
                        onChange={(e) => setCertidaoInterrupcao(e.target.value)}
                        placeholder="Ex: 0"
                        className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-3 py-2 text-xs font-semibold text-navy-950 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[8px] font-black text-navy-500 uppercase tracking-widest mb-1">Faltas</label>
                      <input
                        type="text"
                        value={certidaoFaltas}
                        onChange={(e) => setCertidaoFaltas(e.target.value)}
                        placeholder="Ex: 0"
                        className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-3 py-2 text-xs font-semibold text-navy-950 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[8px] font-black text-navy-500 uppercase tracking-widest mb-1">Licenças s/ Venc.</label>
                      <input
                        type="text"
                        value={certidaoLicencas}
                        onChange={(e) => setCertidaoLicencas(e.target.value)}
                        placeholder="Ex: 0"
                        className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-3 py-2 text-xs font-semibold text-navy-950 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[8px] font-black text-navy-500 uppercase tracking-widest mb-1">Suspensões</label>
                      <input
                        type="text"
                        value={certidaoSuspensoes}
                        onChange={(e) => setCertidaoSuspensoes(e.target.value)}
                        placeholder="Ex: 0"
                        className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-3 py-2 text-xs font-semibold text-navy-950 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[8px] font-black text-navy-500 uppercase tracking-widest mb-1">Outras Deduções</label>
                      <input
                        type="text"
                        value={certidaoOutros}
                        onChange={(e) => setCertidaoOutros(e.target.value)}
                        placeholder="Ex: 0"
                        className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-3 py-2 text-xs font-semibold text-navy-950 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[8px] font-black text-navy-500 uppercase tracking-widest mb-1">Soma das Deduções</label>
                      <input
                        type="text"
                        value={certidaoSoma}
                        onChange={(e) => setCertidaoSoma(e.target.value)}
                        placeholder="Ex: 0"
                        className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-3 py-2 text-xs font-semibold text-navy-950 outline-none transition-all"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[8px] font-black text-navy-500 uppercase tracking-widest mb-1">Total Líquido de Contribuição</label>
                      <input
                        type="text"
                        value={certidaoTotalLiquido}
                        onChange={(e) => setCertidaoTotalLiquido(e.target.value)}
                        placeholder="Ex: 3650 dias"
                        className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-3 py-2 text-xs font-semibold text-navy-950 outline-none transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* Seção 3: Tempo de Efetivo Exercício */}
                <div className="space-y-3 pt-2 border-t border-navy-100">
                  <h6 className="text-[9px] font-black text-navy-400 uppercase tracking-widest">3. Tempo de Efetivo Exercício</h6>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[9px] font-black text-navy-500 uppercase tracking-widest mb-1.5">Tempo como Militar Estadual (Dias)</label>
                      <input
                        type="text"
                        value={certidaoTempoEfetivo}
                        onChange={(e) => setCertidaoTempoEfetivo(e.target.value)}
                        placeholder="Ex: 3650"
                        className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-black text-navy-500 uppercase tracking-widest mb-1.5">Total Geral de Tempo de Efetivo Exercício</label>
                      <input
                        type="text"
                        value={certidaoTotalTempoEfetivo}
                        onChange={(e) => setCertidaoTotalTempoEfetivo(e.target.value)}
                        placeholder="Ex: 3650 dias"
                        className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 outline-none transition-all"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-navy-500 uppercase tracking-widest mb-1.5">Destinação / Finalidade da Certidão</label>
                    <input
                      type="text"
                      value={certidaoFinalidade}
                      onChange={(e) => setCertidaoFinalidade(e.target.value)}
                      placeholder="Ex: FINS DE INSTRUÇÃO DE APOSENTADORIA / RESERVA..."
                      className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Seção 4: Responsáveis */}
                <div className="space-y-3 pt-2 border-t border-navy-100">
                  <h6 className="text-[9px] font-black text-navy-400 uppercase tracking-widest">4. Assinaturas e Responsáveis pela Emissão</h6>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Responsável */}
                    <div className="bg-white p-3 rounded-xl border border-navy-100 space-y-2">
                      <p className="text-[8px] font-black text-navy-500 uppercase tracking-widest">Responsável pela Confecção</p>
                      <input
                        type="text"
                        value={certidaoResponsavelNome}
                        onChange={(e) => setCertidaoResponsavelNome(e.target.value)}
                        placeholder="Nome Completo"
                        className="w-full bg-navy-50/50 border border-navy-100 rounded-lg px-3 py-2 text-xs font-semibold outline-none focus:bg-white"
                      />
                      <div className="grid grid-cols-3 gap-1">
                        <input
                          type="text"
                          value={certidaoResponsavelPatente}
                          onChange={(e) => setCertidaoResponsavelPatente(e.target.value)}
                          placeholder="Posto/Grad"
                          className="w-full bg-navy-50/50 border border-navy-100 rounded-lg px-2 py-2 text-[10px] font-semibold outline-none focus:bg-white"
                        />
                        <input
                          type="text"
                          value={certidaoResponsavelFuncao}
                          onChange={(e) => setCertidaoResponsavelFuncao(e.target.value)}
                          placeholder="Função"
                          className="w-full bg-navy-50/50 border border-navy-100 rounded-lg px-2 py-2 text-[10px] font-semibold outline-none focus:bg-white"
                        />
                        <input
                          type="text"
                          value={certidaoResponsavelMatricula}
                          onChange={(e) => setCertidaoResponsavelMatricula(e.target.value)}
                          placeholder="Matrícula"
                          className="w-full bg-navy-50/50 border border-navy-100 rounded-lg px-2 py-2 text-[10px] font-semibold outline-none focus:bg-white"
                        />
                      </div>
                    </div>

                    {/* Gestor RH */}
                    <div className="bg-white p-3 rounded-xl border border-navy-100 space-y-2">
                      <p className="text-[8px] font-black text-navy-500 uppercase tracking-widest">Gestor de Recursos Humanos</p>
                      <input
                        type="text"
                        value={certidaoGestorRHNome}
                        onChange={(e) => setCertidaoGestorRHNome(e.target.value)}
                        placeholder="Nome Completo"
                        className="w-full bg-navy-50/50 border border-navy-100 rounded-lg px-3 py-2 text-xs font-semibold outline-none focus:bg-white"
                      />
                      <div className="grid grid-cols-3 gap-1">
                        <input
                          type="text"
                          value={certidaoGestorRHPatente}
                          onChange={(e) => setCertidaoGestorRHPatente(e.target.value)}
                          placeholder="Posto/Grad"
                          className="w-full bg-navy-50/50 border border-navy-100 rounded-lg px-2 py-2 text-[10px] font-semibold outline-none focus:bg-white"
                        />
                        <input
                          type="text"
                          value={certidaoGestorRHFuncao}
                          onChange={(e) => setCertidaoGestorRHFuncao(e.target.value)}
                          placeholder="Função"
                          className="w-full bg-navy-50/50 border border-navy-100 rounded-lg px-2 py-2 text-[10px] font-semibold outline-none focus:bg-white"
                        />
                        <input
                          type="text"
                          value={certidaoGestorRHMatricula}
                          onChange={(e) => setCertidaoGestorRHMatricula(e.target.value)}
                          placeholder="Matrícula"
                          className="w-full bg-navy-50/50 border border-navy-100 rounded-lg px-2 py-2 text-[10px] font-semibold outline-none focus:bg-white"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {getTemplatesForType(tipo).length > 0 && (
              <div>
                <label className="block text-[9px] font-black text-navy-500 uppercase tracking-widest mb-1.5">Escolher Modelo de Solicitação</label>
                <select
                  value={selectedSolicitacaoLabel}
                  onChange={(e) => {
                    const solLabel = e.target.value;
                    setSelectedSolicitacaoLabel(solLabel);
                    const found = getTemplatesForType(tipo).find(s => s.label === solLabel);
                    if (found) {
                      setDescricao(found.text);
                      setAmparoLegal(found.amparo || '');
                    }
                  }}
                  className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 outline-none transition-all"
                >
                  {getTemplatesForType(tipo).map((s) => (
                    <option key={s.label} value={s.label}>{s.label}</option>
                  ))}
                  <option value="CUSTOM">Escrever Texto Personalizado...</option>
                </select>
              </div>
            )}

            <div>
              <label className="block text-[9px] font-black text-navy-500 uppercase tracking-widest mb-1.5">Amparo Legal da Solicitação</label>
              <input
                type="text"
                value={amparoLegal}
                onChange={(e) => setAmparoLegal(e.target.value)}
                placeholder="Ex: Art. 5º, Inciso XXXIV, alínea 'a' da Constituição Federal de 1988."
                className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 placeholder-navy-300 outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-[9px] font-black text-navy-500 uppercase tracking-widest mb-1.5">Justificativa e Detalhes do Pedido</label>
              <textarea
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Explicite detalhadamente as razões de fato e de direito do seu pedido, informando datas de início e fim, períodos pretéritos e anexando referências cabíveis se houver..."
                rows={6}
                className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-2xl p-4 text-xs font-semibold text-navy-950 placeholder-navy-300 focus:ring-1 focus:ring-navy-500 outline-none transition-all"
              />
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-5 py-3 bg-navy-50 hover:bg-navy-100 text-navy-900 font-black rounded-xl uppercase text-[10px] tracking-widest border border-navy-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-3 bg-navy-600 hover:bg-navy-500 text-white font-black rounded-xl uppercase text-[10px] tracking-widest shadow-lg shadow-navy-600/15 flex items-center justify-center gap-1.5 transition-all active:scale-95"
              >
                {isSubmitting ? (
                  <>
                    <i className="fas fa-spinner fa-spin"></i>
                    <span>Enviando...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Enviar Requerimento</span>
                  </>
                )
                }
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Main Request list */}
      <div className="space-y-3.5">
        {isLoading ? (
          <div className="py-20 text-center bg-white border border-navy-100 rounded-2xl">
            <FileClock className="w-8 h-8 text-navy-600 mb-4 animate-pulse mx-auto" />
            <p className="text-navy-400 font-black uppercase text-[10px] tracking-widest">CARREGANDO REQUERIMENTOS...</p>
          </div>
        ) : filteredList.length === 0 ? (
          <div className="py-16 text-center bg-white border border-navy-100 rounded-2xl p-6">
            <AlertCircle className="w-10 h-10 text-navy-300 mb-3 mx-auto" />
            <h5 className="text-sm font-black text-navy-950 uppercase">Nenhum Requerimento Encontrado</h5>
            <p className="text-[10px] text-navy-400 font-bold uppercase tracking-widest mt-1">Não há registros correspondentes ao filtro selecionado.</p>
          </div>
        ) : (
          filteredList.map((req) => {
            const isExpanded = expandedId === req.id;
            return (
              <div 
                key={req.id} 
                className={`bg-white border rounded-2xl shadow-sm transition-all duration-200 overflow-hidden ${
                  isExpanded ? 'border-navy-300 ring-1 ring-navy-200' : 'border-navy-100 hover:border-navy-200 hover:shadow-md'
                }`}
              >
                {/* Header Block */}
                <div 
                  onClick={() => {
                    setExpandedId(isExpanded ? null : req.id);
                    setDespacho('');
                  }}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer select-none"
                >
                  <div className="flex items-start gap-4 min-w-0">
                    <div className={`p-2.5 rounded-xl border flex-shrink-0 flex items-center justify-center ${TIPO_COLORS[req.tipo]}`}>
                      {(() => {
                        const IconComp = TIPO_ICONS[req.tipo] || FileText;
                        return <IconComp className="w-5 h-5" />;
                      })()}
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-xs font-black text-navy-950 uppercase tracking-tight">{req.tipo_descricao || TIPO_LABELS[req.tipo] || req.tipo}</span>
                        <span className="text-[8px] font-bold text-navy-400 uppercase tracking-wider">
                          Enviado em {new Date(req.created_at).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                      
                      {canManage && (
                        <p className="text-navy-500 font-black text-[10px] uppercase truncate mt-1">
                          Requerente: {req.nome_operador} <span className="text-navy-300 font-bold">|</span> MAT: {req.matricula} <span className="text-navy-300 font-bold">|</span> Unidade: {req.unidade}
                        </p>
                      )}

                      {!canManage && (
                        <p className="text-navy-400 font-semibold text-[10px] uppercase truncate mt-1">
                          Protocolo do Policial: {req.id.substring(0, 8).toUpperCase()}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 self-stretch sm:self-center">
                    {/* Status Badge */}
                    <span className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider ${
                      req.status === 'PENDENTE' ? 'bg-amber-100 text-amber-700' :
                      req.status === 'DEFERIDO' ? 'bg-emerald-100 text-emerald-700' :
                      'bg-rose-100 text-rose-700'
                    }`}>
                      {req.status}
                    </span>

                    <div className="flex items-center gap-1.5 text-navy-400">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>
                </div>

                {/* Expanded Details Panel */}
                {isExpanded && (
                  <div className="border-t border-navy-50 bg-navy-50/10 p-5 sm:p-6 space-y-6 animate-in slide-in-from-top-1 duration-200">
                    {/* PDF Document Generation Actions */}
                    <div className="flex items-center justify-between bg-white border border-navy-100 rounded-2xl p-4 shadow-sm">
                      <div>
                        <h6 className="text-[10px] font-black text-navy-950 uppercase tracking-tight">Documento Oficial de Requerimento</h6>
                        <p className="text-[8px] text-navy-400 font-bold uppercase tracking-widest mt-0.5">Gerar o arquivo PDF formatado para impressão</p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadPdf(req);
                        }}
                        disabled={pdfLoadingId === req.id}
                        className="bg-navy-600 hover:bg-navy-500 disabled:bg-navy-300 text-white px-4 py-2.5 rounded-xl font-black uppercase text-[9px] tracking-wider transition-all active:scale-95 flex items-center gap-1.5 shadow-sm"
                      >
                        {pdfLoadingId === req.id ? (
                          <>
                            <i className="fas fa-spinner fa-spin"></i>
                            <span>Gerando PDF...</span>
                          </>
                        ) : (
                          <>
                            <i className="fas fa-file-pdf"></i>
                            <span>Gerar PDF Oficial</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* The Request body */}
                    <div className="space-y-2">
                      <h6 className="text-[9px] font-black text-navy-400 uppercase tracking-widest">Justificativa do Policial</h6>
                      <div className="bg-white border border-navy-100 rounded-2xl p-4 text-xs font-medium text-navy-900 whitespace-pre-line leading-relaxed">
                        {req.descricao}
                      </div>
                    </div>

                    {/* Decision response or Despacho */}
                    {req.status !== 'PENDENTE' ? (
                      <div className="space-y-2">
                        <h6 className="text-[9px] font-black text-navy-400 uppercase tracking-widest flex items-center gap-1.5">
                          Despacho do Comando
                          {req.status === 'DEFERIDO' ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <X className="w-3.5 h-3.5 text-rose-600" />
                          )}
                        </h6>
                        <div className={`border p-5 rounded-2xl text-xs space-y-3 ${
                          req.status === 'DEFERIDO' 
                            ? 'bg-emerald-50/30 border-emerald-100 text-emerald-950' 
                            : 'bg-rose-50/30 border-rose-100 text-rose-950'
                        }`}>
                          <p className="font-bold whitespace-pre-line leading-relaxed">
                            {req.resposta_admin || 'Nenhuma justificativa formal informada.'}
                          </p>
                          <div className="flex flex-wrap items-center justify-between text-[9px] font-black text-navy-400 uppercase tracking-wider pt-2 border-t border-navy-100/50">
                            <span>Despachado por: {req.analisado_por_nome}</span>
                            <span>Data: {req.analisado_em ? new Date(req.analisado_em).toLocaleDateString('pt-BR') : 'N/D'}</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* If PENDING, show administrative workspace or message */
                      canManage ? (
                        <div className="bg-amber-50/30 border border-amber-100 rounded-2xl p-5 space-y-4">
                          <div className="flex items-center gap-2 text-amber-800">
                            <AlertCircle className="w-4 h-4 text-amber-600" />
                            <h6 className="text-[10px] font-black uppercase tracking-wider">Despachar Requerimento</h6>
                          </div>

                          <div className="space-y-3">
                            <label className="block text-[9px] font-black text-navy-500 uppercase tracking-widest">
                              Resposta Oficial do Comando
                            </label>
                            <textarea
                              value={despacho}
                              onChange={(e) => setDespacho(e.target.value)}
                              placeholder="Insira o texto oficial de aprovação ou rejeição do requerimento..."
                              rows={3}
                              className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl p-3.5 text-xs font-semibold text-navy-950 focus:ring-1 focus:ring-navy-500 outline-none"
                            />

                            <div className="flex gap-3 justify-end">
                              <button
                                type="button"
                                onClick={() => handleAdminDecision(req, 'INDEFERIRO' as any === 'INDEFERIRO' ? 'INDEFERIDO' : 'INDEFERIDO')}
                                disabled={actionLoadingId !== null}
                                className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-black rounded-xl uppercase text-[9px] tracking-wider transition-all flex items-center gap-1.5"
                              >
                                {actionLoadingId === req.id ? <i className="fas fa-spinner fa-spin"></i> : <XCircle className="w-4 h-4" />}
                                Indeferir Pedido
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAdminDecision(req, 'DEFERIDO')}
                                disabled={actionLoadingId !== null}
                                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl uppercase text-[9px] tracking-wider transition-all flex items-center gap-1.5"
                              >
                                {actionLoadingId === req.id ? <i className="fas fa-spinner fa-spin"></i> : <CheckCircle2 className="w-4 h-4" />}
                                Deferir Pedido
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 bg-amber-50/40 border border-amber-100 rounded-xl flex items-center gap-2.5 text-amber-800 text-[10px] font-bold uppercase tracking-wider">
                          <FileClock className="w-4 h-4 text-amber-500" />
                          <span>Este requerimento está aguardando decisão oficial do comando administrativo da PM.</span>
                        </div>
                      )
                    )}

                    {/* Operator/Admin can delete pending request */}
                    {((!canManage && req.status === 'PENDENTE') || canManage) && (
                      <div className="flex justify-end pt-2 border-t border-navy-50">
                        <button
                          type="button"
                          onClick={() => handleDelete(req.id)}
                          className="text-red-500 hover:text-red-700 flex items-center gap-1 text-[9px] font-black uppercase tracking-wider"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Excluir Registro
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {isSettingsOpen && (
        <RequerimentosSettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          onSaveSuccess={loadConfig}
          currentUser={user}
        />
      )}
    </div>
  );
};
