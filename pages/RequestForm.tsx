import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  ArrowLeft, Save, User, Search, X, ChevronDown, ChevronUp, Send, FileText, 
  Trash2, AlertCircle, ShieldAlert, Check, CheckCircle2, ChevronRight
} from 'lucide-react';
import { db, logAction } from '../firebase';
import { 
  collection, doc, getDoc, getDocs, addDoc, query, where, limit
} from 'firebase/firestore';
import { generateRequestPdf } from '../utils/pdfGenerator';
import { User as AppUser, UserRole } from '../types';

const requestTypesMap: Record<string, string> = {
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
};

const PREDEFINED_SOLICITACOES: Record<string, Array<{ label: string; text: string; amparo?: string }>> = {
  'acesso-sistemas': [
    {
      label: 'Solicitação de Acesso a Sistemas Corporativos',
      text: 'REQUER a Vossa Senhoria se digne conceder autorização de acesso e criação de credenciais para os sistemas corporativos de segurança pública e de gestão de dados institucionais, para fins de desempenho das funções regulamentares.',
      amparo: "Art. 5º, Inciso XXXIV, alínea 'a' da Constituição Federal de 1988."
    }
  ],
  'ajuda-custo': [
    {
      label: 'Concessão de Ajuda de Custo para Movimentação',
      text: 'REQUER a concessão de ajuda de custo, correspondente a uma remuneração integral, em virtude de ter sido movimentado por necessidade do serviço policial militar para outra localidade, visando cobrir as despesas de viagem e instalação.',
      amparo: 'Art. 52, da Lei de Remuneração dos Militares Estaduais.'
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
      label: 'Concessão de Auxílio Fardamento',
      text: 'REQUER o pagamento do Auxílio Fardamento, conforme previsto na legislação remuneratória, tendo em vista o cumprimento do interstício regulamentar para aquisição de novos uniformes.',
      amparo: 'Art. 58, da Lei de Remuneração dos Militares Estaduais.'
    }
  ],
  'averbacao-ficha-oficial': [
    {
      label: 'Averbação de Histórico em Ficha Individual',
      text: 'REQUER a averbação em sua Ficha de Assentamentos Individuais de elogios, condecorações ou cursos realizados com aproveitamento, conforme publicações oficiais anexadas.',
      amparo: 'Regulamento Geral da Polícia Militar.'
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
      label: 'Averbação de Tempo de Serviço Militar Anterior',
      text: 'REQUER a averbação de tempo de serviço prestado às Forças Armadas (Exército, Marinha ou Aeronáutica), correspondente ao período de [DATA_INICIO] a [DATA_FIM], totalizando [DIAS] dias.',
      amparo: 'Art. 132, da Lei Complementar nº 053/1990.'
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
      label: 'Designação para Função de Confiança / Comando',
      text: 'REQUER a designação formal para exercer a função de [NOME DA FUNÇÃO] na unidade [UNIDADE], visando a regularização de suas atribuições administrativas e operacionais.',
      amparo: 'Regulamento de Administração da Polícia Militar.'
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
      label: 'Inclusão de Dependentes no Cadastro Familiar',
      text: 'REQUER a inclusão de seu dependente [NOME_DEPENDENTE], na qualidade de [GRAU_PARENTESCO], nas folhas de assentamentos individuais e para fins de assistência médica e previdenciária, anexando certidão oficial.',
      amparo: 'Art. 142, da Lei Complementar nº 053, de 30 de agosto de 1990.'
    }
  ],
  'licenciamento-pedido': [
    {
      label: 'Licenciamento a Pedido das Fileiras da PM',
      text: 'REQUER a Vossa Senhoria se digne conceder seu Licenciamento a Pedido das fileiras desta valorosa Corporação, por motivos de ordem particular, com fulcro na legislação de pessoal vigente.',
      amparo: 'Art. 115, da Lei Complementar nº 053/1990.'
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
      label: 'Progressão Funcional por Tempo de Serviço',
      text: 'REQUER a concessão de progressão funcional / promoção por tempo de serviço na carreira militar estadual, correspondente ao interstício completado na data de [DATA].',
      amparo: 'Estatuto dos Policiais Militares.'
    }
  ],
  'regularizacao-ferias': [
    {
      label: 'Regularização de Período de Férias Acumuladas',
      text: 'REQUER a regularização de períodos de férias regulamentares acumuladas e não gozadas, referentes aos períodos aquisitivos pendentes, conforme cronograma administrativo.',
      amparo: 'Art. 61, da Lei Complementar nº 053/1990.'
    }
  ],
  'reserva-remunerada': [
    {
      label: 'Transferência para a Reserva Remunerada Integral a Pedido',
      text: 'REQUER a Vossa Senhoria se digne conceder a sua transferência para a Reserva Remunerada, nos termos da legislação previdenciária dos militares estaduais vigentes, por ter completado o tempo de serviço necessário.',
      amparo: 'Lei Complementar Estadual de Previdência e Estatuto dos Policiais Militares.'
    }
  ],
  'ressarcimento-promocao': [
    {
      label: 'Ressarcimento de Preterição em Promoção',
      text: 'REQUER o ressarcimento administrativo de promoção ao posto/graduação devido, retroagindo os efeitos financeiros e de antiguidade à data em que o direito foi constituído.',
      amparo: 'Lei de Promoções de Oficiais e Praças.'
    }
  ],
  'transferencia-interesse-proprio': [
    {
      label: 'Transferência de Unidade por Interesse Próprio',
      text: 'REQUER a sua transferência da unidade atual [UNIDADE_ATUAL] para a unidade [UNIDADE_DESTINO], por motivos de conveniência pessoal e familiar, correndo por sua conta as despesas decorrentes.',
      amparo: 'Regulamento de Movimentação da Polícia Militar.'
    }
  ]
};

interface RequestFormProps {
  user: AppUser | null;
}

