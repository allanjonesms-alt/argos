import React, { useState } from 'react';
import { 
  ArrowLeft, Shield, Crown, Key, Eye, UserCheck, Star, Terminal, Users, 
  MapPin, CheckCircle, Lock, BookOpen, ChevronDown, ChevronUp, Database, 
  Info, Cpu, Network, FileText, Camera, Map, Upload, ShieldAlert, BadgeInfo 
} from 'lucide-react';
import { User, UserRole } from '../types';

interface AppOrganogramProps {
  onBack: () => void;
  currentUser: User | null;
}

interface RoleConfig {
  role: UserRole;
  label: string;
  colorClass: string;
  borderClass: string;
  bgClass: string;
  badgeClass: string;
  textColorClass: string;
  icon: React.ReactNode;
  clearance: string;
  description: string;
  rulesDesc: string[];
  dbPermissions: {
    read: string;
    write: string;
    delete: string;
  };
}

export const AppOrganogram: React.FC<AppOrganogramProps> = ({ onBack, currentUser }) => {
  const [selectedRoleBranch, setSelectedRoleBranch] = useState<UserRole | null>(null);
  const [expandedPage, setExpandedPage] = useState<string | null>(null);

  const roleConfigs: Record<UserRole, RoleConfig> = {
    [UserRole.MASTER]: {
      role: UserRole.MASTER,
      label: 'MASTER (Super Administrador)',
      colorClass: 'bg-amber-500 border-amber-600 text-amber-950',
      borderClass: 'border-amber-500',
      bgClass: 'bg-amber-500/10 hover:bg-amber-500/20',
      badgeClass: 'bg-amber-500/20 text-amber-700 border border-amber-500/30',
      textColorClass: 'text-amber-800',
      icon: <Crown className="w-5 h-5 text-amber-600" />,
      clearance: 'Nível 5 - Acesso de Segurança Total',
      description: 'Perfil de desenvolvedor e comando supremo. Ignora restrições territoriais ou de unidades operacionais.',
      rulesDesc: [
        'Acesso irrestrito de leitura e escrita em todo o banco de dados.',
        'Visualização e construção do Organograma do Crime (/organogramas).',
        'Exclusão irreversível de relatórios de policiamento e indivíduos.',
        'Habilidade técnica de auditar absolutamente qualquer Log do sistema.'
      ],
      dbPermissions: {
        read: 'Sem restrições (isMaster() == true)',
        write: 'Sem restrições (isMaster() == true)',
        delete: 'Apenas Master ou Admin (isAdmin() || isMaster())'
      }
    },
    [UserRole.ADMIN]: {
      role: UserRole.ADMIN,
      label: 'ADMIN (Administrador Técnico)',
      colorClass: 'bg-indigo-600 border-indigo-700 text-white',
      borderClass: 'border-indigo-600',
      bgClass: 'bg-indigo-600/10 hover:bg-indigo-600/20',
      badgeClass: 'bg-indigo-600/25 text-indigo-700 border border-indigo-500/30',
      textColorClass: 'text-indigo-800',
      icon: <Key className="w-5 h-5 text-indigo-600" />,
      clearance: 'Nível 4 - Gerenciamento e Credenciamento',
      description: 'Incarregado das engrenagens lógicas, frotas de viaturas, habilitação de novos operadores e homologações.',
      rulesDesc: [
        'Gerenciamento e criação de Operadores em qualquer unidade.',
        'Habilitação e desabilitação de funcionalidades por Unidade.',
        'Edição e auditoria de frotas de viaturas e históricos operacionais.',
        'Visualização integrada de Logs de Auditoria.'
      ],
      dbPermissions: {
        read: 'Permitido por funções administrativas (isAdmin() == true)',
        write: 'Restrito a parâmetros estruturais de validação',
        delete: 'Apenas Administradores do sistema (isAdmin() == true)'
      }
    },
    [UserRole.SUPERVISOR_DE_OPERACOES]: {
      role: UserRole.SUPERVISOR_DE_OPERACOES,
      label: 'SUPERVISOR (Controle de Área)',
      colorClass: 'bg-purple-600 border-purple-700 text-white',
      borderClass: 'border-purple-600',
      bgClass: 'bg-purple-600/10 hover:bg-purple-600/20',
      badgeClass: 'bg-purple-600/25 text-purple-700 border border-purple-500/30',
      textColorClass: 'text-purple-800',
      icon: <Eye className="w-5 h-5 text-purple-600" />,
      clearance: 'Nível 3 - Supervisão Operacional de Turno',
      description: 'Coordenador táctico de policiamento. Foca no monitoramento macro de ocorrências e guarnições ativas de serviço.',
      rulesDesc: [
        'Acesso completo a ocorrências policiais registradas de SS/RO.',
        'Gerenciamento e intervenção tática nas escalas da Força Tática.',
        'Visualização ampla do andamento e logs operacionais diários.',
        'Apoio consultivo em dados de inteligência de indivíduos.'
      ],
      dbPermissions: {
        read: 'Leitura completa da unidade associada e logs do turno',
        write: 'Escrita focada em ocorrências e acompanhamentos táticos',
        delete: 'Exclusão vetada (permitida apenas para Admin/Master)'
      }
    },
    [UserRole.CHEFE_DE_EQUIPE]: {
      role: UserRole.CHEFE_DE_EQUIPE,
      label: 'CHEFE DE EQUIPE (Comandante de VTR)',
      colorClass: 'bg-emerald-600 border-emerald-700 text-white',
      borderClass: 'border-emerald-600',
      bgClass: 'bg-emerald-600/10 hover:bg-emerald-600/20',
      badgeClass: 'bg-emerald-600/25 text-emerald-700 border border-emerald-500/30',
      textColorClass: 'text-emerald-800',
      icon: <UserCheck className="w-5 h-5 text-emerald-600" />,
      clearance: 'Nível 2 - Comandante Operacional Local',
      description: 'Líder direto da equipe embarcada na viatura. Responsável pelas decisões da equipe e confecção da Parte Diária.',
      rulesDesc: [
        'Abertura, edição e preenchimento completo de Parte Diária.',
        'Registro de escalas, material de carga, armamento operacional.',
        'Lançamento rápido de ações operacionais (Abordagens/Apreensões).',
        'Registro detalhado de relatórios de intervenção e detritos sequestrados.'
      ],
      dbPermissions: {
        read: 'Limitado à sua unidade militar específica',
        write: 'Escrita de fichas de abordagem, ocorrências locais e partes',
        delete: 'Bloqueado (exige solicitação administrativa à supervisão)'
      }
    },
    [UserRole.OPERATOR]: {
      role: UserRole.OPERATOR,
      label: 'OPERADOR (Entrada e Pesquisa)',
      colorClass: 'bg-cyan-600 border-cyan-700 text-white',
      borderClass: 'border-cyan-600',
      bgClass: 'bg-cyan-600/10 hover:bg-cyan-600/20',
      badgeClass: 'bg-cyan-500/20 text-cyan-700 border border-cyan-500/30',
      textColorClass: 'text-cyan-800',
      icon: <Terminal className="w-5 h-5 text-cyan-600" />,
      clearance: 'Nível 1 - Operador de Dados de Campo',
      description: 'Focado em alimentar o sistema de inteligência a partir de abordagens locais, consultas, fotos e contatos primários.',
      rulesDesc: [
        'Lançamento ágil de relatórios de abordagens operacionais.',
        'Criação de fichas cadastrais de suspeitos abordados em flagrante.',
        'Visualização e pesquisa na galeria de fotos estratégicas.',
        'Consulta territorial a mapas interativos de calor.'
      ],
      dbPermissions: {
        read: 'Permitido para dados de abordagem e indivíduos da unidade',
        write: 'Criação de documentos sob auditoria de nome logado',
        delete: 'Estritamente proibido'
      }
    },
    [UserRole.PATRULHEIRO]: {
      role: UserRole.PATRULHEIRO,
      label: 'PATRULHEIRO (Usuário Consulta)',
      colorClass: 'bg-slate-600 border-slate-700 text-white',
      borderClass: 'border-slate-600',
      bgClass: 'bg-slate-500/10 hover:bg-slate-500/20',
      badgeClass: 'bg-slate-500/20 text-slate-700 border border-slate-500/30',
      textColorClass: 'text-slate-800',
      icon: <Users className="w-5 h-5 text-slate-600" />,
      clearance: 'Nível 1 - Pesquisa e Reconhecimento',
      description: 'Membro operacional focado no reconhecimento visual preventivo em patrulhamento de ronda eletrônica.',
      rulesDesc: [
        'Consulta de dados de suspeitos em campo por alcunha ou documento.',
        'Acesso à galeria visual para averiguação de comparsas de facções.',
        'Localização espacial de hotzones criminosas no mapa.',
        'Bloqueio automático de criação ou alteração de registros no banco.'
      ],
      dbPermissions: {
        read: 'Consulta tática às tabelas de inteligência',
        write: 'Restrito (Apenas leitura autorizada no dispositivo embarcado)',
        delete: 'Estritamente proibido'
      }
    }
  };

  const pageLogics = [
    {
      id: 'dashboard',
      title: 'DASHBOARD PRINCIPAL (/)',
      icon: <Cpu className="w-4 h-4 text-navy-800" />,
      features: [
        'Painel dinâmico consolidado de serviços ativos (vtr_services).',
        'Controle de alertas táticos imediatos visíveis para toda a tropa.',
        'Métricas rápidas e atalhos para os principais subsistemas.',
        'Abertura de serviço ativo (Guarnição) associando VTR, comandante, motoristas e patrulheiros em tempo real.'
      ],
      rolesAllowed: [UserRole.MASTER, UserRole.ADMIN, UserRole.SUPERVISOR_DE_OPERACOES, UserRole.CHEFE_DE_EQUIPE, UserRole.OPERATOR, UserRole.PATRULHEIRO],
      firebaseLogic: 'Lê dados de "vtr_services" onde status == "ATIVO". A criação de "vtr_services" e "alerts" exige conta autenticada. A edição de "vtr_services" é autoral ou administrativa, exigindo validação de nome de comandante e motorista.',
      operationalLogic: 'Para lançar ações ou fechar parciais da equipe, o sistema tenta sincronizar o nome do usuário ativo com uma guarnição em serviço no banco. Se localizado, vincula automaticamente o PREFIX da viatura e os militares envolvidos. Se nenhum serviço for localizado, permite operação avulsa.'
    },
    {
      id: 'abordagens',
      title: 'CADASTRO & FILTRO DE ABORDAGENS',
      icon: <Users className="w-4 h-4 text-indigo-700" />,
      features: [
        'Registro de dados completos de aproximação militar (data, hora, coordenadas xeográficas, veículos, reportagem tática).',
        'Busca refinada por placa, cidadão, unidade responsável, palavras de relatório ou intervalo cronológico.',
        'Associação direta do histórico ao prontuário eletrônico de um indivíduo.'
      ],
      rolesAllowed: [UserRole.MASTER, UserRole.ADMIN, UserRole.SUPERVISOR_DE_OPERACOES, UserRole.CHEFE_DE_EQUIPE, UserRole.OPERATOR],
      firebaseLogic: 'Armazenado em coleções "approaches". Regra de segurança: leitura permitida para autenticados da mesma Unidade militar do registro (ou Geral para Master/Admin). Gravação validada por isValidApproach() garantindo campos como data, horário e local presentes.',
      operationalLogic: 'Ao salvar, opcionalmente anexa coordenadas ou gera novos pontos geográficos. Se o indivíduo associado tiver fotos anexas à abordagem, elas são correlacionadas no repositório de correspondência.'
    },
    {
      id: 'fichas',
      title: 'INDIVÍDUOS, FACÇÕES & ANOTAÇÕES CONFIDENCIAIS',
      icon: <FileText className="w-4 h-4 text-emerald-700" />,
      features: [
        'Prontuário de indivíduos sob suspeição comercial ou de facção criminosa.',
        'Seção confidencial criptografada local de anotações e informantes.',
        'Seção estruturada de vínculos de parentesco ou comparsas criminais.',
        'Armazenamento indexado de fotos de identificação de alta resolução.'
      ],
      rolesAllowed: [UserRole.MASTER, UserRole.ADMIN, UserRole.SUPERVISOR_DE_OPERACOES, UserRole.CHEFE_DE_EQUIPE, UserRole.OPERATOR, UserRole.PATRULHEIRO],
      firebaseLogic: 'Regras em "individuals" e "confidential_info". Escrita restrita a operadores qualificados. Dados complexos de anotações confidenciais ("confidential_info") só são visíveis por integrantes credenciados. Registros vinculados validam ID de destino.',
      operationalLogic: 'Diferencial de faccionamento: registra autoria de quem estabeleceu associação de facção para blindagem legal. Seções de anexos permitem download ou visualização de laudos em PDF anexados diretamente.'
    },
    {
      id: 'parte-diaria',
      title: 'PARTE DIÁRIA & AÇÕES RÁPIDAS',
      icon: <FileText className="w-4 h-4 text-amber-700" />,
      features: [
        'Livro virtual de registros e ocorrências do turno militar.',
        'Formulário extensivo de fardamentos, materiais, armamento (carga da VTR) e passageiros.',
        'Interface unificada de "Lançamento de Ações Rápidas" onde em menos de 10 segundos o operador reporta pessoas, motocicletas, barcos ou armas apreendidas em rondas.'
      ],
      rolesAllowed: [UserRole.MASTER, UserRole.ADMIN, UserRole.SUPERVISOR_DE_OPERACOES, UserRole.CHEFE_DE_EQUIPE],
      firebaseLogic: 'Tabelas "parte_diaria" e "daily_actions". Daily Action requer validação de payload completo (tipo_acao, quantidade, detalhes, categoria, unidade, criado_por_id). Apenas MASTER ou ADMIN possuem autorização para deletar registros já inseridos.',
      operationalLogic: 'Daily Actions suporta dados dinâmicos: Ao reportar abordagens veiculares, pede placa e moto/carro. Ao reportar acidentes de trânsito, o sistema abre uma interface para indexação de gênero e idade de múltiplas vítimas ao mesmo tempo, persistindo os dados estruturados em JSON no Firestore.'
    },
    {
      id: 'organogramas-crime',
      title: 'ORGANOGRAMAS DO CRIME',
      icon: <Network className="w-4 h-4 text-yellow-600" />,
      features: [
        'Representação em grafos ramificados das hierarquias de facções.',
        'Diferenciação automática de cargos de chefia: Distribuidores, Bocas, Vapores e Usuários.',
        'Permite ligar graficamente chefes a subordinados por drag-and-drop e conexões de rede.'
      ],
      rolesAllowed: [UserRole.MASTER],
      firebaseLogic: 'Coleções "crime_groups" e "crime_members". restrições explícitas de leitura e escrita exclusivamente para o perfil MASTER (isMaster() == true). Qualquer tentativa de leitura por outros perfis retorna rejeição pelo Firestore.',
      operationalLogic: 'Focado em alta inteligência de investigação criminal. Permite mapear células, rotas de abastecimento e faturamento estratégico.'
    },
    {
      id: 'operadores',
      title: 'GERENCIAMENTO DE OPERADORES & EXTRA UNIDADES',
      icon: <Key className="w-4 h-4 text-red-600" />,
      features: [
        'Cadastro e auditoria cadastral de oficiais militares autorizados.',
        'Reset forçado de senhas com flag de "primeiro_acesso" obrigatório para redefinição no próximo login.',
        'Configuração de Unidade Padrão e de "Unidades Extras" para visualizações cruzadas de relatórios.'
      ],
      rolesAllowed: [UserRole.MASTER, UserRole.ADMIN, UserRole.SUPERVISOR_DE_OPERACOES],
      firebaseLogic: 'Coleção "users" regrada por isValidUser(). Apenas administradores oficiais (isAdmin() ou isMaster()) podem invocar modificações, registrar novos operadores, ou redefinir criptografia de senhas internas.',
      operationalLogic: 'Ao definir unidades_extras, o operador ganha passe nas consultas do sistema para ler relatórios de outras companhias, burlando dinamicamente as restrições de isolamento por unidade de serviço.'
    },
    {
      id: 'auditoria-logs',
      title: 'AUDITORIA DE logs / SISTEMA',
      icon: <Database className="w-4 h-4 text-blue-700" />,
      features: [
        'Rastros digitais imutáveis de cada ação perpetrada na plataforma.',
        'ID do executor, nome de guerra, código de ação e string descritiva.',
        'Identificador do documento lido ou modificado para investigação direta.'
      ],
      rolesAllowed: [UserRole.MASTER, UserRole.ADMIN, UserRole.SUPERVISOR_DE_OPERACOES],
      firebaseLogic: 'Coleção "logs" estruturada por triggers automatizados de gravação. Não há permissão de modificação ou exclusão de logs em nenhuma regra (allow update, delete: if false). Histórico é eterno.',
      operationalLogic: 'Toda exclusão efetuada por administradores em relatórios, abordagens ou exclusão de usuários grava implicitamente um log de severidade "DELETE_WARNING" facilitando auditorias internas futuras.'
    }
  ];

  return (
    <div className="bg-white border border-navy-100 rounded-3xl p-6 md:p-8 shadow-xl space-y-8 animate-in fade-in duration-300">
      {/* Botão de retorno e Intro */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-navy-50">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="bg-navy-950 p-2.5 rounded-xl text-white">
              <Network className="w-5 h-5 text-lime-400" />
            </div>
            <h3 className="text-xl font-black text-navy-950 uppercase tracking-tighter">
              Organograma Tático de Perfis & Segurança
            </h3>
          </div>
          <p className="text-[10px] text-navy-400 font-bold uppercase tracking-widest">
            Visualização de árvore estrutural de acessos e regras lógicas de banco
          </p>
        </div>

        <button
          onClick={onBack}
          className="bg-navy-50 border border-navy-100 text-navy-950 hover:bg-navy-100 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 active:scale-95 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar às Configurações
        </button>
      </div>

      {/* QUADRO INTERATIVO DO ORGANOGRAMA (SISTEMA RAMIFICADO COM LINHAS CONECTORAS) */}
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-red-600 animate-pulse" />
          <h4 className="font-black text-xs uppercase tracking-wider text-navy-950">
            Estrutura Ramificada de Autorização de Contas
          </h4>
        </div>

        {/* Árvore Ramificada Estilizada */}
        <div className="bg-navy-950 text-white rounded-3xl p-6 md:p-8 border border-navy-900 shadow-inner space-y-8 overflow-x-auto">
          <div className="min-w-[640px] flex flex-col items-center">
            
            {/* Raiz / Nível Principal - MASTER */}
            <div className="flex flex-col items-center relative pb-8">
              <button
                onClick={() => setSelectedRoleBranch(UserRole.MASTER)}
                className={`flex flex-col items-center p-4 bg-gradient-to-br from-amber-950/45 to-amber-900/30 border-2 rounded-2xl w-56 text-center transition-all duration-300 relative z-10 ${
                  selectedRoleBranch === UserRole.MASTER 
                    ? 'border-amber-400 ring-4 ring-amber-400/20 shadow-xl shadow-amber-500/10 scale-105' 
                    : 'border-amber-500/40 hover:border-amber-400 shadow-md hover:shadow-amber-500/5'
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center mb-2 animate-bounce">
                  <Crown className="w-5 h-5 text-amber-400" />
                </div>
                <span className="font-black text-xxs tracking-widest text-amber-400 uppercase">NÍVEL 5 (SUPREMO)</span>
                <span className="text-xs font-black uppercase tracking-tight text-white mt-1">PERFIL MASTER</span>
                <span className="text-[9px] text-amber-300 uppercase font-bold mt-1">Acesso Irrestrito / Intel</span>
              </button>

              {/* Linha vertical descendo do Master */}
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0.5 h-8 bg-dashed border-r border-navy-800"></div>
            </div>

            {/* Divisor horizontal para Administrativos */}
            <div className="w-[50%] h-0.5 border-t-2 border-dashed border-navy-800 relative">
              <div className="absolute top-0 left-0 w-0.5 h-6 bg-dashed border-r border-navy-800"></div>
              <div className="absolute top-0 right-0 w-0.5 h-6 bg-dashed border-r border-navy-800"></div>
            </div>

            {/* Nível Administrativo/Supervisão: ADMIN & SUPERVISOR */}
            <div className="flex items-start justify-around w-full max-w-4xl pt-6 pb-8 relative">
              
              {/* ADMIN Card */}
              <div className="flex flex-col items-center relative">
                <button
                  onClick={() => setSelectedRoleBranch(UserRole.ADMIN)}
                  className={`flex flex-col items-center p-4 bg-gradient-to-br from-indigo-950/45 to-indigo-900/30 border-2 rounded-2xl w-52 text-center transition-all duration-300 relative z-10 ${
                    selectedRoleBranch === UserRole.ADMIN 
                      ? 'border-indigo-400 ring-4 ring-indigo-400/20 shadow-xl shadow-indigo-500/10 scale-105' 
                      : 'border-indigo-500/40 hover:border-indigo-400 shadow-md hover:shadow-indigo-500/5'
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center mb-2">
                    <Key className="w-5 h-5 text-indigo-400" />
                  </div>
                  <span className="font-black text-xxs tracking-widest text-indigo-400 uppercase">NÍVEL 4 (TECNOLOGIA)</span>
                  <span className="text-xs font-black uppercase tracking-tight text-white mt-1">PERFIL ADMIN</span>
                  <span className="text-[9px] text-indigo-300 uppercase font-bold mt-1">Controle de Frota & Contas</span>
                </button>
                {/* Linha conectiva vertical */}
                <div className="absolute bottom-[-16px] left-1/2 -translate-x-1/2 w-0.5 h-4 bg-dashed border-r border-navy-800"></div>
              </div>

              {/* SUPERVISOR Card */}
              <div className="flex flex-col items-center relative">
                <button
                  onClick={() => setSelectedRoleBranch(UserRole.SUPERVISOR_DE_OPERACOES)}
                  className={`flex flex-col items-center p-4 bg-gradient-to-br from-purple-950/45 to-purple-900/30 border-2 rounded-2xl w-52 text-center transition-all duration-300 relative z-10 ${
                    selectedRoleBranch === UserRole.SUPERVISOR_DE_OPERACOES 
                      ? 'border-purple-400 ring-4 ring-purple-400/20 shadow-xl shadow-purple-500/10 scale-105' 
                      : 'border-purple-500/40 hover:border-purple-400 shadow-md hover:shadow-purple-500/5'
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center mb-2">
                    <Eye className="w-5 h-5 text-purple-400" />
                  </div>
                  <span className="font-black text-xxs tracking-widest text-purple-400 uppercase">NÍVEL 3 (COORDENAÇÃO)</span>
                  <span className="text-xs font-black uppercase tracking-tight text-white mt-1">SUPERVISOR DE OP.</span>
                  <span className="text-[9px] text-purple-300 uppercase font-bold mt-1">Escala Geral & Ocorrências</span>
                </button>
                {/* Linha conectiva vertical */}
                <div className="absolute bottom-[-16px] left-1/2 -translate-x-1/2 w-0.5 h-4 bg-dashed border-r border-navy-800"></div>
              </div>

            </div>

            {/* Divisor horizontal largo para Operacionais de Campo */}
            <div className="w-[85%] h-0.5 border-t-2 border-dashed border-navy-800 relative">
              <div className="absolute top-0 left-0 w-0.5 h-6 bg-dashed border-r border-navy-800"></div>
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-6 bg-dashed border-r border-navy-800"></div>
              <div className="absolute top-0 right-0 w-0.5 h-6 bg-dashed border-r border-navy-800"></div>
            </div>

            {/* Nível Operacional de Campo: CHEFE EQUIPE, OPERATOR, PATRULHEIRO */}
            <div className="flex items-start justify-between w-full pt-6 relative gap-4">
              
              {/* CHEFE DE EQUIPE */}
              <div className="flex-1 flex flex-col items-center">
                <button
                  onClick={() => setSelectedRoleBranch(UserRole.CHEFE_DE_EQUIPE)}
                  className={`flex flex-col items-center p-4 bg-gradient-to-br from-emerald-950/45 to-emerald-900/30 border-2 rounded-2xl w-48 text-center transition-all duration-300 relative z-10 ${
                    selectedRoleBranch === UserRole.CHEFE_DE_EQUIPE 
                      ? 'border-emerald-400 ring-4 ring-emerald-400/20 shadow-xl shadow-emerald-500/10 scale-105' 
                      : 'border-emerald-500/40 hover:border-emerald-400 shadow-md hover:shadow-emerald-500/5'
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mb-2">
                    <UserCheck className="w-4 h-4 text-emerald-400" />
                  </div>
                  <span className="font-black text-[7px] tracking-widest text-emerald-400 uppercase">NÍVEL 2 (LIDERANÇA)</span>
                  <span className="text-xs font-black uppercase tracking-tight text-white mt-1 leading-none">CHEFE DE EQUIPE</span>
                  <span className="text-[8px] text-emerald-300 uppercase font-bold mt-1.5 leading-none">Cmt de VTR & Parte Diária</span>
                </button>
              </div>

              {/* OPERATOR */}
              <div className="flex-1 flex flex-col items-center">
                <button
                  onClick={() => setSelectedRoleBranch(UserRole.OPERATOR)}
                  className={`flex flex-col items-center p-4 bg-gradient-to-br from-cyan-950/45 to-cyan-900/30 border-2 rounded-2xl w-48 text-center transition-all duration-300 relative z-10 ${
                    selectedRoleBranch === UserRole.OPERATOR 
                      ? 'border-cyan-400 ring-4 ring-cyan-400/20 shadow-xl shadow-cyan-500/10 scale-105' 
                      : 'border-cyan-500/40 hover:border-cyan-400 shadow-md hover:shadow-cyan-500/5'
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center mb-2">
                    <Terminal className="w-4 h-4 text-cyan-400" />
                  </div>
                  <span className="font-black text-[7px] tracking-widest text-cyan-400 uppercase">NÍVEL 1 (ESCRITA)</span>
                  <span className="text-xs font-black uppercase tracking-tight text-white mt-1 leading-none">OPERADOR</span>
                  <span className="text-[8px] text-cyan-300 uppercase font-bold mt-1.5 leading-none">Abordagem & Prontuário</span>
                </button>
              </div>

              {/* PATRULHEIRO */}
              <div className="flex-1 flex flex-col items-center">
                <button
                  onClick={() => setSelectedRoleBranch(UserRole.PATRULHEIRO)}
                  className={`flex flex-col items-center p-4 bg-gradient-to-br from-slate-950/45 to-slate-900/30 border-2 rounded-2xl w-48 text-center transition-all duration-300 relative z-10 ${
                    selectedRoleBranch === UserRole.PATRULHEIRO 
                      ? 'border-slate-400 ring-4 ring-slate-400/20 shadow-xl shadow-slate-500/10 scale-105' 
                      : 'border-slate-500/40 hover:border-slate-400 shadow-md hover:shadow-slate-500/5'
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-slate-500/20 border border-slate-500/30 flex items-center justify-center mb-2">
                    <Users className="w-4 h-4 text-slate-400" />
                  </div>
                  <span className="font-black text-[7px] tracking-widest text-slate-400 uppercase">NÍVEL 1 (CONSULTA)</span>
                  <span className="text-xs font-black uppercase tracking-tight text-white mt-1 leading-none">PATRULHEIRO</span>
                  <span className="text-[8px] text-slate-300 uppercase font-bold mt-1.5 leading-none">Averiguações & Hotzones</span>
                </button>
              </div>

            </div>

          </div>

          <p className="text-center text-[9px] text-navy-400 font-bold uppercase tracking-widest pt-4">
            * Clique em qualquer perfil do organograma para ver as lógicas e restrições detalhadas
          </p>
        </div>
      </div>

      {/* PAINEL DETALHADO DO PERFIL SELECIONADO NO ORGANOGRAMA */}
      {selectedRoleBranch && (
        <div className="bg-navy-50 border border-navy-150 rounded-3xl p-6 space-y-4 animate-in slide-in-from-top-4 duration-300">
          <div className="flex items-center justify-between border-b border-navy-100 pb-3">
            <div className="flex items-center gap-3">
              {roleConfigs[selectedRoleBranch].icon}
              <h4 className="font-black text-sm uppercase text-navy-950 tracking-tight">
                {roleConfigs[selectedRoleBranch].label}
              </h4>
            </div>
            <button
              onClick={() => setSelectedRoleBranch(null)}
              className="text-[10px] text-navy-400 font-bold hover:text-navy-950 uppercase tracking-widest"
            >
              Recolher Detalhes
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <span className="text-[8px] font-black text-navy-400 uppercase tracking-widest">Nível de Liberação</span>
                <p className="text-xs font-bold text-navy-900 mt-0.5">{roleConfigs[selectedRoleBranch].clearance}</p>
              </div>
              <div>
                <span className="text-[8px] font-black text-navy-400 uppercase tracking-widest">Atribuições</span>
                <p className="text-xs text-navy-700 leading-relaxed font-semibold mt-1">
                  {roleConfigs[selectedRoleBranch].description}
                </p>
              </div>
              <div>
                <span className="text-[8px] font-black text-navy-400 uppercase tracking-widest">Limites em Banco de Dados (Firestore)</span>
                <div className="mt-2 space-y-1.5 font-mono text-[10px] bg-white border border-navy-100 p-3 rounded-2xl">
                  <p><span className="font-black text-indigo-900 uppercase">LEITURA:</span> {roleConfigs[selectedRoleBranch].dbPermissions.read}</p>
                  <p><span className="font-black text-emerald-900 uppercase">ESCRITA:</span> {roleConfigs[selectedRoleBranch].dbPermissions.write}</p>
                  <p><span className="font-black text-red-900 uppercase">EXCLUSÃO:</span> {roleConfigs[selectedRoleBranch].dbPermissions.delete}</p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-navy-100 rounded-2xl p-4 space-y-3">
              <span className="text-[8px] font-black text-navy-400 uppercase tracking-widest block">Capacidades Autorais (Logica Militar):</span>
              <ul className="space-y-2">
                {roleConfigs[selectedRoleBranch].rulesDesc.map((rule, idx) => (
                  <li key={idx} className="text-xxs font-black uppercase text-navy-700 tracking-tight flex items-start gap-2">
                    <CheckCircle className="w-3.5 h-3.5 text-navy-950 shrink-0 mt-0.5" />
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ACCORDION EXPANSÍVEL ABAIXO - LOGICAS DE PÁGINAS DO ADMINISTRADOR */}
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-navy-950" />
          <h4 className="font-black text-xs uppercase tracking-wider text-navy-950">
            Especificações de Carga, Lógicas e Acesso por Página
          </h4>
        </div>

        <div className="border border-navy-100 rounded-3xl overflow-hidden divide-y divide-navy-100">
          {pageLogics.map((page) => {
            const isExpanded = expandedPage === page.id;

            return (
              <div key={page.id} className="bg-white hover:bg-navy-50/20 transition-colors">
                {/* Header do item do Accordion */}
                <button
                  onClick={() => setExpandedPage(isExpanded ? null : page.id)}
                  className="w-full flex items-center justify-between p-5 text-left active:bg-navy-50 transition-colors outline-none"
                >
                  <div className="flex items-center space-x-3.5">
                    <div className="bg-navy-50 p-2.5 rounded-xl border border-navy-100">
                      {page.icon}
                    </div>
                    <div>
                      <h5 className="font-black text-xs uppercase text-navy-950 tracking-tight">
                        {page.title}
                      </h5>
                      <p className="text-[9px] text-navy-400 font-bold uppercase mt-0.5">
                        Lógica de validação integrada e roteiros
                      </p>
                    </div>
                  </div>

                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-navy-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-navy-400" />
                  )}
                </button>

                {/* Conteúdo expandido */}
                {isExpanded && (
                  <div className="p-6 md:px-8 pb-8 bg-navy-50/40 border-t border-navy-50 space-y-6 animate-in slide-in-from-top-2 duration-200">
                    {/* Tags de Perfis Permitidos */}
                    <div className="space-y-2">
                      <span className="text-[8px] font-black text-navy-400 uppercase tracking-widest block">Perfis com Credenciais Habilitadas:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {page.rolesAllowed.map((r) => (
                          <span
                            key={r}
                            className={`px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${roleConfigs[r].badgeClass}`}
                          >
                            {r}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Funcionalidades principais */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-white border border-navy-100 rounded-2xl p-5 space-y-3 shadow-xs">
                        <span className="text-[8px] font-black text-navy-400 uppercase tracking-widest block">Ações Disponíveis na Página</span>
                        <ul className="space-y-2">
                          {page.features.map((feat, i) => (
                            <li key={i} className="text-xxs font-black text-navy-700 tracking-tight uppercase flex items-start gap-2.5 leading-relaxed">
                              <span className="w-1.5 h-1.5 rounded-full bg-navy-950 shrink-0 mt-1.5"></span>
                              <span>{feat}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Lógicas de Back e Regra de Segurança */}
                      <div className="space-y-4">
                        <div className="bg-white border border-navy-100 rounded-2xl p-5 shadow-xs space-y-2">
                          <div className="flex items-center gap-2">
                            <Database className="w-3.5 h-3.5 text-navy-950" />
                            <span className="text-[8px] font-black text-navy-400 uppercase tracking-widest">Segurança de Banco de Dados</span>
                          </div>
                          <p className="text-[10px] text-navy-700 leading-relaxed font-semibold font-mono bg-navy-400/5 p-3 rounded-xl border border-dotted border-navy-200">
                            {page.firebaseLogic}
                          </p>
                        </div>

                        <div className="bg-white border border-navy-100 rounded-2xl p-5 shadow-xs space-y-2">
                          <div className="flex items-center gap-2">
                            <Info className="w-3.5 h-3.5 text-navy-950" />
                            <span className="text-[8px] font-black text-navy-400 uppercase tracking-widest">Lógica Operacional de Negócio</span>
                          </div>
                          <p className="text-[10px] text-navy-600 leading-relaxed font-bold uppercase">
                            {page.operationalLogic}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
