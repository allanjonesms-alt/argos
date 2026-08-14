import React, { useState } from 'react';
import { User, UserRole, Unit } from '../types';
import { ArrowLeft, Save, Trash2, Plus, Award, BookOpen, Clock, Calendar, Users, Briefcase, User as UserIcon, Shield } from 'lucide-react';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

interface ProfileEditorProps {
  userToEdit: User | null;
  onSave: (updatedUser: User) => Promise<void>;
  onCancel: () => void;
  onDelete?: (userToDelete: User) => void;
  units: Unit[];
  isSaving: boolean;
  isCreation?: boolean;
}

type TabType = 'pessoal' | 'funcional' | 'acesso' | 'licencas' | 'cursos' | 'promocoes' | 'dependentes' | 'averbacoes';

export function ProfileEditor({ userToEdit, onSave, onCancel, onDelete, units, isSaving, isCreation = false }: ProfileEditorProps) {
  const initialNewUser: User = {
    id: '',
    matricula: '',
    nome: '',
    nome_completo: '',
    senha: '@Senha123',
    role: UserRole.OPERATOR,
    primeiro_acesso: false,
    ord: 0,
    unidade: '',
    unidades_extras: [],
    dependentes: [],
    cursos: [],
    promocoes: [],
    averbacao: [],
    deducao: [],
    licenca_especial: {
      concessao: {
        primeiroDecenio: { bcg: '', dataBcg: '', qtdDias: '' },
        segundoDecenio: { bcg: '', dataBcg: '', qtdDias: '' },
        terceiroDecenio: { bcg: '', dataBcg: '', qtdDias: '' }
      },
      fruicao: {
        primeiroDecenio: { bcg: '', dataBcg: '', qtdDias: '' },
        segundoDecenio: { bcg: '', dataBcg: '', qtdDias: '' },
        terceiroDecenio: { bcg: '', dataBcg: '', qtdDias: '' }
      }
    }
  };

  const [user, setUser] = useState<User>(() => {
    const base = userToEdit || initialNewUser;
    return {
      ...base,
      dependentes: base.dependentes || [],
      cursos: base.cursos || [],
      promocoes: base.promocoes || [],
      averbacao: base.averbacao || [],
      deducao: base.deducao || [],
      licenca_especial: base.licenca_especial || initialNewUser.licenca_especial
    };
  });

  const [isCheckingMatricula, setIsCheckingMatricula] = useState(false);
  const [matriculaExists, setMatriculaExists] = useState(false);
  const [error, setError] = useState('');

  const checkMatricula = async (matricula: string) => {
    if (!isCreation || matricula.trim().length < 2) {
      setMatriculaExists(false);
      return;
    }
    setIsCheckingMatricula(true);
    try {
      const q = query(collection(db, 'users'), where('matricula', '==', matricula.trim()));
      const snap = await getDocs(q);
      const hasRealDuplicate = snap.docs.some(doc => {
        const data = doc.data();
        return !data.is_session && data.ord !== 99 && doc.id !== userToEdit?.id;
      });
      setMatriculaExists(hasRealDuplicate);
    } catch (err) {
      console.error("Erro ao verificar matrícula:", err);
    } finally {
      setIsCheckingMatricula(false);
    }
  };

  const [activeTab, setActiveTab] = useState<TabType>('pessoal');

  // Input states for new items
  const [newCurso, setNewCurso] = useState({ ano: '', curso: '', local: '' });
  const [editingCursoId, setEditingCursoId] = useState<string | null>(null);
  const [newPromo, setNewPromo] = useState({ postoGrad: '', doe: '', dataDoe: '', dataPromocao: '' });
  const [editingPromoId, setEditingPromoId] = useState<string | null>(null);
  const [newDep, setNewDep] = useState({ nome: '', tipo: '', dataNascimento: '' });
  const [newAver, setNewAver] = useState({ tipo: '', totalDias: '', doe: '', nrCertidao: '', dataCertidao: '', dataPublicacao: '' });
  const [newDed, setNewDed] = useState({ tipo: '', totalDias: '', doe: '', nrCertidao: '', dataCertidao: '', dataPublicacao: '' });

  const handleFieldChange = (field: keyof User, value: any) => {
    setUser(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const setLicencaValue = (type: 'concessao' | 'fruicao', decenio: 'primeiroDecenio' | 'segundoDecenio' | 'terceiroDecenio', field: 'bcg' | 'dataBcg' | 'qtdDias', value: string) => {
    setUser(prev => {
      const le = prev.licenca_especial ? { ...prev.licenca_especial } : {};
      const t = le[type] ? { ...le[type] } : {};
      const d = t[decenio] ? { ...t[decenio] } : {};
      
      return {
        ...prev,
        licenca_especial: {
          ...le,
          [type]: {
            ...t,
            [decenio]: {
              ...d,
              [field]: value
            }
          }
        }
      };
    });
  };

  const getLicencaValue = (type: 'concessao' | 'fruicao', decenio: 'primeiroDecenio' | 'segundoDecenio' | 'terceiroDecenio', field: 'bcg' | 'dataBcg' | 'qtdDias'): string => {
    return user.licenca_especial?.[type]?.[decenio]?.[field] || '';
  };

  // List management - Cursos
  const addCurso = () => {
    if (!newCurso.curso || !newCurso.ano) return;
    
    if (editingCursoId) {
      setUser(prev => ({
        ...prev,
        cursos: (prev.cursos || []).map((c: any) => c.id === editingCursoId ? { ...newCurso, id: editingCursoId } : c)
      }));
      setEditingCursoId(null);
    } else {
      const item = { ...newCurso, id: Math.random().toString(36).substring(2, 9) };
      setUser(prev => ({
        ...prev,
        cursos: [...(prev.cursos || []), item]
      }));
    }
    setNewCurso({ ano: '', curso: '', local: '' });
  };

  const editCurso = (id: string) => {
    const curso = user.cursos?.find((c: any) => c.id === id);
    if (curso) {
      setNewCurso({ ano: curso.ano || '', curso: curso.curso || '', local: curso.local || '' });
      setEditingCursoId(id);
    }
  };

  const cancelEditCurso = () => {
    setNewCurso({ ano: '', curso: '', local: '' });
    setEditingCursoId(null);
  };

  const removeCurso = (id: string) => {
    setUser(prev => ({
      ...prev,
      cursos: (prev.cursos || []).filter((c: any) => c.id !== id)
    }));
  };

  // List management - Promocoes
  const addPromo = () => {
    if (!newPromo.postoGrad || !newPromo.dataPromocao) return;
    
    if (editingPromoId) {
      setUser(prev => ({
        ...prev,
        promocoes: (prev.promocoes || []).map((p: any) => p.id === editingPromoId ? { ...newPromo, id: editingPromoId } : p)
      }));
      setEditingPromoId(null);
    } else {
      const item = { ...newPromo, id: Math.random().toString(36).substring(2, 9) };
      setUser(prev => ({
        ...prev,
        promocoes: [...(prev.promocoes || []), item]
      }));
    }
    setNewPromo({ postoGrad: '', doe: '', dataDoe: '', dataPromocao: '' });
  };

  const editPromo = (id: string) => {
    const promo = user.promocoes?.find((p: any) => p.id === id);
    if (promo) {
      setNewPromo({ postoGrad: promo.postoGrad || '', doe: promo.doe || '', dataDoe: promo.dataDoe || '', dataPromocao: promo.dataPromocao || '' });
      setEditingPromoId(id);
    }
  };

  const cancelEditPromo = () => {
    setNewPromo({ postoGrad: '', doe: '', dataDoe: '', dataPromocao: '' });
    setEditingPromoId(null);
  };

  const removePromo = (id: string) => {
    setUser(prev => ({
      ...prev,
      promocoes: (prev.promocoes || []).filter((p: any) => p.id !== id)
    }));
  };

  // List management - Dependentes
  const addDependent = () => {
    if (!newDep.nome || !newDep.tipo) return;
    const item = { ...newDep, id: Math.random().toString(36).substring(2, 9) };
    setUser(prev => ({
      ...prev,
      dependentes: [...(prev.dependentes || []), item]
    }));
    setNewDep({ nome: '', tipo: '', dataNascimento: '' });
  };

  const removeDependent = (id: string) => {
    setUser(prev => ({
      ...prev,
      dependentes: (prev.dependentes || []).filter((d: any) => d.id !== id)
    }));
  };

  // List management - Averbacoes
  const addAver = () => {
    if (!newAver.tipo || !newAver.totalDias) return;
    const item = { ...newAver, id: Math.random().toString(36).substring(2, 9) };
    setUser(prev => ({
      ...prev,
      averbacao: [...(prev.averbacao || []), item]
    }));
    setNewAver({ tipo: '', totalDias: '', doe: '', nrCertidao: '', dataCertidao: '', dataPublicacao: '' });
  };

  const removeAver = (id: string) => {
    setUser(prev => ({
      ...prev,
      averbacao: (prev.averbacao || []).filter((a: any) => a.id !== id)
    }));
  };

  // List management - Deducoes
  const addDed = () => {
    if (!newDed.tipo || !newDed.totalDias) return;
    const item = { ...newDed, id: Math.random().toString(36).substring(2, 9) };
    setUser(prev => ({
      ...prev,
      deducao: [...(prev.deducao || []), item]
    }));
    setNewDed({ tipo: '', totalDias: '', doe: '', nrCertidao: '', dataCertidao: '', dataPublicacao: '' });
  };

  const removeDed = (id: string) => {
    setUser(prev => ({
      ...prev,
      deducao: (prev.deducao || []).filter((d: any) => d.id !== id)
    }));
  };

  // Calculate Tempo Total (Tempo de Efetivo Serviço + Averbação)
  const calcularTempoTotal = () => {
    // Calculate Tempo de Efetivo Serviço
    let diasServico = 0;
    if (user.data_inclusao) {
      const dataInclusaoDate = new Date(user.data_inclusao + 'T00:00:00');
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const diffTime = hoje.getTime() - dataInclusaoDate.getTime();
      diasServico = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
    }
    
    // Calculate total days from averbação
    const averbacaoData = user.averbacao;
    const diasAverbacao = Array.isArray(averbacaoData) 
      ? averbacaoData.reduce((total: number, averb: any) => total + (parseInt(averb.totalDias) || 0), 0)
      : 0;
    
    const tempoTotalDias = diasServico + diasAverbacao;
    
    // Format the tempo total
    if (tempoTotalDias <= 0) return '';
    
    const anos = Math.floor(tempoTotalDias / 365);
    const restoDias = tempoTotalDias % 365;
    const meses = Math.floor(restoDias / 30);
    const dias = restoDias % 30;
    
    // Always show all units, even if zero
    const anosStr = `${anos.toString().padStart(2, '0')} ano${anos !== 1 ? 's' : ''}`;
    const mesesStr = `${meses.toString().padStart(2, '0')} ${meses !== 1 ? 'meses' : 'mês'}`;
    const diasStr = `${dias.toString().padStart(2, '0')} dia${dias !== 1 ? 's' : ''}`;
    
    return `${anosStr}, ${mesesStr} e ${diasStr}`;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user.nome || user.nome.trim() === "") {
      setError('O Nome de Guerra é obrigatório.');
      return;
    }
    if (!user.matricula || user.matricula.trim() === "") {
      setError('A Matrícula é obrigatória.');
      return;
    }
    if (isCreation && matriculaExists) {
      setError('Esta matrícula já está cadastrada.');
      return;
    }
    setError('');

    try {
      const updatedUser = {
        ...user,
        tempo_servico: calcularTempoTotal()
      };
      await onSave(updatedUser);
    } catch (err: any) {
      console.error('Erro ao salvar no ProfileEditor:', err);
      setError(err?.message || 'Ocorreu um erro ao salvar as alterações.');
    }
  };

  const menuTabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'pessoal', label: 'Dados Pessoais', icon: <UserIcon className="w-4 h-4" /> },
    { id: 'funcional', label: 'Dados Funcionais', icon: <Briefcase className="w-4 h-4" /> },
    { id: 'acesso', label: 'Acesso & Unidades', icon: <Shield className="w-4 h-4" /> },
    { id: 'licencas', label: 'Licenças Especiais', icon: <Calendar className="w-4 h-4" /> },
    { id: 'cursos', label: `Cursos (${user.cursos?.length || 0})`, icon: <BookOpen className="w-4 h-4" /> },
    { id: 'promocoes', label: `Promoções (${user.promocoes?.length || 0})`, icon: <Award className="w-4 h-4" /> },
    { id: 'dependentes', label: `Dependentes (${user.dependentes?.length || 0})`, icon: <Users className="w-4 h-4" /> },
    { id: 'averbacoes', label: 'Averbações & Deduções', icon: <Clock className="w-4 h-4" /> },
  ];

  return (
    <div className="bg-navy-900/5 border border-navy-100 rounded-3xl p-6 md:p-8 space-y-8 animate-fade-in">
      {/* Top Header Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-navy-100 pb-6">
        <div className="flex items-center gap-4">
          <button 
            type="button"
            onClick={onCancel}
            className="p-2.5 rounded-xl border border-navy-200 hover:bg-navy-100/50 text-navy-600 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <span className="text-[9px] font-black tracking-widest text-[#CB9E1B] uppercase">
              {isCreation ? 'Novo Registro Militar' : 'Ficha Individual Completa'}
            </span>
            <h3 className="text-2xl font-black text-navy-950 uppercase tracking-tight flex items-center gap-2">
              {isCreation ? 'NOVO MILITAR' : (user.rank ? `${user.rank.toUpperCase()} ` : '') + user.nome.toUpperCase()}
            </h3>
            <p className="text-xs text-navy-400 font-medium">
              {isCreation ? 'Preencha as abas para cadastrar a nova ficha' : `Matrícula: ${user.matricula}`}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          {onDelete && !isCreation && userToEdit && (
            <button
              type="button"
              onClick={() => onDelete(userToEdit)}
              className="px-5 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 active:scale-95"
            >
              <Trash2 className="w-4 h-4" /> Excluir Policial
            </button>
          )}
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2.5 border border-navy-200 text-navy-600 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-navy-100/50 transition-all"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || (isCreation && isCheckingMatricula)}
            className="px-6 py-2.5 bg-forest-600 hover:bg-forest-500 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-forest-600/15 transition-all flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <i className="fas fa-spinner fa-spin"></i> Salvando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" /> {isCreation ? 'Cadastrar Militar' : 'Salvar Ficha'}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Left Side Tab Navigation */}
        <div className="lg:col-span-1 flex flex-col gap-1">
          {menuTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-3 px-4 py-3.5 rounded-xl text-left text-xs font-black uppercase tracking-wider transition-all duration-150 ${
                activeTab === tab.id
                  ? 'bg-navy-950 text-white shadow-md'
                  : 'text-navy-600 hover:bg-navy-100/50 hover:text-navy-950'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Right Side Form Panel */}
        <div className="lg:col-span-3 bg-white border border-navy-100/80 rounded-2xl p-6 shadow-sm">
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-600 p-4 rounded-xl text-xs font-black uppercase text-center flex items-center justify-center gap-2 animate-pulse">
              <i className="fas fa-exclamation-circle"></i>
              <span>{error}</span>
            </div>
          )}
          <form onSubmit={handleSave} className="space-y-6">

            {/* TAB: PESSOAL */}
            {activeTab === 'pessoal' && (
              <div className="space-y-6 animate-fade-in">
                <div className="border-b border-navy-100 pb-3">
                  <h4 className="text-sm font-black text-navy-950 uppercase tracking-wider">Identificação & Dados Pessoais</h4>
                  <p className="text-xs text-navy-400">Informações civis fundamentais do operador</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-navy-600 uppercase tracking-widest mb-1.5">Nome de Guerra *</label>
                    <input 
                      type="text" 
                      required
                      value={user.nome || ''} 
                      onChange={e => handleFieldChange('nome', e.target.value.toUpperCase())}
                      className="w-full px-4 py-3 bg-navy-50/50 border border-navy-100 rounded-xl text-xs font-bold text-navy-950 focus:outline-none focus:border-navy-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-navy-600 uppercase tracking-widest mb-1.5">Nome Completo</label>
                    <input 
                      type="text" 
                      value={user.nome_completo || ''} 
                      onChange={e => handleFieldChange('nome_completo', e.target.value.toUpperCase())}
                      className="w-full px-4 py-3 bg-navy-50/50 border border-navy-100 rounded-xl text-xs font-bold text-navy-950 focus:outline-none focus:border-navy-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-navy-600 uppercase tracking-widest mb-1.5">CPF</label>
                    <input 
                      type="text" 
                      value={user.cpf || ''} 
                      onChange={e => handleFieldChange('cpf', e.target.value)}
                      placeholder="000.000.000-00"
                      className="w-full px-4 py-3 bg-navy-50/50 border border-navy-100 rounded-xl text-xs font-bold text-navy-950 focus:outline-none focus:border-navy-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-navy-600 uppercase tracking-widest mb-1.5">RG / Identidade Civil</label>
                    <input 
                      type="text" 
                      value={user.rg || ''} 
                      onChange={e => handleFieldChange('rg', e.target.value)}
                      className="w-full px-4 py-3 bg-navy-50/50 border border-navy-100 rounded-xl text-xs font-bold text-navy-950 focus:outline-none focus:border-navy-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-navy-600 uppercase tracking-widest mb-1.5">Sexo</label>
                    <select 
                      value={user.sexo || ''} 
                      onChange={e => handleFieldChange('sexo', e.target.value)}
                      className="w-full px-4 py-3 bg-navy-50/50 border border-navy-100 rounded-xl text-xs font-bold text-navy-950 focus:outline-none focus:border-navy-600"
                    >
                      <option value="">Selecione</option>
                      <option value="MASCULINO">MASCULINO</option>
                      <option value="FEMININO">FEMININO</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-navy-600 uppercase tracking-widest mb-1.5">Fator RH / Gr. Sanguíneo</label>
                    <select 
                      value={user.fator_rh || ''} 
                      onChange={e => handleFieldChange('fator_rh', e.target.value)}
                      className="w-full px-4 py-3 bg-navy-50/50 border border-navy-100 rounded-xl text-xs font-bold text-navy-950 focus:outline-none focus:border-navy-600"
                    >
                      <option value="">Selecione</option>
                      <option value="A+">A+</option>
                      <option value="A-">A-</option>
                      <option value="B+">B+</option>
                      <option value="B-">B-</option>
                      <option value="AB+">AB+</option>
                      <option value="AB-">AB-</option>
                      <option value="O+">O+</option>
                      <option value="O-">O-</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-navy-600 uppercase tracking-widest mb-1.5">Data de Nascimento</label>
                    <input 
                      type="date" 
                      value={user.data_nascimento || ''} 
                      onChange={e => handleFieldChange('data_nascimento', e.target.value)}
                      className="w-full px-4 py-3 bg-navy-50/50 border border-navy-100 rounded-xl text-xs font-bold text-navy-950 focus:outline-none focus:border-navy-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-navy-600 uppercase tracking-widest mb-1.5">Telefone Contato</label>
                    <input 
                      type="text" 
                      value={user.telefone || ''} 
                      onChange={e => handleFieldChange('telefone', e.target.value)}
                      placeholder="(00) 00000-0000"
                      className="w-full px-4 py-3 bg-navy-50/50 border border-navy-100 rounded-xl text-xs font-bold text-navy-950 focus:outline-none focus:border-navy-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-navy-600 uppercase tracking-widest mb-1.5">Naturalidade / Cidade</label>
                    <input 
                      type="text" 
                      value={user.naturalidade || ''} 
                      onChange={e => handleFieldChange('naturalidade', e.target.value.toUpperCase())}
                      className="w-full px-4 py-3 bg-navy-50/50 border border-navy-100 rounded-xl text-xs font-bold text-navy-950 focus:outline-none focus:border-navy-600"
                    />
                  </div>
                  <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-navy-600 uppercase tracking-widest mb-1.5">Pai</label>
                      <input 
                        type="text" 
                        value={user.pai || ''} 
                        onChange={e => handleFieldChange('pai', e.target.value.toUpperCase())}
                        className="w-full px-4 py-3 bg-navy-50/50 border border-navy-100 rounded-xl text-xs font-bold text-navy-950 focus:outline-none focus:border-navy-600"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-navy-600 uppercase tracking-widest mb-1.5">Mãe</label>
                      <input 
                        type="text" 
                        value={user.mae || ''} 
                        onChange={e => handleFieldChange('mae', e.target.value.toUpperCase())}
                        className="w-full px-4 py-3 bg-navy-50/50 border border-navy-100 rounded-xl text-xs font-bold text-navy-950 focus:outline-none focus:border-navy-600"
                      />
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-black text-navy-600 uppercase tracking-widest mb-1.5">Endereço Residencial</label>
                    <input 
                      type="text" 
                      value={user.endereco || ''} 
                      onChange={e => handleFieldChange('endereco', e.target.value.toUpperCase())}
                      className="w-full px-4 py-3 bg-navy-50/50 border border-navy-100 rounded-xl text-xs font-bold text-navy-950 focus:outline-none focus:border-navy-600"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB: FUNCIONAL */}
            {activeTab === 'funcional' && (
              <div className="space-y-6 animate-fade-in">
                <div className="border-b border-navy-100 pb-3">
                  <h4 className="text-sm font-black text-navy-950 uppercase tracking-wider">Dados Militares & Funcionais</h4>
                  <p className="text-xs text-navy-400">Informações de serviço, postos e credenciamento corporativo</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-navy-600 uppercase tracking-widest mb-1.5">Matrícula *</label>
                    <div className="relative">
                      <input 
                        type="text" 
                        required
                        value={user.matricula || ''} 
                        onChange={e => {
                          const val = e.target.value;
                          handleFieldChange('matricula', val);
                          if (isCreation) {
                            checkMatricula(val);
                          }
                        }}
                        className={`w-full px-4 py-3 bg-navy-50/50 border ${isCreation && matriculaExists ? 'border-red-500' : 'border-navy-100'} rounded-xl text-xs font-bold text-navy-950 focus:outline-none focus:border-navy-600`}
                      />
                      {isCreation && isCheckingMatricula && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <i className="fas fa-spinner fa-spin text-navy-400 text-xs"></i>
                        </div>
                      )}
                    </div>
                    {isCreation && matriculaExists && (
                      <p className="text-[8px] text-red-500 font-black uppercase mt-1 ml-2 tracking-widest">Matrícula já cadastrada</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-navy-600 uppercase tracking-widest mb-1.5">Posto / Graduação (Rank)</label>
                    <select 
                      value={user.rank || ''} 
                      onChange={e => handleFieldChange('rank', e.target.value)}
                      className="w-full px-4 py-3 bg-navy-50/50 border border-navy-100 rounded-xl text-xs font-bold text-navy-950 focus:outline-none focus:border-navy-600"
                    >
                      <option value="">Selecione</option>
                      <option value="Soldado">Soldado</option>
                      <option value="Cabo">Cabo</option>
                      <option value="3º Sargento">3º Sargento</option>
                      <option value="2º Sargento">2º Sargento</option>
                      <option value="1º Sargento">1º Sargento</option>
                      <option value="Subtenente">Subtenente</option>
                      <option value="2º Tenente">2º Tenente</option>
                      <option value="1º Tenente">1º Tenente</option>
                      <option value="Capitão">Capitão</option>
                      <option value="Major">Major</option>
                      <option value="Tenente-Coronel">Tenente-Coronel</option>
                      <option value="Coronel">Coronel</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-navy-600 uppercase tracking-widest mb-1.5">Perfil de Acesso (Role) *</label>
                    <select 
                      value={user.role} 
                      onChange={e => handleFieldChange('role', e.target.value as UserRole)}
                      className="w-full px-4 py-3 bg-navy-50/50 border border-navy-100 rounded-xl text-xs font-bold text-navy-950 focus:outline-none focus:border-navy-600"
                    >
                      <option value={UserRole.OPERATOR}>Operador Comum</option>
                      <option value={UserRole.ADMIN}>Administrador</option>
                      <option value={UserRole.MASTER}>Master</option>
                      <option value={UserRole.CHEFE_DE_EQUIPE}>Chefe de Equipe</option>
                      <option value={UserRole.PATRULHEIRO}>Patrulheiro</option>
                      <option value={UserRole.SUPERVISOR_DE_OPERACOES}>Supervisor de Operações</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-navy-600 uppercase tracking-widest mb-1.5">Unidade Principal</label>
                    <select 
                      value={user.unidade || ''} 
                      onChange={e => handleFieldChange('unidade', e.target.value)}
                      className="w-full px-4 py-3 bg-navy-50/50 border border-navy-100 rounded-xl text-xs font-bold text-navy-950 focus:outline-none focus:border-navy-600"
                    >
                      <option value="">Selecione</option>
                      {units.map(unit => (
                        <option key={unit.id} value={unit.nome}>{unit.nome}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-navy-600 uppercase tracking-widest mb-1.5">Guarnição Habitual (Garrison)</label>
                    <input 
                      type="text" 
                      value={user.garrison || ''} 
                      onChange={e => handleFieldChange('garrison', e.target.value.toUpperCase())}
                      placeholder="e.g. FORÇA TÁTICA, FT 01"
                      className="w-full px-4 py-3 bg-navy-50/50 border border-navy-100 rounded-xl text-xs font-bold text-navy-950 focus:outline-none focus:border-navy-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-navy-600 uppercase tracking-widest mb-1.5">Situação Funcional</label>
                    <select 
                      value={user.situacao_funcional || ''} 
                      onChange={e => handleFieldChange('situacao_funcional', e.target.value)}
                      className="w-full px-4 py-3 bg-navy-50/50 border border-navy-100 rounded-xl text-xs font-bold text-navy-950 focus:outline-none focus:border-navy-600"
                    >
                      <option value="">Selecione...</option>
                      <option value="ATIVO">ATIVO</option>
                      <option value="RESERVA REMUNERADA">RESERVA REMUNERADA</option>
                      <option value="REFORMADO">REFORMADO</option>
                      <option value="LICENCIADO">LICENCIADO</option>
                      <option value="FALECIDO">FALECIDO</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-navy-600 uppercase tracking-widest mb-1.5">Identidade Funcional (Nº)</label>
                    <input 
                      type="text" 
                      value={user.identidade_funcional || ''} 
                      onChange={e => handleFieldChange('identidade_funcional', e.target.value)}
                      className="w-full px-4 py-3 bg-navy-50/50 border border-navy-100 rounded-xl text-xs font-bold text-navy-950 focus:outline-none focus:border-navy-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-navy-600 uppercase tracking-widest mb-1.5">Status Funcional</label>
                    <select 
                      value={user.status_funcional || ''} 
                      onChange={e => handleFieldChange('status_funcional', e.target.value)}
                      className="w-full px-4 py-3 bg-navy-50/50 border border-navy-100 rounded-xl text-xs font-bold text-navy-950 focus:outline-none focus:border-navy-600"
                    >
                      <option value="">Selecione</option>
                      <option value="DISPONÍVEL">DISPONÍVEL</option>
                      <option value="AFASTADO">AFASTADO</option>
                      <option value="FÉRIAS">FÉRIAS</option>
                      <option value="LICENÇA MÉDICA">LICENÇA MÉDICA</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-navy-600 uppercase tracking-widest mb-1.5">E-mail Corporativo</label>
                    <input 
                      type="email" 
                      value={user.email_pm || ''} 
                      onChange={e => handleFieldChange('email_pm', e.target.value)}
                      placeholder="nome.matricula@pm.gov.br"
                      className="w-full px-4 py-3 bg-navy-50/50 border border-navy-100 rounded-xl text-xs font-bold text-navy-950 focus:outline-none focus:border-navy-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-navy-600 uppercase tracking-widest mb-1.5">Data de Inclusão na Corporação</label>
                    <input 
                      type="date" 
                      value={user.data_inclusao || ''} 
                      onChange={e => handleFieldChange('data_inclusao', e.target.value)}
                      className="w-full px-4 py-3 bg-navy-50/50 border border-navy-100 rounded-xl text-xs font-bold text-navy-950 focus:outline-none focus:border-navy-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-navy-600 uppercase tracking-widest mb-1.5">DOE Inclusão (Mód / DOE)</label>
                    <input 
                      type="text" 
                      value={user.doe_inclusao || ''} 
                      onChange={e => handleFieldChange('doe_inclusao', e.target.value)}
                      placeholder="e.g. DOE nº 124"
                      className="w-full px-4 py-3 bg-navy-50/50 border border-navy-100 rounded-xl text-xs font-bold text-navy-950 focus:outline-none focus:border-navy-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-navy-600 uppercase tracking-widest mb-1.5">Data Diário Oficial (Inclusão)</label>
                    <input 
                      type="date" 
                      value={user.data_diario || ''} 
                      onChange={e => handleFieldChange('data_diario', e.target.value)}
                      className="w-full px-4 py-3 bg-navy-50/50 border border-navy-100 rounded-xl text-xs font-bold text-navy-950 focus:outline-none focus:border-navy-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-navy-600 uppercase tracking-widest mb-1.5">Página do Diário Oficial</label>
                    <input 
                      type="text" 
                      value={user.pagina || ''} 
                      onChange={e => handleFieldChange('pagina', e.target.value)}
                      placeholder="e.g. pág. 45"
                      className="w-full px-4 py-3 bg-navy-50/50 border border-navy-100 rounded-xl text-xs font-bold text-navy-950 focus:outline-none focus:border-navy-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-navy-600 uppercase tracking-widest mb-1.5">Sessão / Incorporação</label>
                    <input 
                      type="text" 
                      value={user.incorporacao || ''} 
                      onChange={e => handleFieldChange('incorporacao', e.target.value.toUpperCase())}
                      className="w-full px-4 py-3 bg-navy-50/50 border border-navy-100 rounded-xl text-xs font-bold text-navy-950 focus:outline-none focus:border-navy-600"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB: ACESSO */}
            {activeTab === 'acesso' && (
              <div className="space-y-6 animate-fade-in">
                <div className="border-b border-navy-100 pb-3">
                  <h4 className="text-sm font-black text-navy-950 uppercase tracking-wider">Acesso & Unidades de Atuação</h4>
                  <p className="text-xs text-navy-400">Configure o perfil de acesso e as unidades em que o operador possui admissibilidade para atuar.</p>
                </div>

                <div className={`grid grid-cols-1 ${isCreation ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-4`}>
                  <div>
                    <label className="block text-[10px] font-black text-navy-600 uppercase tracking-widest mb-1.5">Cargo / Perfil de Acesso (Role) *</label>
                    <select 
                      value={user.role} 
                      onChange={e => handleFieldChange('role', e.target.value as UserRole)}
                      className="w-full px-4 py-3 bg-navy-50/50 border border-navy-100 rounded-xl text-xs font-bold text-navy-950 focus:outline-none focus:border-navy-600 appearance-none font-sans"
                    >
                      <option value={UserRole.OPERATOR}>Operador Comum</option>
                      <option value={UserRole.ADMIN}>Administrador</option>
                      <option value={UserRole.MASTER}>Master</option>
                      <option value={UserRole.CHEFE_DE_EQUIPE}>Chefe de Equipe</option>
                      <option value={UserRole.PATRULHEIRO}>Patrulheiro</option>
                      <option value={UserRole.SUPERVISOR_DE_OPERACOES}>Supervisor de Operações</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-navy-600 uppercase tracking-widest mb-1.5">Unidade Principal</label>
                    <select 
                      value={user.unidade || ''} 
                      onChange={e => handleFieldChange('unidade', e.target.value)}
                      className="w-full px-4 py-3 bg-navy-50/50 border border-navy-100 rounded-xl text-xs font-bold text-navy-950 focus:outline-none focus:border-navy-600 appearance-none font-sans"
                    >
                      <option value="">Selecione a Unidade</option>
                      {units.map(unit => (
                        <option key={unit.id} value={unit.nome}>{unit.nome}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-navy-600 uppercase tracking-widest mb-1.5">Nº Almanaque / Ordem Precedência</label>
                    <input 
                      type="number" 
                      value={user.ord || 0} 
                      onChange={e => handleFieldChange('ord', parseInt(e.target.value) || 0)}
                      className="w-full px-4 py-3 bg-navy-50/50 border border-navy-100 rounded-xl text-xs font-bold text-navy-950 focus:outline-none focus:border-navy-600"
                      placeholder="Ex: 10, 45, etc."
                    />
                  </div>
                  {isCreation && (
                    <div>
                      <label className="block text-[10px] font-black text-navy-600 uppercase tracking-widest mb-1.5">Senha Inicial *</label>
                      <input 
                        type="text" 
                        required
                        value={user.senha || ''} 
                        onChange={e => handleFieldChange('senha', e.target.value)}
                        className="w-full px-4 py-3 bg-navy-50/50 border border-navy-100 rounded-xl text-xs font-bold text-navy-950 focus:outline-none focus:border-navy-600"
                        placeholder="Ex: @Senha123"
                      />
                    </div>
                  )}
                </div>

                {(user.role === UserRole.ADMIN || user.role === UserRole.MASTER || user.role === UserRole.SUPERVISOR_DE_OPERACOES) && (
                  <div className="bg-navy-50/50 p-4 rounded-2xl border border-navy-100 space-y-3">
                    <label className="block text-[10px] font-black text-navy-600 uppercase tracking-widest">Unidades Adicionais de Atuação (Acesso Extra)</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {units.filter(u => u.nome.toUpperCase() !== (user.unidade || '').toUpperCase()).map(unit => {
                        const isSelected = user.unidades_extras?.some(e => e.toUpperCase() === unit.nome.toUpperCase());
                        return (
                          <button
                            key={unit.id}
                            type="button"
                            onClick={() => {
                              const extras = user.unidades_extras || [];
                              const newExtras = isSelected 
                                ? extras.filter(e => e.toUpperCase() !== unit.nome.toUpperCase())
                                : [...extras, unit.nome];
                              handleFieldChange('unidades_extras', newExtras);
                            }}
                            className={`px-3 py-2.5 rounded-xl text-[9px] font-black uppercase transition-all border ${isSelected ? 'bg-navy-950 text-white border-navy-950 shadow-sm' : 'bg-white text-navy-400 border-navy-100 hover:border-navy-300'}`}
                          >
                            {unit.nome}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB: LICENÇAS */}
            {activeTab === 'licencas' && (
              <div className="space-y-6 animate-fade-in">
                <div className="border-b border-navy-100 pb-3">
                  <h4 className="text-sm font-black text-navy-950 uppercase tracking-wider">Histórico de Licenças Especiais</h4>
                  <p className="text-xs text-navy-400">Gerenciamento de concessões e fruições decenais de licenças especiais</p>
                </div>

                <div className="space-y-6">
                  {/* Concessions Table style */}
                  <div>
                    <h5 className="text-[11px] font-black text-navy-950 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-forest-600"></span> Concessões
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      
                      {/* 1o Decenio */}
                      <div className="bg-navy-50/30 border border-navy-100 p-4 rounded-xl space-y-3">
                        <span className="text-[10px] font-black text-[#CB9E1B] uppercase tracking-widest">1º Decênio</span>
                        <div>
                          <label className="block text-[9px] font-black text-navy-500 uppercase tracking-widest mb-1">BCG de Concessão</label>
                          <input 
                            type="text"
                            value={getLicencaValue('concessao', 'primeiroDecenio', 'bcg')}
                            onChange={e => setLicencaValue('concessao', 'primeiroDecenio', 'bcg', e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-navy-100 rounded-lg text-xs font-bold text-navy-950"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-black text-navy-500 uppercase tracking-widest mb-1">Data BCG</label>
                          <input 
                            type="date"
                            value={getLicencaValue('concessao', 'primeiroDecenio', 'dataBcg')}
                            onChange={e => setLicencaValue('concessao', 'primeiroDecenio', 'dataBcg', e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-navy-100 rounded-lg text-xs font-bold text-navy-950"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-black text-navy-500 uppercase tracking-widest mb-1">Dias Concedidos</label>
                          <input 
                            type="text"
                            value={getLicencaValue('concessao', 'primeiroDecenio', 'qtdDias')}
                            onChange={e => setLicencaValue('concessao', 'primeiroDecenio', 'qtdDias', e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-navy-100 rounded-lg text-xs font-bold text-navy-950"
                          />
                        </div>
                      </div>

                      {/* 2o Decenio */}
                      <div className="bg-navy-50/30 border border-navy-100 p-4 rounded-xl space-y-3">
                        <span className="text-[10px] font-black text-[#CB9E1B] uppercase tracking-widest">2º Decênio</span>
                        <div>
                          <label className="block text-[9px] font-black text-navy-500 uppercase tracking-widest mb-1">BCG de Concessão</label>
                          <input 
                            type="text"
                            value={getLicencaValue('concessao', 'segundoDecenio', 'bcg')}
                            onChange={e => setLicencaValue('concessao', 'segundoDecenio', 'bcg', e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-navy-100 rounded-lg text-xs font-bold text-navy-950"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-black text-navy-500 uppercase tracking-widest mb-1">Data BCG</label>
                          <input 
                            type="date"
                            value={getLicencaValue('concessao', 'segundoDecenio', 'dataBcg')}
                            onChange={e => setLicencaValue('concessao', 'segundoDecenio', 'dataBcg', e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-navy-100 rounded-lg text-xs font-bold text-navy-950"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-black text-navy-500 uppercase tracking-widest mb-1">Dias Concedidos</label>
                          <input 
                            type="text"
                            value={getLicencaValue('concessao', 'segundoDecenio', 'qtdDias')}
                            onChange={e => setLicencaValue('concessao', 'segundoDecenio', 'qtdDias', e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-navy-100 rounded-lg text-xs font-bold text-navy-950"
                          />
                        </div>
                      </div>

                      {/* 3o Decenio */}
                      <div className="bg-navy-50/30 border border-navy-100 p-4 rounded-xl space-y-3">
                        <span className="text-[10px] font-black text-[#CB9E1B] uppercase tracking-widest">3º Decênio</span>
                        <div>
                          <label className="block text-[9px] font-black text-navy-500 uppercase tracking-widest mb-1">BCG de Concessão</label>
                          <input 
                            type="text"
                            value={getLicencaValue('concessao', 'terceiroDecenio', 'bcg')}
                            onChange={e => setLicencaValue('concessao', 'terceiroDecenio', 'bcg', e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-navy-100 rounded-lg text-xs font-bold text-navy-950"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-black text-navy-500 uppercase tracking-widest mb-1">Data BCG</label>
                          <input 
                            type="date"
                            value={getLicencaValue('concessao', 'terceiroDecenio', 'dataBcg')}
                            onChange={e => setLicencaValue('concessao', 'terceiroDecenio', 'dataBcg', e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-navy-100 rounded-lg text-xs font-bold text-navy-950"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-black text-navy-500 uppercase tracking-widest mb-1">Dias Concedidos</label>
                          <input 
                            type="text"
                            value={getLicencaValue('concessao', 'terceiroDecenio', 'qtdDias')}
                            onChange={e => setLicencaValue('concessao', 'terceiroDecenio', 'qtdDias', e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-navy-100 rounded-lg text-xs font-bold text-navy-950"
                          />
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Fruitions Table style */}
                  <div className="pt-4 border-t border-navy-100">
                    <h5 className="text-[11px] font-black text-navy-950 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#CB9E1B]"></span> Fruições (Uso Real)
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      
                      {/* 1o Decenio */}
                      <div className="bg-[#CB9E1B]/5 border border-[#CB9E1B]/10 p-4 rounded-xl space-y-3">
                        <span className="text-[10px] font-black text-[#CB9E1B] uppercase tracking-widest">1º Decênio</span>
                        <div>
                          <label className="block text-[9px] font-black text-navy-500 uppercase tracking-widest mb-1">BCG de Fruição</label>
                          <input 
                            type="text"
                            value={getLicencaValue('fruicao', 'primeiroDecenio', 'bcg')}
                            onChange={e => setLicencaValue('fruicao', 'primeiroDecenio', 'bcg', e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-navy-100 rounded-lg text-xs font-bold text-navy-950"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-black text-navy-500 uppercase tracking-widest mb-1">Data BCG</label>
                          <input 
                            type="date"
                            value={getLicencaValue('fruicao', 'primeiroDecenio', 'dataBcg')}
                            onChange={e => setLicencaValue('fruicao', 'primeiroDecenio', 'dataBcg', e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-navy-100 rounded-lg text-xs font-bold text-navy-950"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-black text-navy-500 uppercase tracking-widest mb-1">Dias Usados</label>
                          <input 
                            type="text"
                            value={getLicencaValue('fruicao', 'primeiroDecenio', 'qtdDias')}
                            onChange={e => setLicencaValue('fruicao', 'primeiroDecenio', 'qtdDias', e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-navy-100 rounded-lg text-xs font-bold text-navy-950"
                          />
                        </div>
                      </div>

                      {/* 2o Decenio */}
                      <div className="bg-[#CB9E1B]/5 border border-[#CB9E1B]/10 p-4 rounded-xl space-y-3">
                        <span className="text-[10px] font-black text-[#CB9E1B] uppercase tracking-widest">2º Decênio</span>
                        <div>
                          <label className="block text-[9px] font-black text-navy-500 uppercase tracking-widest mb-1">BCG de Fruição</label>
                          <input 
                            type="text"
                            value={getLicencaValue('fruicao', 'segundoDecenio', 'bcg')}
                            onChange={e => setLicencaValue('fruicao', 'segundoDecenio', 'bcg', e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-navy-100 rounded-lg text-xs font-bold text-navy-950"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-black text-navy-500 uppercase tracking-widest mb-1">Data BCG</label>
                          <input 
                            type="date"
                            value={getLicencaValue('fruicao', 'segundoDecenio', 'dataBcg')}
                            onChange={e => setLicencaValue('fruicao', 'segundoDecenio', 'dataBcg', e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-navy-100 rounded-lg text-xs font-bold text-navy-950"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-black text-navy-500 uppercase tracking-widest mb-1">Dias Usados</label>
                          <input 
                            type="text"
                            value={getLicencaValue('fruicao', 'segundoDecenio', 'qtdDias')}
                            onChange={e => setLicencaValue('fruicao', 'segundoDecenio', 'qtdDias', e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-navy-100 rounded-lg text-xs font-bold text-navy-950"
                          />
                        </div>
                      </div>

                      {/* 3o Decenio */}
                      <div className="bg-[#CB9E1B]/5 border border-[#CB9E1B]/10 p-4 rounded-xl space-y-3">
                        <span className="text-[10px] font-black text-[#CB9E1B] uppercase tracking-widest">3º Decênio</span>
                        <div>
                          <label className="block text-[9px] font-black text-navy-500 uppercase tracking-widest mb-1">BCG de Fruição</label>
                          <input 
                            type="text"
                            value={getLicencaValue('fruicao', 'terceiroDecenio', 'bcg')}
                            onChange={e => setLicencaValue('fruicao', 'terceiroDecenio', 'bcg', e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-navy-100 rounded-lg text-xs font-bold text-navy-950"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-black text-navy-500 uppercase tracking-widest mb-1">Data BCG</label>
                          <input 
                            type="date"
                            value={getLicencaValue('fruicao', 'terceiroDecenio', 'dataBcg')}
                            onChange={e => setLicencaValue('fruicao', 'terceiroDecenio', 'dataBcg', e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-navy-100 rounded-lg text-xs font-bold text-navy-950"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-black text-navy-500 uppercase tracking-widest mb-1">Dias Usados</label>
                          <input 
                            type="text"
                            value={getLicencaValue('fruicao', 'terceiroDecenio', 'qtdDias')}
                            onChange={e => setLicencaValue('fruicao', 'terceiroDecenio', 'qtdDias', e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-navy-100 rounded-lg text-xs font-bold text-navy-950"
                          />
                        </div>
                      </div>

                    </div>
                  </div>

                </div>
              </div>
            )}

            {/* TAB: CURSOS */}
            {activeTab === 'cursos' && (
              <div className="space-y-6 animate-fade-in">
                <div className="border-b border-navy-100 pb-3">
                  <h4 className="text-sm font-black text-navy-950 uppercase tracking-wider">Cursos e Formações Policiais</h4>
                  <p className="text-xs text-navy-400">Currículo e especializações técnicas concluídas pelo operador</p>
                </div>

                {/* Grid para cadastrar novo */}
                <div className="bg-navy-50/50 p-4 rounded-xl border border-navy-100/60 grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                  <div>
                    <label className="block text-[9px] font-black text-navy-600 uppercase tracking-widest mb-1">Ano</label>
                    <input 
                      type="text" 
                      placeholder="e.g. 2024"
                      value={newCurso.ano} 
                      onChange={e => setNewCurso(v => ({ ...v, ano: e.target.value }))}
                      className="w-full px-3 py-2 bg-white border border-navy-100 rounded-lg text-xs font-bold text-navy-950"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[9px] font-black text-navy-600 uppercase tracking-widest mb-1">Nome do Curso</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Curso de Força Tática"
                      value={newCurso.curso} 
                      onChange={e => setNewCurso(v => ({ ...v, curso: e.target.value.toUpperCase() }))}
                      className="w-full px-3 py-2 bg-white border border-navy-100 rounded-lg text-xs font-bold text-navy-950"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-navy-600 uppercase tracking-widest mb-1">Instituição / Local</label>
                    <input 
                      type="text" 
                      placeholder="e.g. PM/BOPE"
                      value={newCurso.local} 
                      onChange={e => setNewCurso(v => ({ ...v, local: e.target.value.toUpperCase() }))}
                      className="w-full px-3 py-2 bg-white border border-navy-100 rounded-lg text-xs font-bold text-navy-950"
                    />
                  </div>
                  <div className="md:col-span-4 flex justify-end gap-2">
                    {editingCursoId && (
                      <button 
                        type="button" 
                        onClick={cancelEditCurso}
                        className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-black text-[10px] uppercase tracking-wider transition-colors"
                      >
                        Cancelar
                      </button>
                    )}
                    <button 
                      type="button" 
                      onClick={addCurso}
                      className="px-4 py-2 bg-navy-950 hover:bg-navy-800 text-white rounded-lg font-black text-[10px] uppercase tracking-wider flex items-center gap-1"
                    >
                      {editingCursoId ? (
                        <>Salvar Alterações</>
                      ) : (
                        <><Plus className="w-3.5 h-3.5" /> Adicionar Curso</>
                      )}
                    </button>
                  </div>
                </div>

                {/* Lista */}
                <div className="space-y-2">
                  {user.cursos && user.cursos.length > 0 ? (
                    user.cursos.map((c: any) => (
                      <div key={c.id || Math.random()} className="flex items-center justify-between p-3.5 border border-navy-100 rounded-xl bg-white hover:shadow-sm transition-all">
                        <div className="space-y-0.5">
                          <span className="bg-navy-100 text-navy-800 text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider">{c.ano}</span>
                          <h6 className="text-xs font-bold text-navy-950">{c.curso}</h6>
                          <p className="text-[10px] text-navy-400 font-medium">{c.local}</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => editCurso(c.id)}
                            className="p-1.5 text-navy-500 hover:bg-navy-50 rounded-lg transition-colors"
                            title="Editar Curso"
                          >
                            <i className="fas fa-edit w-4 h-4 flex items-center justify-center"></i>
                          </button>
                          <button
                            type="button"
                            onClick={() => removeCurso(c.id)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Remover Curso"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-6 text-center text-navy-400 text-xs font-medium">Nenhum curso registrado para este operador.</div>
                  )}
                </div>
              </div>
            )}

            {/* TAB: PROMOÇÕES */}
            {activeTab === 'promocoes' && (
              <div className="space-y-6 animate-fade-in">
                <div className="border-b border-navy-100 pb-3">
                  <h4 className="text-sm font-black text-navy-950 uppercase tracking-wider">Histórico de Promoções</h4>
                  <p className="text-xs text-navy-400">Progresso de patentes e nomeações militares</p>
                </div>

                {/* Form Adicionar */}
                <div className="bg-navy-50/50 p-4 rounded-xl border border-navy-100/60 grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                  <div>
                    <label className="block text-[9px] font-black text-navy-600 uppercase tracking-widest mb-1">Posto / Graduação</label>
                    <select 
                      value={newPromo.postoGrad} 
                      onChange={e => setNewPromo(v => ({ ...v, postoGrad: e.target.value }))}
                      className="w-full px-3 py-2 bg-white border border-navy-100 rounded-lg text-xs font-bold text-navy-950"
                    >
                      <option value="">Selecione</option>
                      <option value="Coronel">Coronel</option>
                      <option value="Tenente-Coronel">Tenente-Coronel</option>
                      <option value="Major">Major</option>
                      <option value="Capitão">Capitão</option>
                      <option value="1º Tenente">1º Tenente</option>
                      <option value="2º Tenente">2º Tenente</option>
                      <option value="Subtenente">Subtenente</option>
                      <option value="1º Sargento">1º Sargento</option>
                      <option value="2º Sargento">2º Sargento</option>
                      <option value="3º Sargento">3º Sargento</option>
                      <option value="Cabo">Cabo</option>
                      <option value="Soldado">Soldado</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-navy-600 uppercase tracking-widest mb-1">Documento / DOE</label>
                    <input 
                      type="text" 
                      placeholder="e.g. DOE nº 23"
                      value={newPromo.doe} 
                      onChange={e => setNewPromo(v => ({ ...v, doe: e.target.value }))}
                      className="w-full px-3 py-2 bg-white border border-navy-100 rounded-lg text-xs font-bold text-navy-950"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-navy-600 uppercase tracking-widest mb-1">Data do DOE</label>
                    <input 
                      type="date" 
                      value={newPromo.dataDoe} 
                      onChange={e => setNewPromo(v => ({ ...v, dataDoe: e.target.value }))}
                      className="w-full px-3 py-2 bg-white border border-navy-100 rounded-lg text-xs font-bold text-navy-950"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-navy-600 uppercase tracking-widest mb-1">Data Efetiva Prom.</label>
                    <input 
                      type="date" 
                      value={newPromo.dataPromocao} 
                      onChange={e => setNewPromo(v => ({ ...v, dataPromocao: e.target.value }))}
                      className="w-full px-3 py-2 bg-white border border-navy-100 rounded-lg text-xs font-bold text-navy-950"
                    />
                  </div>
                  <div className="md:col-span-4 flex justify-end gap-2">
                    {editingPromoId && (
                      <button 
                        type="button" 
                        onClick={cancelEditPromo}
                        className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-black text-[10px] uppercase tracking-wider transition-colors"
                      >
                        Cancelar
                      </button>
                    )}
                    <button 
                      type="button" 
                      onClick={addPromo}
                      className="px-4 py-2 bg-navy-950 hover:bg-navy-800 text-white rounded-lg font-black text-[10px] uppercase tracking-wider flex items-center gap-1"
                    >
                      {editingPromoId ? (
                        <>Salvar Alterações</>
                      ) : (
                        <><Plus className="w-3.5 h-3.5" /> Adicionar Promoção</>
                      )}
                    </button>
                  </div>
                </div>

                {/* Lista */}
                <div className="space-y-2">
                  {user.promocoes && user.promocoes.length > 0 ? (
                    user.promocoes.map((p: any) => (
                      <div key={p.id || Math.random()} className="flex items-center justify-between p-3.5 border border-navy-100 rounded-xl bg-white hover:shadow-sm transition-all">
                        <div className="space-y-0.5">
                          <h6 className="text-xs font-extrabold text-navy-950 uppercase">{p.postoGrad}</h6>
                          <p className="text-[10px] text-navy-500 font-bold">{p.doe ? `Boletim: ${p.doe}` : ''}</p>
                          <div className="flex gap-4 text-[10px] text-navy-400 font-medium">
                            {p.dataDoe && <span>Diário: {new Date(p.dataDoe + 'T00:00:00').toLocaleDateString('pt-BR')}</span>}
                            {p.dataPromocao && <span>Efetiva: {new Date(p.dataPromocao + 'T00:00:00').toLocaleDateString('pt-BR')}</span>}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => editPromo(p.id)}
                            className="p-1.5 text-navy-500 hover:bg-navy-50 rounded-lg transition-colors"
                            title="Editar Promoção"
                          >
                            <i className="fas fa-edit w-4 h-4 flex items-center justify-center"></i>
                          </button>
                          <button
                            type="button"
                            onClick={() => removePromo(p.id)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Remover Promoção"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-6 text-center text-navy-400 text-xs font-medium">Nenhuma promoção registrada.</div>
                  )}
                </div>
              </div>
            )}

            {/* TAB: DEPENDENTES */}
            {activeTab === 'dependentes' && (
              <div className="space-y-6 animate-fade-in">
                <div className="border-b border-navy-100 pb-3">
                  <h4 className="text-sm font-black text-navy-950 uppercase tracking-wider">Membros Dependentes de Vínculo</h4>
                  <p className="text-xs text-navy-400">Cônjuge, filhos e parentes declarados no dossiê oficial</p>
                </div>

                {/* Form Adicionar */}
                <div className="bg-navy-50/50 p-4 rounded-xl border border-navy-100/60 grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                  <div>
                    <label className="block text-[9px] font-black text-navy-600 uppercase tracking-widest mb-1">Nome Completo</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Maria de Oliveira"
                      value={newDep.nome} 
                      onChange={e => setNewDep(v => ({ ...v, nome: e.target.value.toUpperCase() }))}
                      className="w-full px-3 py-2 bg-white border border-navy-100 rounded-lg text-xs font-bold text-navy-950"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-navy-600 uppercase tracking-widest mb-1">Vínculo / Tipo</label>
                    <select 
                      value={newDep.tipo} 
                      onChange={e => setNewDep(v => ({ ...v, tipo: e.target.value }))}
                      className="w-full px-3 py-2 bg-white border border-navy-100 rounded-lg text-xs font-bold text-navy-950 animate-none"
                    >
                      <option value="">Selecione</option>
                      <option value="Cônjuge">Cônjuge</option>
                      <option value="Filho(a)">Filho(a)</option>
                      <option value="Enteado(a)">Enteado(a)</option>
                      <option value="Pai/Mãe">Pai/Mãe</option>
                      <option value="Outro">Outro</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-navy-600 uppercase tracking-widest mb-1">Data de Nascimento</label>
                    <input 
                      type="date" 
                      value={newDep.dataNascimento} 
                      onChange={e => setNewDep(v => ({ ...v, dataNascimento: e.target.value }))}
                      className="w-full px-3 py-2 bg-white border border-navy-100 rounded-lg text-xs font-bold text-navy-950"
                    />
                  </div>
                  <div className="md:col-span-3 flex justify-end">
                    <button 
                      type="button" 
                      onClick={addDependent}
                      className="px-4 py-2 bg-navy-950 hover:bg-navy-800 text-white rounded-lg font-black text-[10px] uppercase tracking-wider flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Adicionar Dependente
                    </button>
                  </div>
                </div>

                {/* Lista */}
                <div className="space-y-2">
                  {user.dependentes && user.dependentes.length > 0 ? (
                    user.dependentes.map((d: any) => (
                      <div key={d.id || Math.random()} className="flex items-center justify-between p-3.5 border border-navy-100 rounded-xl bg-white hover:shadow-sm transition-all">
                        <div className="space-y-0.5">
                          <h6 className="text-xs font-extrabold text-navy-950 uppercase">{d.nome}</h6>
                          <p className="text-[10px] text-navy-500 font-bold">{d.tipo}</p>
                          {d.dataNascimento && (
                            <p className="text-[10px] text-navy-400 font-medium">Nascimento: {new Date(d.dataNascimento + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeDependent(d.id)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="py-6 text-center text-navy-400 text-xs font-medium">Nenhum dependente vinculado.</div>
                  )}
                </div>
              </div>
            )}

            {/* TAB: AVERBAÇÕES */}
            {activeTab === 'averbacoes' && (
              <div className="space-y-8 animate-fade-in">
                
                {/* AVERBACOES */}
                <div className="space-y-6">
                  <div className="border-b border-navy-100 pb-3">
                    <h4 className="text-sm font-black text-navy-950 uppercase tracking-wider">Averbações de Tempo de Serviço</h4>
                    <p className="text-xs text-[#CB9E1B] font-bold uppercase tracking-widest text-[8px]">Inclusão de períodos de contribuição exterior (INSS, Exército etc.)</p>
                  </div>

                  {/* Tempo de Serviço Calculado */}
                  <div className="bg-amber-50/40 border border-amber-100 p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <span className="block text-[10px] font-black text-[#CB9E1B] uppercase tracking-widest mb-1">Tempo de Serviço Calculado</span>
                      <span className="text-base font-extrabold text-navy-950">
                        {calcularTempoTotal() || 'Não calculado (requer data de inclusão)'}
                      </span>
                    </div>
                    <div className="text-[10px] text-navy-500 font-bold max-w-xs md:text-right">
                      Calculado automaticamente somando o tempo de efetivo serviço (desde a inclusão em {user.data_inclusao ? new Date(user.data_inclusao + 'T00:00:00').toLocaleDateString('pt-BR') : 'não informada'}) com o total de dias averbados.
                    </div>
                  </div>

                  {/* Form Adicionar Averbação */}
                  <div className="bg-navy-50/50 p-4 rounded-xl border border-navy-100/60 grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                    <div>
                      <label className="block text-[9px] font-black text-navy-600 uppercase tracking-widest mb-1">Tipo de Averbação</label>
                      <select
                        value={newAver.tipo}
                        onChange={e => setNewAver(v => ({ ...v, tipo: e.target.value }))}
                        className="w-full px-3 py-2 bg-white border border-navy-100 rounded-lg text-xs font-bold text-navy-950"
                      >
                        <option value="">Selecione...</option>
                        <option value="INSS">INSS</option>
                        <option value="EXERCITO">EXERCITO</option>
                        <option value="MARINHA">MARINHA</option>
                        <option value="AERONAUTICA">AERONAUTICA</option>
                        <option value="PUBLICO MUNICIPAL">PUBLICO MUNICIPAL</option>
                        <option value="PUBLICO ESTADUAL">PUBLICO ESTADUAL</option>
                        <option value="PUBLICO FEDERAL">PUBLICO FEDERAL</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[9px] font-black text-navy-600 uppercase tracking-widest mb-1">Total de Dias</label>
                      <input 
                        type="text" 
                        placeholder="e.g. 1025"
                        value={newAver.totalDias} 
                        onChange={e => setNewAver(v => ({ ...v, totalDias: e.target.value }))}
                        className="w-full px-3 py-2 bg-white border border-navy-100 rounded-lg text-xs font-bold text-navy-950"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-black text-navy-600 uppercase tracking-widest mb-1">Referência DOE / BCG</label>
                      <input 
                        type="text" 
                        placeholder="e.g. DOE nº 12"
                        value={newAver.doe} 
                        onChange={e => setNewAver(v => ({ ...v, doe: e.target.value }))}
                        className="w-full px-3 py-2 bg-white border border-navy-100 rounded-lg text-xs font-bold text-navy-950"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-black text-navy-600 uppercase tracking-widest mb-1">Nº Certidão</label>
                      <input 
                        type="text" 
                        placeholder="e.g. Certidão 451/20"
                        value={newAver.nrCertidao} 
                        onChange={e => setNewAver(v => ({ ...v, nrCertidao: e.target.value }))}
                        className="w-full px-3 py-2 bg-white border border-navy-100 rounded-lg text-xs font-bold text-navy-950"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-black text-navy-600 uppercase tracking-widest mb-1">Data Certidão</label>
                      <input 
                        type="date" 
                        value={newAver.dataCertidao} 
                        onChange={e => setNewAver(v => ({ ...v, dataCertidao: e.target.value }))}
                        className="w-full px-3 py-2 bg-white border border-navy-100 rounded-lg text-xs font-bold text-navy-950"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-black text-navy-600 uppercase tracking-widest mb-1">Data Publicação</label>
                      <input 
                        type="date" 
                        value={newAver.dataPublicacao} 
                        onChange={e => setNewAver(v => ({ ...v, dataPublicacao: e.target.value }))}
                        className="w-full px-3 py-2 bg-white border border-navy-100 rounded-lg text-xs font-bold text-navy-950"
                      />
                    </div>
                    <div className="md:col-span-3 flex justify-end">
                      <button 
                        type="button" 
                        onClick={addAver}
                        className="px-4 py-2 bg-navy-950 hover:bg-navy-800 text-white rounded-lg font-black text-[10px] uppercase tracking-wider flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> Adicionar Averbação
                      </button>
                    </div>
                  </div>

                  {/* Lista Averbações */}
                  <div className="space-y-2">
                    {user.averbacao && user.averbacao.length > 0 ? (
                      user.averbacao.map((a: any) => (
                        <div key={a.id || Math.random()} className="flex items-center justify-between p-3.5 border border-navy-100 rounded-xl bg-white hover:shadow-sm transition-all">
                          <div className="space-y-0.5">
                            <h6 className="text-xs font-extrabold text-navy-950 uppercase">{a.tipo} - {a.totalDias} dias</h6>
                            <p className="text-[10px] text-navy-500 font-bold">{a.doe ? `Portaria/DOE: ${a.doe}` : ''} {a.nrCertidao ? ` | Certidão: ${a.nrCertidao}` : ''}</p>
                            <div className="flex gap-4 text-[10px] text-navy-400 font-medium">
                              {a.dataCertidao && <span>Data Certidão: {new Date(a.dataCertidao + 'T00:00:00').toLocaleDateString('pt-BR')}</span>}
                              {a.dataPublicacao && <span>Publicação: {new Date(a.dataPublicacao + 'T00:00:00').toLocaleDateString('pt-BR')}</span>}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeAver(a.id)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="py-4 text-center text-navy-400 text-xs font-medium">Nenhuma averbação registrada.</div>
                    )}
                  </div>
                </div>

                {/* DEDUCOES */}
                <div className="space-y-6 pt-6 border-t border-navy-100">
                  <div className="border-b border-navy-100 pb-3">
                    <h4 className="text-sm font-black text-navy-950 uppercase tracking-wider">Períodos de Dedução de Tempo</h4>
                    <p className="text-xs text-red-500 font-bold uppercase tracking-widest text-[8px]">Perda ou decréscimo de dias contados para inatividade</p>
                  </div>

                  {/* Form Adicionar Dedução */}
                  <div className="bg-navy-50/50 p-4 rounded-xl border border-navy-100/60 grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                    <div>
                      <label className="block text-[9px] font-black text-navy-600 uppercase tracking-widest mb-1">Motivo / Tipo</label>
                      <select
                        value={newDed.tipo}
                        onChange={e => setNewDed(v => ({ ...v, tipo: e.target.value }))}
                        className="w-full px-3 py-2 bg-white border border-navy-100 rounded-lg text-xs font-bold text-navy-950"
                      >
                        <option value="">Selecione...</option>
                        <option value="AGREGAÇÃO">AGREGAÇÃO</option>
                        <option value="LTS (AGREGAÇÃO)">LTS (AGREGAÇÃO)</option>
                        <option value="LTIP">LTIP</option>
                        <option value="CONDENAÇÃO">CONDENAÇÃO</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[9px] font-black text-navy-600 uppercase tracking-widest mb-1">Dias Deduzidos</label>
                      <input 
                        type="text" 
                        placeholder="e.g. 180"
                        value={newDed.totalDias} 
                        onChange={e => setNewDed(v => ({ ...v, totalDias: e.target.value }))}
                        className="w-full px-3 py-2 bg-white border border-navy-100 rounded-lg text-xs font-bold text-navy-950"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-black text-navy-600 uppercase tracking-widest mb-1">Publicação Ref.</label>
                      <input 
                        type="text" 
                        placeholder="e.g. BCG ou Boletim nº 115"
                        value={newDed.doe} 
                        onChange={e => setNewDed(v => ({ ...v, doe: e.target.value }))}
                        className="w-full px-3 py-2 bg-white border border-navy-100 rounded-lg text-xs font-bold text-navy-950"
                      />
                    </div>
                    <div className="md:col-span-3 flex justify-end">
                      <button 
                        type="button" 
                        onClick={addDed}
                        className="px-4 py-2 bg-navy-950 hover:bg-navy-800 text-white rounded-lg font-black text-[10px] uppercase tracking-wider flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> Adicionar Dedução
                      </button>
                    </div>
                  </div>

                  {/* Lista Deduções */}
                  <div className="space-y-2">
                    {user.deducao && user.deducao.length > 0 ? (
                      user.deducao.map((d: any) => (
                        <div key={d.id || Math.random()} className="flex items-center justify-between p-3.5 border border-navy-100 rounded-xl bg-white hover:shadow-sm transition-all">
                          <div className="space-y-0.5">
                            <h6 className="text-xs font-extrabold text-navy-950 uppercase">{d.tipo} - {d.totalDias} dias</h6>
                            {d.doe && <p className="text-[10px] text-navy-500 font-bold">Publicação: {d.doe}</p>}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeDed(d.id)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="py-4 text-center text-navy-400 text-xs font-medium">Nenhuma dedução de tempo registrada.</div>
                    )}
                  </div>
                </div>

              </div>
            )}

            {/* Bottom Actions inside the Panel */}
            <div className="pt-6 border-t border-navy-100 flex justify-end gap-2">
              {onDelete && !isCreation && userToEdit && (
                <button
                  type="button"
                  onClick={() => onDelete(userToEdit)}
                  className="px-5 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 active:scale-95"
                >
                  <Trash2 className="w-4 h-4" /> Excluir Policial
                </button>
              )}
              <button
                type="button"
                onClick={onCancel}
                className="px-5 py-2.5 border border-navy-200 text-navy-600 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-navy-100/50 transition-all"
              >
                Voltar
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-2.5 bg-forest-600 hover:bg-forest-500 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-forest-600/15 transition-all flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <i className="fas fa-spinner fa-spin"></i> Salvando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" /> Salvar Ficha
                  </>
                )}
              </button>
            </div>

          </form>
        </div>

      </div>
    </div>
  );
}