export default function RequestForm({ user }: RequestFormProps) {
  const { typeId } = useParams<{ typeId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isAdmin = user?.role === UserRole.ADMIN;
  const isMaster = user?.role === UserRole.MASTER;
  const canSearchUsers = isAdmin || isMaster;

  // Get userId from URL query param if present
  const urlUserId = searchParams.get('userId');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(urlUserId);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchProfiles, setSearchProfiles] = useState<AppUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [profile, setProfile] = useState<any>(null);
  const [justification, setJustification] = useState('');
  const [amparoLegal, setAmparoLegal] = useState('');
  const [solicitacoesOptions, setSolicitacoesOptions] = useState<Array<{ label: string; text: string; amparo?: string }>>([]);
  const [selectedSolicitacaoLabel, setSelectedSolicitacaoLabel] = useState<string>('');
  
  // Form fields
  const [cpf, setCpf] = useState('');
  const [rg, setRg] = useState('');
  const [dataInclusao, setDataInclusao] = useState('');
  const [doeInclusao, setDoeInclusao] = useState('');
  const [dataDiario, setDataDiario] = useState('');
  const [pagina, setPagina] = useState('');
  const [tempoServico, setTempoServico] = useState('');
  const [filiacao, setFiliacao] = useState('');
  const [pai, setPai] = useState('');
  const [mae, setMae] = useState('');
  const [naturalidade, setNaturalidade] = useState('');
  const [endereco, setEndereco] = useState('');
  
  // Fields for Identidade Funcional
  const [sexo, setSexo] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [fatorRh, setFatorRh] = useState('');
  const [situacaoFuncional, setSituacaoFuncional] = useState('');
  const [identidadeFuncional, setIdentidadeFuncional] = useState('');
  
  const [dependentes, setDependentes] = useState<any[]>([]);
  const [cursos, setCursos] = useState<any[]>([]);
  const [promocoes, setPromocoes] = useState<any[]>([]);
  const [averbacao, setAverbacao] = useState<any[]>([]);
  const [licencaEspecial, setLicencaEspecial] = useState<any>({
    concessao: { primeiroDecenio: { qtdDias: '', bcg: '', dataBcg: '' }, segundoDecenio: { qtdDias: '', bcg: '', dataBcg: '' }, terceiroDecenio: { qtdDias: '', bcg: '', dataBcg: '' } },
    fruicao: { primeiroDecenio: { qtdDias: '', bcg: '', dataBcg: '' }, segundoDecenio: { qtdDias: '', bcg: '', dataBcg: '' }, terceiroDecenio: { qtdDias: '', bcg: '', dataBcg: '' } }
  });
  const [incorporacao, setIncorporacao] = useState('');
  const [comandanteAtivo, setComandanteAtivo] = useState<any>(null);
  
  // Campos para Certidão Tempo de Contribuição
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
  const [certidaoResponsavel, setCertidaoResponsavel] = useState({ nome: '', patente: '', funcao: '', matricula: '' });
  const [certidaoGestorRH, setCertidaoGestorRH] = useState({ nome: '', patente: '', funcao: '', matricula: '' });

  // Accordion collapses
  const [incorporacaoOpen, setIncorporacaoOpen] = useState(false);
  const [licencaEspecialOpen, setLicencaEspecialOpen] = useState(false);

  const requestTitle = typeId ? requestTypesMap[typeId] || 'Requerimento' : 'Requerimento';

  // Sync selectedUserId with URL param
  useEffect(() => {
    if (urlUserId && canSearchUsers) {
      setSelectedUserId(urlUserId);
    }
  }, [urlUserId, canSearchUsers]);

  // Fetch active comandante
  useEffect(() => {
    const fetchComandanteAtivo = async () => {
      try {
        const q = query(collection(db, 'comandantes'), where('ativo', '==', true), limit(1));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const data = querySnapshot.docs[0].data();
          setComandanteAtivo({
            nome_completo: data.nome_completo || '',
            patente: data.patente || '',
            posto: data.posto || '',
            matricula: data.matricula || ''
          });
        }
      } catch (error) {
        console.error('Error fetching comandante:', error);
      }
    };

    fetchComandanteAtivo();
  }, []);

  // Fetch solicitações options filtered by typeId
  useEffect(() => {
    if (typeId && PREDEFINED_SOLICITACOES[typeId]) {
      const options = PREDEFINED_SOLICITACOES[typeId];
      setSolicitacoesOptions(options);
      if (options.length > 0) {
        setSelectedSolicitacaoLabel(options[0].label);
        setJustification(options[0].text);
        setAmparoLegal(options[0].amparo || "Art. 5º, Inciso XXXIV, alínea 'a' da Constituição Federal de 1988.");
      }
    } else {
      setSolicitacoesOptions([]);
      setJustification('');
      setAmparoLegal("Art. 5º, Inciso XXXIV, alínea 'a' da Constituição Federal de 1988.");
    }
  }, [typeId]);

  // Update justification and amparoLegal when a solicitação is selected
  const handleSolicitacaoChange = (label: string) => {
    setSelectedSolicitacaoLabel(label);
    const selected = solicitacoesOptions.find(s => s.label === label);
    if (selected) {
      setJustification(selected.text);
      if (selected.amparo) {
        setAmparoLegal(selected.amparo);
      }
    }
  };

  // Fetch profiles for admin search
  useEffect(() => {
    const fetchSearchProfiles = async () => {
      if (!canSearchUsers) return;
      
      try {
        const querySnapshot = await getDocs(collection(db, 'users'));
        const usersList: AppUser[] = [];
        querySnapshot.forEach((doc) => {
          usersList.push({ id: doc.id, ...doc.data() } as AppUser);
        });
        setSearchProfiles(usersList);
      } catch (error) {
        console.error('Error fetching profiles for search:', error);
      }
    };

    fetchSearchProfiles();
  }, [canSearchUsers]);

  // Fetch profile data
  useEffect(() => {
    const fetchProfile = async () => {
      const targetUserId = selectedUserId || user?.id;
      if (!targetUserId) return;

      setLoading(true);
      try {
        const docRef = doc(db, 'users', targetUserId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          setProfile(data);
          
          // Load additional fields from database
          setCpf(data.cpf || '');
          setRg(data.rg || '');
          setDataInclusao(data.data_inclusao || '');
          setDoeInclusao(data.doe_inclusao || '');
          setDataDiario(data.data_diario || '');
          setPagina(data.pagina || '');
          
          // Calculate Tempo Total (Tempo de Efetivo Serviço + Averbação)
          const calcularTempoTotal = () => {
            let diasServico = 0;
            if (data.data_inclusao) {
              const dataInclusaoDate = new Date(data.data_inclusao + 'T00:00:00');
              const hoje = new Date();
              hoje.setHours(0, 0, 0, 0);
              const diffTime = hoje.getTime() - dataInclusaoDate.getTime();
              diasServico = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
            }
            
            const diasAverbacao = Array.isArray(data.averbacao) 
              ? data.averbacao.reduce((total: number, averb: any) => total + (parseInt(averb.totalDias || averb.total_dias) || 0), 0)
              : 0;
            
            const tempoTotalDias = diasServico + diasAverbacao;
            
            if (tempoTotalDias <= 0) return '';
            
            const anos = Math.floor(tempoTotalDias / 365);
            const restoDias = tempoTotalDias % 365;
            const meses = Math.floor(restoDias / 30);
            const dias = restoDias % 30;
            
            const anosStr = `${anos.toString().padStart(2, '0')} ano${anos !== 1 ? 's' : ''}`;
            const mesesStr = `${meses.toString().padStart(2, '0')} ${meses !== 1 ? 'meses' : 'mês'}`;
            const diasStr = `${dias.toString().padStart(2, '0')} dia${dias !== 1 ? 's' : ''}`;
            
            return `${anosStr}, ${mesesStr} e ${diasStr}`;
          };
          
          setTempoServico(calcularTempoTotal());
          setPai(data.pai || '');
          setMae(data.mae || '');
          
          const paiNome = data.pai || '';
          const maeNome = data.mae || '';
          if (paiNome && maeNome) {
            setFiliacao(`${paiNome} e ${maeNome}`);
          } else if (paiNome) {
            setFiliacao(paiNome);
          } else if (maeNome) {
            setFiliacao(maeNome);
          } else {
            setFiliacao(data.filiacao || '');
          }
          setNaturalidade(data.naturalidade || '');
          setEndereco(data.endereco || '');
          
          // Load collections
          setDependentes(Array.isArray(data.dependentes) ? data.dependentes : []);
          setCursos(Array.isArray(data.cursos) ? data.cursos : []);
          setPromocoes(Array.isArray(data.promocoes) ? data.promocoes : []);
          setAverbacao(Array.isArray(data.averbacao) ? data.averbacao : []);
          
          const defaultLicencaEspecial: any = {
            concessao: { primeiroDecenio: { qtdDias: '', bcg: '', dataBcg: '' }, segundoDecenio: { qtdDias: '', bcg: '', dataBcg: '' }, terceiroDecenio: { qtdDias: '', bcg: '', dataBcg: '' } },
            fruicao: { primeiroDecenio: { qtdDias: '', bcg: '', dataBcg: '' }, segundoDecenio: { qtdDias: '', bcg: '', dataBcg: '' }, terceiroDecenio: { qtdDias: '', bcg: '', dataBcg: '' } }
          };
          const licenca = data.licenca_especial && typeof data.licenca_especial === 'object' 
            ? { ...defaultLicencaEspecial, ...data.licenca_especial }
            : defaultLicencaEspecial;
          setLicencaEspecial(licenca);
          
          setIncorporacao(data.incorporacao || '');
          
          // Load new Identidade Funcional fields
          setSexo(data.sexo || '');
          setDataNascimento(data.data_nascimento || '');
          setFatorRh(data.fator_rh || '');
          setSituacaoFuncional(data.status_funcional || data.situacao_funcional || '');
          setIdentidadeFuncional(data.identidade_funcional || '');
          
          // Set Certidão Tempo de Contribuição period fields
          if (data.data_inclusao) {
            setCertidaoPeriodoInicio(data.data_inclusao);
          }
          setCertidaoPeriodoFim(new Date().toISOString().split('T')[0]);
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user, selectedUserId]);

  const handleSelectUser = (userId: string) => {
    setSelectedUserId(userId);
    setSearchOpen(false);
    setSearchQuery('');
  };

  const handleClearSelection = () => {
    setSelectedUserId(null);
  };

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

  // Helper to compile request data for PDF generation
  const compileRequestData = (targetUserId: string, justificationText: string, amparoLegalText: string) => {
    const defaultDecenio = () => ({ qtdDias: "", bcg: "", dataBcg: "" });
    const lic_esp = licencaEspecial || {};

    return {
      requestTitle: requestTitle.toUpperCase(),
      profile: {
        full_name: profile?.nome_completo || profile?.nome || 'Não informado',
        war_name: profile?.nome || 'Não informado',
        registration: profile?.matricula || '',
        phone: profile?.telefone || "",
        email: profile?.email_pm || "",
        rank: profile?.rank || "",
        status: profile?.status_funcional || profile?.situacao_funcional || "",
        garrison: profile?.garrison || "",
        unidade: profile?.unidade || "5º BPM"
      },
      cpf: cpf,
      rg: rg,
      dataInclusao: dataInclusao,
      doeInclusao: doeInclusao,
      dataDiario: dataDiario,
      pagina: pagina,
      tempoServico: tempoServico,
      filiacao: filiacao,
      pai: pai,
      mae: mae,
      naturalidade: naturalidade,
      endereco: endereco,
      dependentes: dependentes.map((dep: any, idx: number) => ({
        id: dep.id || String(idx),
        nome: dep.nome || dep.nome_completo || "",
        tipo: dep.tipo || dep.parentesco || "",
        dataNascimento: dep.dataNascimento || dep.data_nascimento || ""
      })),
      cursos: cursos.map((c: any, idx: number) => ({
        id: c.id || String(idx),
        curso: c.curso || c.nome || "",
        local: c.local || c.instituicao || "",
        ano: String(c.ano || c.conclusao || "")
      })),
      promocoes: promocoes.map((p: any, idx: number) => ({
        id: p.id || String(idx),
        postoGrad: p.postoGrad || p.posto_grad || p.patente || "",
        dataPromocao: p.dataPromocao || p.data_promocao || "",
        doe: p.doe || p.numero_doe || "",
        dataDoe: p.dataDoe || p.data_doe || ""
      })),
      licencaEspecial: {
        concessao: {
          primeiroDecenio: lic_esp.concessao?.primeiroDecenio || defaultDecenio(),
          segundoDecenio: lic_esp.concessao?.segundoDecenio || defaultDecenio(),
          terceiroDecenio: lic_esp.concessao?.terceiroDecenio || defaultDecenio(),
        },
        fruicao: {
          primeiroDecenio: lic_esp.fruicao?.primeiroDecenio || defaultDecenio(),
          segundoDecenio: lic_esp.fruicao?.segundoDecenio || defaultDecenio(),
          terceiroDecenio: lic_esp.fruicao?.terceiroDecenio || defaultDecenio(),
        }
      },
      justification: justificationText,
      amparoLegal: amparoLegalText,
      incorporacao: incorporacao,
      averbacao: averbacao.map((a: any, idx: number) => ({
        id: a.id || String(idx),
        tipo: a.tipo || "",
        nrCertidao: a.nrCertidao || a.numero_certidao || "",
        dataCertidao: a.dataCertidao || a.data_certidao || "",
        doe: a.doe || a.numero_doe || "",
        dataPublicacao: a.dataPublicacao || a.data_publicacao || "",
        totalDias: String(a.totalDias || a.total_dias || "0")
      })),
      comandante: comandanteAtivo || undefined
    };
  };

  // Handle request submission for regular users (sends to admin for approval)
  const handleRequestSubmission = async () => {
    const targetUserId = selectedUserId || user?.id;
    if (!targetUserId || !typeId) return;

    setSaving(true);
    try {
      let finalJustification = justification;
      let finalAmparo = amparoLegal;

      if (typeId === 'identidade-funcional') {
        finalJustification = `REQUER ao Senhor Comandante a emissão de Identidade Funcional com os seguintes dados:\n\n` +
          `• Sexo: ${sexo || '-'}\n` +
          `• Data de Nascimento: ${dataNascimento ? formatDateStr(dataNascimento) : '-'}\n` +
          `• Fator RH: ${fatorRh || '-'}\n` +
          `• Situação Funcional: ${situacaoFuncional || '-'}\n` +
          `• N° ID Funcional: ${identidadeFuncional || '-'}\n\n` +
          `Justificativa:\nEmissão de Identidade Funcional regulamentar.`;
        finalAmparo = "Art. 5º, Inciso XXXIV, alínea 'a' da Constituição Federal de 1988.";
      } else if (typeId === 'certidao-tempo-contribuicao') {
        finalJustification = `REQUER ao Senhor Comandante a emissão de Certidão de Tempo de Contribuição.\n\n` +
          `DADOS FUNCIONAIS:\n` +
          `• Nível/Classe/Referência: ${certidaoNivelClasse || '-'}\n` +
          `• Quadro: ${certidaoQuadro || '-'}\n` +
          `• Município: ${certidaoMunicipio || '-'}\n` +
          `• Órgão: ${certidaoOrgao || '-'}\n` +
          `• Exercendo no Momento: ${certidaoExercendo || '-'}\n` +
          `• Período: de ${certidaoPeriodoInicio ? formatDateStr(certidaoPeriodoInicio) : '-'} até ${certidaoPeriodoFim ? formatDateStr(certidaoPeriodoFim) : '-'}\n\n` +
          `DEMONSTRATIVO:\n` +
          `• Total Bruto: ${certidaoTotalBruto || '-'}\n` +
          `• Averbação: ${certidaoAverbacao || '-'}\n` +
          `• Interrupção: ${certidaoInterrupcao || '-'}\n` +
          `• Faltas: ${certidaoFaltas || '-'}\n` +
          `• Licenças: ${certidaoLicencas || '-'}\n` +
          `• Suspensões: ${certidaoSuspensoes || '-'}\n` +
          `• Outros: ${certidaoOutros || '-'}\n` +
          `• Soma de Deduções: ${certidaoSoma || '-'}\n` +
          `• Total Líquido: ${certidaoTotalLiquido || '-'}\n\n` +
          `TEMPO DE EFETIVO EXERCÍCIO:\n` +
          `• Tempo como PM: ${certidaoTempoEfetivo || '-'}\n` +
          `• Total Geral: ${certidaoTotalTempoEfetivo || '-'}\n\n` +
          `FINALIDADE:\n${certidaoFinalidade || '-'}\n\n` +
          `RESPONSÁVEIS:\n` +
          `• Responsável: ${certidaoResponsavel?.nome || '-'} (${certidaoResponsavel?.patente || '-'} - Mat: ${certidaoResponsavel?.matricula || '-'})\n` +
          `• Gestor de RH: ${certidaoGestorRH?.nome || '-'} (${certidaoGestorRH?.patente || '-'} - Mat: ${certidaoGestorRH?.matricula || '-'})\n\n` +
          `Justificativa:\nExpedição de Certidão de Tempo de Contribuição para fins de reserva.`;
        finalAmparo = "Art. 5º, Inciso XXXIV, alínea 'a' da Constituição Federal de 1988.";
      }

      // Format custom fields object to save in DB
      const customFields: any = {};
      if (typeId === 'identidade-funcional') {
        customFields.sexo = sexo;
        customFields.data_nascimento_req = dataNascimento;
        customFields.fator_rh = fatorRh;
        customFields.situacao_funcional = situacaoFuncional;
        customFields.identidade_funcional = identidadeFuncional;
      } else if (typeId === 'certidao-tempo-contribuicao') {
        customFields.certidao_nivel_classe = certidaoNivelClasse;
        customFields.certidao_quadro = certidaoQuadro;
        customFields.certidao_municipio = certidaoMunicipio;
        customFields.certidao_orgao = certidaoOrgao;
        customFields.certidao_exercendo = certidaoExercendo;
        customFields.certidao_periodo_inicio = certidaoPeriodoInicio;
        customFields.certidao_periodo_fim = certidaoPeriodoFim;
        customFields.certidao_total_bruto = certidaoTotalBruto;
        customFields.certidao_averbacao = certidaoAverbacao;
        customFields.certidao_interrupcao = certidaoInterrupcao;
        customFields.certidao_faltas = certidaoFaltas;
        customFields.certidao_licencas = certidaoLicencas;
        customFields.certidao_suspensoes = certidaoSuspensoes;
        customFields.certidao_outros = certidaoOutros;
        customFields.certidao_soma = certidaoSoma;
        customFields.certidao_total_liquido = certidaoTotalLiquido;
        customFields.certidao_tempo_efetivo = certidaoTempoEfetivo;
        customFields.certidao_total_tempo_efetivo = certidaoTotalTempoEfetivo;
        customFields.certidao_finalidade = certidaoFinalidade;
        customFields.certidao_responsavel = certidaoResponsavel;
        customFields.certidao_gestor_rh = certidaoGestorRH;
      }

      const newReq: any = {
        matricula: profile?.matricula || '',
        nome_operador: profile?.nome || '',
        unidade: profile?.unidade || '5º BPM',
        tipo: typeId,
        tipo_descricao: requestTitle,
        descricao: finalJustification,
        amparo_legal: finalAmparo,
        status: 'PENDENTE',
        created_by: targetUserId,
        created_at: new Date().toISOString(),
        ...customFields
      };

      await addDoc(collection(db, 'requerimentos'), newReq);

      await logAction(
        user?.id || 'unknown',
        user?.nome || 'Sistema',
        'REQUERIMENTO_SUBMITTED',
        `Submeteu um requerimento do tipo ${requestTitle}.`,
        { tipo: typeId }
      );

      navigate('/requerimentos');
    } catch (error: any) {
      console.error('Error submitting request:', error);
      alert('Não foi possível enviar a solicitação: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  // Handle PDF generation for admins
  const handleGeneratePdf = async () => {
    const targetUserId = selectedUserId || user?.id;
    if (!targetUserId || !typeId) return;

    setSaving(true);
    try {
      let finalJustification = justification;
      let finalAmparo = amparoLegal;

      if (typeId === 'identidade-funcional') {
        finalJustification = `REQUER ao Senhor Comandante a emissão de Identidade Funcional com os seguintes dados:\n\n` +
          `• Sexo: ${sexo || '-'}\n` +
          `• Data de Nascimento: ${dataNascimento ? formatDateStr(dataNascimento) : '-'}\n` +
          `• Fator RH: ${fatorRh || '-'}\n` +
          `• Situação Funcional: ${situacaoFuncional || '-'}\n` +
          `• N° ID Funcional: ${identidadeFuncional || '-'}\n\n` +
          `Justificativa:\nEmissão de Identidade Funcional regulamentar.`;
        finalAmparo = "Art. 5º, Inciso XXXIV, alínea 'a' da Constituição Federal de 1988.";
      } else if (typeId === 'certidao-tempo-contribuicao') {
        finalJustification = `REQUER ao Senhor Comandante a emissão de Certidão de Tempo de Contribuição.\n\n` +
          `DADOS FUNCIONAIS:\n` +
          `• Nível/Classe/Referência: ${certidaoNivelClasse || '-'}\n` +
          `• Quadro: ${certidaoQuadro || '-'}\n` +
          `• Município: ${certidaoMunicipio || '-'}\n` +
          `• Órgão: ${certidaoOrgao || '-'}\n` +
          `• Exercendo no Momento: ${certidaoExercendo || '-'}\n` +
          `• Período: de ${certidaoPeriodoInicio ? formatDateStr(certidaoPeriodoInicio) : '-'} até ${certidaoPeriodoFim ? formatDateStr(certidaoPeriodoFim) : '-'}\n\n` +
          `DEMONSTRATIVO:\n` +
          `• Total Bruto: ${certidaoTotalBruto || '-'}\n` +
          `• Averbação: ${certidaoAverbacao || '-'}\n` +
          `• Interrupção: ${certidaoInterrupcao || '-'}\n` +
          `• Faltas: ${certidaoFaltas || '-'}\n` +
          `• Licenças: ${certidaoLicencas || '-'}\n` +
          `• Suspensões: ${certidaoSuspensoes || '-'}\n" +
          "• Outros: ${certidaoOutros || '-'}\n` +
          `• Soma de Deduções: ${certidaoSoma || '-'}\n` +
          `• Total Líquido: ${certidaoTotalLiquido || '-'}\n\n` +
          `TEMPO DE EFETIVO EXERCÍCIO:\n` +
          `• Tempo como PM: ${certidaoTempoEfetivo || '-'}\n` +
          `• Total Geral: ${certidaoTotalTempoEfetivo || '-'}\n\n` +
          `FINALIDADE:\n${certidaoFinalidade || '-'}\n\n` +
          `RESPONSÁVEIS:\n` +
          `• Responsável: ${certidaoResponsavel?.nome || '-'} (${certidaoResponsavel?.patente || '-'} - Mat: ${certidaoResponsavel?.matricula || '-'})\n` +
          `• Gestor de RH: ${certidaoGestorRH?.nome || '-'} (${certidaoGestorRH?.patente || '-'} - Mat: ${certidaoGestorRH?.matricula || '-'})\n\n` +
          `Justificativa:\nExpedição de Certidão de Tempo de Contribuição para fins de reserva.`;
        finalAmparo = "Art. 5º, Inciso XXXIV, alínea 'a' da Constituição Federal de 1988.";
      }

      // Generate PDF
      const requestData = compileRequestData(targetUserId, finalJustification, finalAmparo);
      await generateRequestPdf(requestData);

      // Also register/save in Firestore as DEFERIDO since admin is expediting it directly
      const customFields: any = {};
      if (typeId === 'identidade-funcional') {
        customFields.sexo = sexo;
        customFields.data_nascimento_req = dataNascimento;
        customFields.fator_rh = fatorRh;
        customFields.situacao_funcional = situacaoFuncional;
        customFields.identidade_funcional = identidadeFuncional;
      } else if (typeId === 'certidao-tempo-contribuicao') {
        customFields.certidao_nivel_classe = certidaoNivelClasse;
        customFields.certidao_quadro = certidaoQuadro;
        customFields.certidao_municipio = certidaoMunicipio;
        customFields.certidao_orgao = certidaoOrgao;
        customFields.certidao_exercendo = certidaoExercendo;
        customFields.certidao_periodo_inicio = certidaoPeriodoInicio;
        customFields.certidao_periodo_fim = certidaoPeriodoFim;
        customFields.certidao_total_bruto = certidaoTotalBruto;
        customFields.certidao_averbacao = certidaoAverbacao;
        customFields.certidao_interrupcao = certidaoInterrupcao;
        customFields.certidao_faltas = certidaoFaltas;
        customFields.certidao_licencas = certidaoLicencas;
        customFields.certidao_suspensoes = certidaoSuspensoes;
        customFields.certidao_outros = certidaoOutros;
        customFields.certidao_soma = certidaoSoma;
        customFields.certidao_total_liquido = certidaoTotalLiquido;
        customFields.certidao_tempo_efetivo = certidaoTempoEfetivo;
        customFields.certidao_total_tempo_efetivo = certidaoTotalTempoEfetivo;
        customFields.certidao_finalidade = certidaoFinalidade;
        customFields.certidao_responsavel = certidaoResponsavel;
        customFields.certidao_gestor_rh = certidaoGestorRH;
      }

      const newReq: any = {
        matricula: profile?.matricula || '',
        nome_operador: profile?.nome || '',
        unidade: profile?.unidade || '5º BPM',
        tipo: typeId,
        tipo_descricao: requestTitle,
        descricao: finalJustification,
        amparo_legal: finalAmparo,
        status: 'DEFERIDO',
        resposta_admin: 'Gerado e expedido diretamente pelo Administrador.',
        analisado_por_nome: user?.nome || 'Administrador',
        analisado_por_id: user?.id || 'admin',
        analisado_em: new Date().toISOString(),
        created_by: targetUserId,
        created_at: new Date().toISOString(),
        ...customFields
      };

      await addDoc(collection(db, 'requerimentos'), newReq);

      await logAction(
        user?.id || 'unknown',
        user?.nome || 'Sistema',
        'REQUERIMENTO_EXPEDITED',
        `Gerou e expediu diretamente um requerimento do tipo ${requestTitle} para ${profile?.nome || 'militar'}.`,
        { tipo: typeId }
      );

      navigate('/requerimentos');
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      alert('Não foi possível gerar o PDF: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 border-4 border-navy-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const filteredProfiles = searchProfiles.filter(p => {
    const query = searchQuery.toLowerCase();
    return (
      p.nome?.toLowerCase().includes(query) ||
      p.nome_completo?.toLowerCase().includes(query) ||
      p.matricula?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto py-6">
      {/* Back Header */}
      <div className="flex items-center justify-between border-b border-navy-100 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/requerimentos')}
            className="p-2.5 bg-navy-50 hover:bg-navy-100 text-navy-700 hover:text-navy-950 rounded-xl transition-all"
            title="Voltar para Requerimentos"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-[#CB9E1B]/15 text-[#CB9E1B] text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider">
                FORMULÁRIO DE REQUERIMENTO
              </span>
            </div>
            <h2 className="text-navy-950 text-2xl font-black uppercase tracking-tighter">
              {requestTitle}
            </h2>
            <p className="text-navy-400 text-[10px] font-black uppercase tracking-wider mt-0.5">
              PREENCHA E GERE A PETIÇÃO OFICIAL DA CORPORAÇÃO
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Admin search section */}
        {canSearchUsers && (
          <div className="bg-white border border-navy-100 rounded-3xl p-6 shadow-sm space-y-4">
            <h3 className="text-navy-950 text-xs font-black uppercase tracking-wider flex items-center gap-2">
              <Search className="h-4 w-4 text-navy-600" />
              Emitir em Nome de Outro Militar (Admin)
            </h3>
            
            <div className="relative">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSearchOpen(true);
                  }}
                  onFocus={() => setSearchOpen(true)}
                  placeholder="Digite o nome, nome de guerra ou matrícula do policial..."
                  className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 outline-none transition-all placeholder:text-navy-300"
                />
                {selectedUserId && (
                  <button
                    onClick={handleClearSelection}
                    className="p-3 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition-all"
                    title="Limpar seleção e usar meu perfil"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>

              {/* Native custom dropdown for autocomplete search */}
              {searchOpen && searchQuery && (
                <div className="absolute left-0 right-0 mt-1.5 bg-white border border-navy-100 rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto">
                  {filteredProfiles.length === 0 ? (
                    <div className="p-4 text-center text-navy-400 text-xs font-semibold">Nenhum policial encontrado</div>
                  ) : (
                    filteredProfiles.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleSelectUser(p.id)}
                        className="w-full text-left px-4 py-3 hover:bg-navy-50 flex items-center justify-between border-b border-navy-50/50 last:border-0 transition-colors"
                      >
                        <div>
                          <p className="text-xs font-black text-navy-950 uppercase">{p.nome_completo || p.nome}</p>
                          <p className="text-[10px] font-bold text-navy-400 uppercase mt-0.5">MAT: {p.matricula} • {p.rank || 'Policial'}</p>
                        </div>
                        <span className="text-[9px] font-black bg-navy-100 text-navy-700 px-2.5 py-1 rounded-md uppercase tracking-wider">{p.unidade || '5º BPM'}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {selectedUserId && profile && (
              <div className="bg-navy-50/40 border border-navy-100 px-5 py-3.5 rounded-2xl flex items-center justify-between">
                <div>
                  <p className="text-xs font-black text-navy-950 uppercase">Militar Selecionado: {profile.nome_completo || profile.nome}</p>
                  <p className="text-[9.5px] font-bold text-navy-400 uppercase mt-1">MAT: {profile.matricula} • Unidade: {profile.unidade || '5º BPM'} • Patente: {profile.rank || '-'}</p>
                </div>
                <span className="text-[9px] font-black bg-[#CB9E1B]/15 text-[#CB9E1B] px-3 py-1 rounded-lg uppercase tracking-wider">EDITANDO EM OUTRO NOME</span>
              </div>
            )}
          </div>
        )}

        {/* Informações Pessoais e Funcionais do Militar */}
        <div className="bg-white border border-navy-100 rounded-3xl p-6 shadow-sm space-y-6">
          <div className="flex items-center gap-3 border-b border-navy-50 pb-4">
            <div className="bg-navy-50 p-2 rounded-lg text-navy-700">
              <User className="h-4.5 w-4.5" />
            </div>
            <h3 className="text-navy-950 text-sm font-black uppercase tracking-wider">
              {typeId === 'identidade-funcional' ? 'Dados da Identidade Funcional' : 'Dados do Requerente'}
            </h3>
          </div>

          {typeId === 'identidade-funcional' ? (
            /* Identidade Funcional Fields Grid - max 3 columns */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 text-xs font-semibold text-navy-900">
              <div className="md:col-span-2 lg:col-span-3">
                <span className="text-navy-400 block text-[9px] font-black uppercase tracking-widest mb-1">Nome Completo</span>
                <span className="text-navy-950 font-black uppercase text-sm">{profile?.nome_completo || profile?.nome || '-'}</span>
              </div>
              <div>
                <span className="text-navy-400 block text-[9px] font-black uppercase tracking-widest mb-1">Nome do Pai</span>
                <input
                  type="text"
                  value={pai}
                  onChange={(e) => setPai(e.target.value)}
                  className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 outline-none transition-all"
                  placeholder="Nome do Pai"
                />
              </div>
              <div>
                <span className="text-navy-400 block text-[9px] font-black uppercase tracking-widest mb-1">Nome da Mãe</span>
                <input
                  type="text"
                  value={mae}
                  onChange={(e) => setMae(e.target.value)}
                  className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 outline-none transition-all"
                  placeholder="Nome da Mãe"
                />
              </div>
              <div>
                <span className="text-navy-400 block text-[9px] font-black uppercase tracking-widest mb-1">Matrícula</span>
                <span className="bg-navy-50 block border border-navy-100 rounded-xl px-4 py-3 text-navy-700 font-bold uppercase">{profile?.matricula || '-'}</span>
              </div>
              <div>
                <span className="text-navy-400 block text-[9px] font-black uppercase tracking-widest mb-1">Sexo</span>
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
                <span className="text-navy-400 block text-[9px] font-black uppercase tracking-widest mb-1">Situação Funcional</span>
                <input
                  type="text"
                  value={situacaoFuncional}
                  onChange={(e) => setSituacaoFuncional(e.target.value)}
                  className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 outline-none transition-all"
                  placeholder="Ex: Ativo, Inativo"
                />
              </div>
              <div>
                <span className="text-navy-400 block text-[9px] font-black uppercase tracking-widest mb-1">N° ID Funcional</span>
                <input
                  type="text"
                  value={identidadeFuncional}
                  onChange={(e) => setIdentidadeFuncional(e.target.value)}
                  className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 outline-none transition-all"
                  placeholder="N° Identidade Funcional"
                />
              </div>
              <div>
                <span className="text-navy-400 block text-[9px] font-black uppercase tracking-widest mb-1">Posto/Graduação</span>
                <span className="bg-navy-50 block border border-navy-100 rounded-xl px-4 py-3 text-navy-700 font-bold uppercase">{profile?.rank || '-'}</span>
              </div>
              <div>
                <span className="text-navy-400 block text-[9px] font-black uppercase tracking-widest mb-1">Fator RH</span>
                <input
                  type="text"
                  value={fatorRh}
                  onChange={(e) => setFatorRh(e.target.value)}
                  className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 outline-none transition-all"
                  placeholder="Ex: O+, A-, AB+"
                />
              </div>
              <div>
                <span className="text-navy-400 block text-[9px] font-black uppercase tracking-widest mb-1">Data de Nascimento</span>
                <input
                  type="date"
                  value={dataNascimento}
                  onChange={(e) => setDataNascimento(e.target.value)}
                  className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 outline-none transition-all"
                />
              </div>
              <div>
                <span className="text-navy-400 block text-[9px] font-black uppercase tracking-widest mb-1">Naturalidade</span>
                <input
                  type="text"
                  value={naturalidade}
                  onChange={(e) => setNaturalidade(e.target.value)}
                  className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 outline-none transition-all"
                  placeholder="Naturalidade"
                />
              </div>
              <div>
                <span className="text-navy-400 block text-[9px] font-black uppercase tracking-widest mb-1">RG</span>
                <input
                  type="text"
                  value={rg}
                  onChange={(e) => setRg(e.target.value)}
                  className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 outline-none transition-all"
                  placeholder="RG"
                />
              </div>
              <div>
                <span className="text-navy-400 block text-[9px] font-black uppercase tracking-widest mb-1">CPF</span>
                <input
                  type="text"
                  value={cpf}
                  onChange={(e) => setCpf(e.target.value)}
                  className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 outline-none transition-all"
                  placeholder="CPF"
                />
              </div>
              <div>
                <span className="text-navy-400 block text-[9px] font-black uppercase tracking-widest mb-1">Unidade</span>
                <span className="bg-navy-50 block border border-navy-100 rounded-xl px-4 py-3 text-navy-700 font-bold uppercase">{profile?.unidade || '-'}</span>
              </div>
            </div>
          ) : typeId === 'certidao-tempo-contribuicao' ? (
            /* Certidão de Tempo de Contribuição Base Fields Grid */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 text-xs font-semibold text-navy-900">
              <div className="md:col-span-2 lg:col-span-3">
                <span className="text-navy-400 block text-[9px] font-black uppercase tracking-widest mb-1">Nome Completo</span>
                <span className="text-navy-950 font-black uppercase text-sm">{profile?.nome_completo || profile?.nome || '-'}</span>
              </div>
              <div>
                <span className="text-navy-400 block text-[9px] font-black uppercase tracking-widest mb-1">Matrícula</span>
                <span className="bg-navy-50 block border border-navy-100 rounded-xl px-4 py-3 text-navy-700 font-bold uppercase">{profile?.matricula || '-'}</span>
              </div>
              <div>
                <span className="text-navy-400 block text-[9px] font-black uppercase tracking-widest mb-1">Posto/Graduação</span>
                <span className="bg-navy-50 block border border-navy-100 rounded-xl px-4 py-3 text-navy-700 font-bold uppercase">{profile?.rank || '-'}</span>
              </div>
              <div>
                <span className="text-navy-400 block text-[9px] font-black uppercase tracking-widest mb-1">Unidade</span>
                <span className="bg-navy-50 block border border-navy-100 rounded-xl px-4 py-3 text-navy-700 font-bold uppercase">{profile?.unidade || '-'}</span>
              </div>
              <div className="md:col-span-2 lg:col-span-3">
                <span className="text-navy-400 block text-[9px] font-black uppercase tracking-widest mb-1">Endereço de Residência</span>
                <input
                  type="text"
                  value={endereco}
                  onChange={(e) => setEndereco(e.target.value)}
                  className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 outline-none transition-all"
                  placeholder="Endereço Completo"
                />
              </div>
            </div>
          ) : (
            /* Standard Fields Grid */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 text-xs font-semibold text-navy-900">
              <div className="md:col-span-2 lg:col-span-3">
                <span className="text-navy-400 block text-[9px] font-black uppercase tracking-widest mb-1">Nome Completo</span>
                <span className="text-navy-950 font-black uppercase text-sm">{profile?.nome_completo || profile?.nome || '-'}</span>
              </div>
              <div>
                <span className="text-navy-400 block text-[9px] font-black uppercase tracking-widest mb-1">Matrícula</span>
                <span className="bg-navy-50 block border border-navy-100 rounded-xl px-4 py-3 text-navy-700 font-bold uppercase">{profile?.matricula || '-'}</span>
              </div>
              <div>
                <span className="text-navy-400 block text-[9px] font-black uppercase tracking-widest mb-1">Unidade</span>
                <span className="bg-navy-50 block border border-navy-100 rounded-xl px-4 py-3 text-navy-700 font-bold uppercase">{profile?.unidade || '-'}</span>
              </div>
              <div>
                <span className="text-navy-400 block text-[9px] font-black uppercase tracking-widest mb-1">CPF</span>
                <input
                  type="text"
                  value={cpf}
                  onChange={(e) => setCpf(e.target.value)}
                  className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 outline-none transition-all"
                  placeholder="CPF"
                />
              </div>
              <div>
                <span className="text-navy-400 block text-[9px] font-black uppercase tracking-widest mb-1">RG</span>
                <input
                  type="text"
                  value={rg}
                  onChange={(e) => setRg(e.target.value)}
                  className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 outline-none transition-all"
                  placeholder="RG"
                />
              </div>
              <div>
                <span className="text-navy-400 block text-[9px] font-black uppercase tracking-widest mb-1">Data de Inclusão</span>
                <input
                  type="date"
                  value={dataInclusao}
                  onChange={(e) => setDataInclusao(e.target.value)}
                  className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 outline-none transition-all"
                />
              </div>
              <div>
                <span className="text-navy-400 block text-[9px] font-black uppercase tracking-widest mb-1">DOE de Inclusão</span>
                <input
                  type="text"
                  value={doeInclusao}
                  onChange={(e) => setDoeInclusao(e.target.value)}
                  className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 outline-none transition-all"
                  placeholder="Número do DOE"
                />
              </div>
              <div>
                <span className="text-navy-400 block text-[9px] font-black uppercase tracking-widest mb-1">Data do Diário</span>
                <input
                  type="date"
                  value={dataDiario}
                  onChange={(e) => setDataDiario(e.target.value)}
                  className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 outline-none transition-all"
                />
              </div>
              <div>
                <span className="text-navy-400 block text-[9px] font-black uppercase tracking-widest mb-1">Página</span>
                <input
                  type="text"
                  value={pagina}
                  onChange={(e) => setPagina(e.target.value)}
                  className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 outline-none transition-all"
                  placeholder="Página do Diário"
                />
              </div>
              <div>
                <span className="text-navy-400 block text-[9px] font-black uppercase tracking-widest mb-1">Tempo Total de Serviço</span>
                <span className="bg-navy-50 block border border-navy-100 rounded-xl px-4 py-3 text-navy-700 font-bold uppercase truncate">{tempoServico || 'Não calculado'}</span>
              </div>
              <div>
                <span className="text-navy-400 block text-[9px] font-black uppercase tracking-widest mb-1">Nome do Pai</span>
                <input
                  type="text"
                  value={pai}
                  onChange={(e) => setPai(e.target.value)}
                  className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 outline-none transition-all"
                  placeholder="Nome do Pai"
                />
              </div>
              <div>
                <span className="text-navy-400 block text-[9px] font-black uppercase tracking-widest mb-1">Nome da Mãe</span>
                <input
                  type="text"
                  value={mae}
                  onChange={(e) => setMae(e.target.value)}
                  className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 outline-none transition-all"
                  placeholder="Nome da Mãe"
                />
              </div>
              <div>
                <span className="text-navy-400 block text-[9px] font-black uppercase tracking-widest mb-1">Filiação</span>
                <span className="bg-navy-50 block border border-navy-100 rounded-xl px-4 py-3 text-navy-700 font-bold uppercase truncate">{filiacao || '-'}</span>
              </div>
              <div>
                <span className="text-navy-400 block text-[9px] font-black uppercase tracking-widest mb-1">Naturalidade</span>
                <input
                  type="text"
                  value={naturalidade}
                  onChange={(e) => setNaturalidade(e.target.value)}
                  className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 outline-none transition-all"
                  placeholder="Naturalidade"
                />
              </div>
              <div className="md:col-span-2">
                <span className="text-navy-400 block text-[9px] font-black uppercase tracking-widest mb-1">Endereço de Residência</span>
                <input
                  type="text"
                  value={endereco}
                  onChange={(e) => setEndereco(e.target.value)}
                  className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 outline-none transition-all"
                  placeholder="Endereço Completo"
                />
              </div>
            </div>
          )}
        </div>

        {/* Dynamic tables for background profiles - Hide for Identidade Funcional and Certidão Tempo Contribuição */}
        {typeId !== 'identidade-funcional' && typeId !== 'certidao-tempo-contribuicao' && (
          <>
            {/* Averbações */}
            <div className="bg-white border border-navy-100 rounded-3xl p-6 shadow-sm space-y-4">
              <h3 className="text-navy-950 text-xs font-black uppercase tracking-wider border-b pb-2">
                Averbações Cadastradas
              </h3>
              {averbacao.length === 0 ? (
                <p className="text-xs text-navy-400 font-medium py-2">Nenhuma averbação cadastrada neste perfil.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[10px] text-navy-800">
                    <thead>
                      <tr className="border-b border-navy-100 font-black uppercase text-navy-400">
                        <th className="text-left py-2 px-1">Tipo</th>
                        <th className="text-left py-2 px-1">Nº Certidão</th>
                        <th className="text-left py-2 px-1">Data Certidão</th>
                        <th className="text-left py-2 px-1">DOE</th>
                        <th className="text-left py-2 px-1">Data Pub.</th>
                        <th className="text-right py-2 px-1">Total Dias</th>
                      </tr>
                    </thead>
                    <tbody>
                      {averbacao.map((av, index) => (
                        <tr key={av.id || index} className="border-b border-navy-50 font-semibold uppercase">
                          <td className="py-2.5 px-1 text-navy-950">{av.tipo}</td>
                          <td className="py-2.5 px-1">{av.nrCertidao || av.numero_certidao || '-'}</td>
                          <td className="py-2.5 px-1">{av.dataCertidao || av.data_certidao ? formatDateStr(av.dataCertidao || av.data_certidao) : '-'}</td>
                          <td className="py-2.5 px-1">{av.doe || av.numero_doe || '-'}</td>
                          <td className="py-2.5 px-1">{av.dataPublicacao || av.data_publicacao ? formatDateStr(av.dataPublicacao || av.data_publicacao) : '-'}</td>
                          <td className="py-2.5 px-1 text-right text-navy-950 font-black">{av.totalDias || av.total_dias || '0'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Dependentes */}
            <div className="bg-white border border-navy-100 rounded-3xl p-6 shadow-sm space-y-4">
              <h3 className="text-navy-950 text-xs font-black uppercase tracking-wider border-b pb-2">
                Dependentes Cadastrados
              </h3>
              {dependentes.length === 0 ? (
                <p className="text-xs text-navy-400 font-medium py-2">Nenhum dependente cadastrado neste perfil.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[10px] text-navy-800">
                    <thead>
                      <tr className="border-b border-navy-100 font-black uppercase text-navy-400">
                        <th className="text-left py-2 px-1">Nome</th>
                        <th className="text-left py-2 px-1">Parentesco</th>
                        <th className="text-left py-2 px-1">Data Nascimento</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dependentes.map((dep, index) => (
                        <tr key={dep.id || index} className="border-b border-navy-50 font-semibold uppercase">
                          <td className="py-2.5 px-1 text-navy-950">{dep.nome || dep.nome_completo || '-'}</td>
                          <td className="py-2.5 px-1">{dep.tipo || dep.parentesco || '-'}</td>
                          <td className="py-2.5 px-1">{dep.dataNascimento || dep.data_nascimento ? formatDateStr(dep.dataNascimento || dep.data_nascimento) : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Cursos */}
            <div className="bg-white border border-navy-100 rounded-3xl p-6 shadow-sm space-y-4">
              <h3 className="text-navy-950 text-xs font-black uppercase tracking-wider border-b pb-2">
                Cursos Cadastrados
              </h3>
              {cursos.length === 0 ? (
                <p className="text-xs text-navy-400 font-medium py-2">Nenhum curso cadastrado neste perfil.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[10px] text-navy-800">
                    <thead>
                      <tr className="border-b border-navy-100 font-black uppercase text-navy-400">
                        <th className="text-left py-2 px-1">Curso</th>
                        <th className="text-left py-2 px-1">Instituição</th>
                        <th className="text-right py-2 px-1">Ano Conclusão</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cursos.map((c, index) => (
                        <tr key={c.id || index} className="border-b border-navy-50 font-semibold uppercase">
                          <td className="py-2.5 px-1 text-navy-950">{c.curso || c.nome || '-'}</td>
                          <td className="py-2.5 px-1">{c.local || c.instituicao || '-'}</td>
                          <td className="py-2.5 px-1 text-right">{c.ano || c.conclusao || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Promoções */}
            <div className="bg-white border border-navy-100 rounded-3xl p-6 shadow-sm space-y-4">
              <h3 className="text-navy-950 text-xs font-black uppercase tracking-wider border-b pb-2">
                Histórico de Promoções
              </h3>
              {promocoes.length === 0 ? (
                <p className="text-xs text-navy-400 font-medium py-2">Nenhuma promoção cadastrada neste perfil.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[10px] text-navy-800">
                    <thead>
                      <tr className="border-b border-navy-100 font-black uppercase text-navy-400">
                        <th className="text-left py-2 px-1">Patente / Graduação</th>
                        <th className="text-left py-2 px-1">Data da Promoção</th>
                        <th className="text-left py-2 px-1">DOE</th>
                        <th className="text-left py-2 px-1">Data DOE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {promocoes.map((p, index) => (
                        <tr key={p.id || index} className="border-b border-navy-50 font-semibold uppercase">
                          <td className="py-2.5 px-1 text-navy-950">{p.postoGrad || p.posto_grad || p.patente || '-'}</td>
                          <td className="py-2.5 px-1">{p.dataPromocao || p.data_promocao ? formatDateStr(p.dataPromocao || p.data_promocao) : '-'}</td>
                          <td className="py-2.5 px-1">{p.doe || p.numero_doe || '-'}</td>
                          <td className="py-2.5 px-1">{p.dataDoe || p.data_doe ? formatDateStr(p.dataDoe || p.data_doe) : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Accordion: Incorporação */}
            <div className="bg-white border border-navy-100 rounded-3xl shadow-sm overflow-hidden">
              <button
                type="button"
                onClick={() => setIncorporacaoOpen(!incorporacaoOpen)}
                className="w-full flex items-center justify-between p-6 hover:bg-navy-50/20 transition-all border-b border-navy-50"
              >
                <span className="text-navy-950 font-black uppercase text-xs tracking-wider">Incorporação</span>
                <ChevronDown className={`w-5 h-5 text-navy-500 transition-transform duration-200 ${incorporacaoOpen ? 'rotate-180' : ''}`} />
              </button>
              {incorporacaoOpen && (
                <div className="p-6 bg-navy-50/10 space-y-4">
                  <span className="text-navy-400 block text-[9px] font-black uppercase tracking-widest mb-1">Texto de Incorporação</span>
                  <textarea
                    value={incorporacao}
                    onChange={(e) => setIncorporacao(e.target.value)}
                    rows={4}
                    className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 outline-none transition-all placeholder:text-navy-300"
                    placeholder="Cole ou redija o histórico de incorporação..."
                  />
                </div>
              )}
            </div>

            {/* Accordion: Licença Especial */}
            <div className="bg-white border border-navy-100 rounded-3xl shadow-sm overflow-hidden">
              <button
                type="button"
                onClick={() => setLicencaEspecialOpen(!licencaEspecialOpen)}
                className="w-full flex items-center justify-between p-6 hover:bg-navy-50/20 transition-all border-b border-navy-50"
              >
                <span className="text-navy-950 font-black uppercase text-xs tracking-wider">Licença Especial (Concessão e Fruição)</span>
                <ChevronDown className={`w-5 h-5 text-navy-500 transition-transform duration-200 ${licencaEspecialOpen ? 'rotate-180' : ''}`} />
              </button>
              {licencaEspecialOpen && (
                <div className="p-6 bg-navy-50/10 space-y-8">
                  {/* Concessão */}
                  <div className="space-y-4">
                    <h4 className="font-black text-navy-950 text-xs uppercase tracking-wider border-b border-navy-100 pb-2">1 - Concessão</h4>
                    {(['primeiroDecenio', 'segundoDecenio', 'terceiroDecenio'] as const).map((dec, idx) => (
                      <div key={dec} className="space-y-2">
                        <span className="text-[10px] font-black text-navy-500 uppercase tracking-widest block">{idx + 1}° Decênio</span>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <label className="text-[8.5px] font-black text-navy-400 uppercase block mb-1">QTD Dias</label>
                            <input
                              type="text"
                              value={licencaEspecial.concessao[dec]?.qtdDias || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setLicencaEspecial((prev: any) => ({
                                  ...prev,
                                  concessao: {
                                    ...prev.concessao,
                                    [dec]: { ...prev.concessao[dec], qtdDias: val }
                                  }
                                }));
                              }}
                              className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-lg px-3 py-2 text-xs font-semibold text-navy-950 outline-none"
                              placeholder="Dias"
                            />
                          </div>
                          <div>
                            <label className="text-[8.5px] font-black text-navy-400 uppercase block mb-1">BCG</label>
                            <input
                              type="text"
                              value={licencaEspecial.concessao[dec]?.bcg || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setLicencaEspecial((prev: any) => ({
                                  ...prev,
                                  concessao: {
                                    ...prev.concessao,
                                    [dec]: { ...prev.concessao[dec], bcg: val }
                                  }
                                }));
                              }}
                              className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-lg px-3 py-2 text-xs font-semibold text-navy-950 outline-none"
                              placeholder="Número do BCG"
                            />
                          </div>
                          <div>
                            <label className="text-[8.5px] font-black text-navy-400 uppercase block mb-1">Data BCG</label>
                            <input
                              type="text"
                              value={licencaEspecial.concessao[dec]?.dataBcg || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setLicencaEspecial((prev: any) => ({
                                  ...prev,
                                  concessao: {
                                    ...prev.concessao,
                                    [dec]: { ...prev.concessao[dec], dataBcg: val }
                                  }
                                }));
                              }}
                              className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-lg px-3 py-2 text-xs font-semibold text-navy-950 outline-none"
                              placeholder="Data"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Fruição */}
                  <div className="space-y-4">
                    <h4 className="font-black text-navy-950 text-xs uppercase tracking-wider border-b border-navy-100 pb-2">2 - Fruição</h4>
                    {(['primeiroDecenio', 'segundoDecenio', 'terceiroDecenio'] as const).map((dec, idx) => (
                      <div key={dec} className="space-y-2">
                        <span className="text-[10px] font-black text-navy-500 uppercase tracking-widest block">{idx + 1}° Decênio</span>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <label className="text-[8.5px] font-black text-navy-400 uppercase block mb-1">QTD Dias</label>
                            <input
                              type="text"
                              value={licencaEspecial.fruicao[dec]?.qtdDias || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setLicencaEspecial((prev: any) => ({
                                  ...prev,
                                  fruicao: {
                                    ...prev.fruicao,
                                    [dec]: { ...prev.fruicao[dec], qtdDias: val }
                                  }
                                }));
                              }}
                              className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-lg px-3 py-2 text-xs font-semibold text-navy-950 outline-none"
                              placeholder="Dias"
                            />
                          </div>
                          <div>
                            <label className="text-[8.5px] font-black text-navy-400 uppercase block mb-1">BCG</label>
                            <input
                              type="text"
                              value={licencaEspecial.fruicao[dec]?.bcg || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setLicencaEspecial((prev: any) => ({
                                  ...prev,
                                  fruicao: {
                                    ...prev.fruicao,
                                    [dec]: { ...prev.fruicao[dec], bcg: val }
                                  }
                                }));
                              }}
                              className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-lg px-3 py-2 text-xs font-semibold text-navy-950 outline-none"
                              placeholder="Número do BCG"
                            />
                          </div>
                          <div>
                            <label className="text-[8.5px] font-black text-navy-400 uppercase block mb-1">Data BCG</label>
                            <input
                              type="text"
                              value={licencaEspecial.fruicao[dec]?.dataBcg || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setLicencaEspecial((prev: any) => ({
                                  ...prev,
                                  fruicao: {
                                    ...prev.fruicao,
                                    [dec]: { ...prev.fruicao[dec], dataBcg: val }
                                  }
                                }));
                              }}
                              className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-lg px-3 py-2 text-xs font-semibold text-navy-950 outline-none"
                              placeholder="Data"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Certidão Tempo de Contribuição Specific Fields Section */}
        {typeId === 'certidao-tempo-contribuicao' && (
          <div className="bg-white border border-navy-100 rounded-3xl p-6 shadow-sm space-y-6">
            <h3 className="text-navy-950 text-sm font-black uppercase tracking-wider border-b pb-3">
              Dados Específicos para a Certidão
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-[9px] font-black text-navy-500 uppercase tracking-widest mb-1">Nível/Classe/Referência</label>
                <input
                  type="text"
                  value={certidaoNivelClasse}
                  onChange={(e) => setCertidaoNivelClasse(e.target.value)}
                  className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 outline-none transition-all"
                  placeholder="Ex: 708/SG/6 40016"
                />
              </div>
              <div>
                <label className="block text-[9px] font-black text-navy-500 uppercase tracking-widest mb-1">Quadro</label>
                <input
                  type="text"
                  value={certidaoQuadro}
                  onChange={(e) => setCertidaoQuadro(e.target.value)}
                  className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 outline-none transition-all"
                  placeholder="Ex: Permanente"
                />
              </div>
              <div>
                <label className="block text-[9px] font-black text-navy-500 uppercase tracking-widest mb-1">Município</label>
                <input
                  type="text"
                  value={certidaoMunicipio}
                  onChange={(e) => setCertidaoMunicipio(e.target.value)}
                  className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 outline-none transition-all"
                  placeholder="Ex: Coxim - MS"
                />
              </div>
              <div>
                <label className="block text-[9px] font-black text-navy-500 uppercase tracking-widest mb-1">Órgão</label>
                <input
                  type="text"
                  value={certidaoOrgao}
                  onChange={(e) => setCertidaoOrgao(e.target.value)}
                  className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 outline-none transition-all"
                  placeholder="Ex: Polícia Militar"
                />
              </div>
              <div>
                <label className="block text-[9px] font-black text-navy-500 uppercase tracking-widest mb-1">Exercendo no Momento</label>
                <input
                  type="text"
                  value={certidaoExercendo}
                  onChange={(e) => setCertidaoExercendo(e.target.value)}
                  className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 outline-none transition-all"
                  placeholder="Ex: Ativo"
                />
              </div>
              <div>
                <label className="block text-[9px] font-black text-navy-500 uppercase tracking-widest mb-1">Data Início Período</label>
                <input
                  type="date"
                  value={certidaoPeriodoInicio}
                  onChange={(e) => setCertidaoPeriodoInicio(e.target.value)}
                  className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-[9px] font-black text-navy-500 uppercase tracking-widest mb-1">Data Fim Período</label>
                <input
                  type="date"
                  value={certidaoPeriodoFim}
                  onChange={(e) => setCertidaoPeriodoFim(e.target.value)}
                  className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 outline-none transition-all"
                />
              </div>
            </div>

            <div className="border-t border-navy-100 pt-4 space-y-4">
              <h4 className="font-black text-navy-900 text-xs uppercase tracking-wider">Demonstrativo de Tempo (Em Dias)</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[9px] font-black text-navy-500 uppercase tracking-widest mb-1">Total Bruto</label>
                  <input
                    type="text"
                    value={certidaoTotalBruto}
                    onChange={(e) => setCertidaoTotalBruto(e.target.value)}
                    className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 outline-none transition-all"
                    placeholder="Ex: 10.228"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-navy-500 uppercase tracking-widest mb-1">Averbação</label>
                  <input
                    type="text"
                    value={certidaoAverbacao}
                    onChange={(e) => setCertidaoAverbacao(e.target.value)}
                    className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 outline-none transition-all"
                    placeholder="Ex: 928"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-navy-500 uppercase tracking-widest mb-1">Interrupção</label>
                  <input
                    type="text"
                    value={certidaoInterrupcao}
                    onChange={(e) => setCertidaoInterrupcao(e.target.value)}
                    className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 outline-none transition-all"
                    placeholder="Ex: -"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-navy-500 uppercase tracking-widest mb-1">Faltas</label>
                  <input
                    type="text"
                    value={certidaoFaltas}
                    onChange={(e) => setCertidaoFaltas(e.target.value)}
                    className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 outline-none transition-all"
                    placeholder="Ex: -"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-navy-500 uppercase tracking-widest mb-1">Licenças</label>
                  <input
                    type="text"
                    value={certidaoLicencas}
                    onChange={(e) => setCertidaoLicencas(e.target.value)}
                    className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 outline-none transition-all"
                    placeholder="Ex: -"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-navy-500 uppercase tracking-widest mb-1">Suspensões</label>
                  <input
                    type="text"
                    value={certidaoSuspensoes}
                    onChange={(e) => setCertidaoSuspensoes(e.target.value)}
                    className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 outline-none transition-all"
                    placeholder="Ex: -"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-navy-500 uppercase tracking-widest mb-1">Outros</label>
                  <input
                    type="text"
                    value={certidaoOutros}
                    onChange={(e) => setCertidaoOutros(e.target.value)}
                    className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 outline-none transition-all"
                    placeholder="Ex: -"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-navy-500 uppercase tracking-widest mb-1">Soma de Deduções</label>
                  <input
                    type="text"
                    value={certidaoSoma}
                    onChange={(e) => setCertidaoSoma(e.target.value)}
                    className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 outline-none transition-all"
                    placeholder="Ex: -"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-navy-500 uppercase tracking-widest mb-1">Total Líquido</label>
                  <input
                    type="text"
                    value={certidaoTotalLiquido}
                    onChange={(e) => setCertidaoTotalLiquido(e.target.value)}
                    className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 outline-none transition-all"
                    placeholder="Ex: 11.156"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-navy-100 pt-4 space-y-4">
              <h4 className="font-black text-navy-900 text-xs uppercase tracking-wider">Tempo de Efetivo Exercício por Extenso</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] font-black text-navy-500 uppercase tracking-widest mb-1">Tempo PM por Extenso</label>
                  <textarea
                    value={certidaoTempoEfetivo}
                    onChange={(e) => setCertidaoTempoEfetivo(e.target.value)}
                    rows={3}
                    className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 outline-none transition-all placeholder:text-navy-300"
                    placeholder="Ex: 10.228 (dez mil, duzentos e vinte e oito) dias..."
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-navy-500 uppercase tracking-widest mb-1">Total de Tempo de Efetivo Exercício por Extenso</label>
                  <textarea
                    value={certidaoTotalTempoEfetivo}
                    onChange={(e) => setCertidaoTotalTempoEfetivo(e.target.value)}
                    rows={3}
                    className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 outline-none transition-all placeholder:text-navy-300"
                    placeholder="Ex: 11.156 (onze mil, cento e cinquenta e seis) dias..."
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-navy-100 pt-4 space-y-2">
              <label className="block text-[9px] font-black text-navy-500 uppercase tracking-widest mb-1">Finalidade da Certidão</label>
              <textarea
                value={certidaoFinalidade}
                onChange={(e) => setCertidaoFinalidade(e.target.value)}
                rows={4}
                className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 outline-none transition-all placeholder:text-navy-300"
                placeholder="Ex: Certifico para fins de instruir processo de Reserva..."
              />
            </div>

            {/* Responsável */}
            <div className="border-t border-navy-100 pt-4 space-y-4">
              <h4 className="font-black text-navy-900 text-xs uppercase tracking-wider">Militar Responsável pela Confecção</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-[9px] font-black text-navy-500 uppercase tracking-widest mb-1">Nome Completo</label>
                  <input
                    type="text"
                    value={certidaoResponsavel.nome}
                    onChange={(e) => setCertidaoResponsavel({ ...certidaoResponsavel, nome: e.target.value })}
                    className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 outline-none transition-all"
                    placeholder="Nome completo"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-navy-500 uppercase tracking-widest mb-1">Patente / Graduação</label>
                  <input
                    type="text"
                    value={certidaoResponsavel.patente}
                    onChange={(e) => setCertidaoResponsavel({ ...certidaoResponsavel, patente: e.target.value })}
                    className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 outline-none transition-all"
                    placeholder="Ex: 3º SGT PM"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-navy-500 uppercase tracking-widest mb-1">Função</label>
                  <input
                    type="text"
                    value={certidaoResponsavel.funcao}
                    onChange={(e) => setCertidaoResponsavel({ ...certidaoResponsavel, funcao: e.target.value })}
                    className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 outline-none transition-all"
                    placeholder="Ex: Aux. P-1 / 5º BPM"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-navy-500 uppercase tracking-widest mb-1">Matrícula</label>
                  <input
                    type="text"
                    value={certidaoResponsavel.matricula}
                    onChange={(e) => setCertidaoResponsavel({ ...certidaoResponsavel, matricula: e.target.value })}
                    className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 outline-none transition-all"
                    placeholder="Matrícula"
                  />
                </div>
              </div>
            </div>

            {/* Gestor de Processo */}
            <div className="border-t border-navy-100 pt-4 space-y-4">
              <h4 className="font-black text-navy-900 text-xs uppercase tracking-wider">Gestor de Recursos Humanos do Processo</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-[9px] font-black text-navy-500 uppercase tracking-widest mb-1">Nome Completo</label>
                  <input
                    type="text"
                    value={certidaoGestorRH.nome}
                    onChange={(e) => setCertidaoGestorRH({ ...certidaoGestorRH, nome: e.target.value })}
                    className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 outline-none transition-all"
                    placeholder="Nome completo"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-navy-500 uppercase tracking-widest mb-1">Patente / Graduação</label>
                  <input
                    type="text"
                    value={certidaoGestorRH.patente}
                    onChange={(e) => setCertidaoGestorRH({ ...certidaoGestorRH, patente: e.target.value })}
                    className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 outline-none transition-all"
                    placeholder="Ex: 2º TEN QOPM"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-navy-500 uppercase tracking-widest mb-1">Função</label>
                  <input
                    type="text"
                    value={certidaoGestorRH.funcao}
                    onChange={(e) => setCertidaoGestorRH({ ...certidaoGestorRH, funcao: e.target.value })}
                    className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 outline-none transition-all"
                    placeholder="Ex: Chefe da P-1 do 5º BPM"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-navy-500 uppercase tracking-widest mb-1">Matrícula</label>
                  <input
                    type="text"
                    value={certidaoGestorRH.matricula}
                    onChange={(e) => setCertidaoGestorRH({ ...certidaoGestorRH, matricula: e.target.value })}
                    className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 outline-none transition-all"
                    placeholder="Matrícula"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Dynamic standard request options - Hide for Identidade Funcional and Certidão Tempo de Contribuição */}
        {typeId !== 'identidade-funcional' && typeId !== 'certidao-tempo-contribuicao' && (
          <div className="bg-white border border-navy-100 rounded-3xl p-6 shadow-sm space-y-5">
            <h3 className="text-navy-950 text-xs font-black uppercase tracking-wider border-b pb-2">
              Opções de Solicitação Predefinidas
            </h3>
            
            {solicitacoesOptions.length > 0 && (
              <div className="space-y-2">
                <label className="block text-[9px] font-black text-navy-500 uppercase tracking-widest mb-1">Selecione o Modelo de Petição</label>
                <select
                  value={selectedSolicitacaoLabel}
                  onChange={(e) => handleSolicitacaoChange(e.target.value)}
                  className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 outline-none transition-all"
                >
                  {solicitacoesOptions.map((sol, index) => (
                    <option key={index} value={sol.label}>
                      {sol.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-[9px] font-black text-navy-500 uppercase tracking-widest mb-1">Texto Justificativo da Solicitação</label>
              <textarea
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                rows={6}
                className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 outline-none transition-all placeholder:text-navy-300"
                placeholder="Descreva o motivo da sua petição..."
              />
            </div>

            <div className="space-y-2">
              <label className="block text-[9px] font-black text-navy-500 uppercase tracking-widest mb-1">Amparo Legal</label>
              <textarea
                value={amparoLegal}
                onChange={(e) => setAmparoLegal(e.target.value)}
                rows={3}
                className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 outline-none transition-all placeholder:text-navy-300"
                placeholder="Informe o amparo legal para este requerimento..."
              />
            </div>
          </div>
        )}

        {/* Submission Actions */}
        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={() => navigate('/requerimentos')}
            className="px-5 py-3 border border-navy-200 hover:bg-navy-50/50 text-navy-700 hover:text-navy-950 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all"
          >
            Cancelar
          </button>
          
          {canSearchUsers ? (
            <button
              onClick={handleGeneratePdf}
              disabled={saving}
              className="bg-navy-600 hover:bg-navy-500 disabled:bg-navy-300 text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Gerando...' : 'Gerar e Expedir PDF'}
            </button>
          ) : (
            <button
              onClick={handleRequestSubmission}
              disabled={saving}
              className="bg-navy-600 hover:bg-navy-500 disabled:bg-navy-300 text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5"
            >
              <Send className="h-4 w-4" />
              {saving ? 'Enviando...' : 'Solicitar Requerimento'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
