import React, { useState, useEffect } from 'react';
import { X, Save, Plus, Trash2, ShieldAlert, Check } from 'lucide-react';
import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

interface RequerimentosSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveSuccess: () => void;
  currentUser: any;
}

const TIPO_LABELS_MAP: Record<string, string> = {
  OUTROS: 'Outros Assuntos (Petição Geral)',
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
  'transferencia-interesse-proprio': 'Transferência por Interesse Próprio'
};

interface TemplateItem {
  label: string;
  text: string;
  amparo?: string;
}

export default function RequerimentosSettingsModal({ isOpen, onClose, onSaveSuccess, currentUser }: RequerimentosSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'comandante' | 'modelos'>('comandante');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Comandante Form state
  const [comNome, setComNome] = useState('ADRIANO RODRIGUES DE OLIVEIRA');
  const [comPatente, setComPatente] = useState('TEN CEL QOPM');
  const [comFuncao, setComFuncao] = useState('Comandante do 5º BPM');
  const [comMatricula, setComMatricula] = useState('Matrícula 97838021');

  // Predefined Templates state
  const [selectedType, setSelectedType] = useState<string>('OUTROS');
  const [templatesMap, setTemplatesMap] = useState<Record<string, TemplateItem[]>>({});
  
  // Template sub-form state
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [tempLabel, setTempLabel] = useState('');
  const [tempText, setTempText] = useState('');
  const [tempAmparo, setTempAmparo] = useState('');

  // Load existing configurations from Firestore on mount
  useEffect(() => {
    if (!isOpen) return;

    const loadConfig = async () => {
      setLoading(true);
      setError(null);
      try {
        const docRef = doc(db, 'requerimento_configs', 'default');
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const configData = docSnap.data();
          if (configData.comandante) {
            setComNome(configData.comandante.nome || configData.comandante.nome_completo || '');
            setComPatente(configData.comandante.patente || '');
            setComFuncao(configData.comandante.funcao || configData.comandante.posto || '');
            setComMatricula(configData.comandante.matricula || '');
          }
          if (configData.predefined_solicitacoes) {
            setTemplatesMap(configData.predefined_solicitacoes);
          }
        } else {
          // If config does not exist, fetch static defaults from the app configuration
          setTemplatesMap({});
        }
      } catch (err: any) {
        console.error('Error loading request configuration:', err);
        setError('Não foi possível carregar as configurações do banco de dados: ' + err.message);
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, [isOpen]);

  const currentTypeTemplates = templatesMap[selectedType] || [];

  // Add or edit template in the local map state
  const handleSaveTemplateForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempLabel.trim() || !tempText.trim()) {
      setError('Por favor, preencha o título e o texto justificativo do modelo.');
      return;
    }

    const updatedList = [...currentTypeTemplates];
    const newTemplate: TemplateItem = {
      label: tempLabel.trim(),
      text: tempText.trim(),
      amparo: tempAmparo.trim() || undefined
    };

    if (editingIndex !== null) {
      updatedList[editingIndex] = newTemplate;
    } else {
      updatedList.push(newTemplate);
    }

    setTemplatesMap({
      ...templatesMap,
      [selectedType]: updatedList
    });

    // Reset sub-form
    setEditingIndex(null);
    setTempLabel('');
    setTempText('');
    setTempAmparo('');
    setError(null);
  };

  const handleEditTemplate = (index: number) => {
    const item = currentTypeTemplates[index];
    setEditingIndex(index);
    setTempLabel(item.label);
    setTempText(item.text);
    setTempAmparo(item.amparo || '');
  };

  const handleDeleteTemplate = (index: number) => {
    if (!window.confirm('Deseja realmente excluir este modelo?')) return;
    const updatedList = currentTypeTemplates.filter((_, i) => i !== index);
    setTemplatesMap({
      ...templatesMap,
      [selectedType]: updatedList
    });
    if (editingIndex === index) {
      setEditingIndex(null);
      setTempLabel('');
      setTempText('');
      setTempAmparo('');
    }
  };

  const handleCancelTemplateEdit = () => {
    setEditingIndex(null);
    setTempLabel('');
    setTempText('');
    setTempAmparo('');
  };

  // Persist all config state to Firestore
  const handleSaveAll = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = {
        comandante: {
          nome: comNome.trim(),
          patente: comPatente.trim(),
          funcao: comFuncao.trim(),
          matricula: comMatricula.trim()
        },
        predefined_solicitacoes: templatesMap,
        updated_at: new Date().toISOString(),
        updated_by: currentUser?.id || 'admin'
      };

      await setDoc(doc(db, 'requerimento_configs', 'default'), payload);
      setSuccess('Configurações atualizadas com sucesso no banco de dados!');
      onSaveSuccess();
      setTimeout(() => {
        setSuccess(null);
        onClose();
      }, 2000);
    } catch (err: any) {
      console.error('Error saving configs:', err);
      setError('Erro ao persistir configurações: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-navy-950/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="bg-white border border-navy-100 rounded-3xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-navy-50 bg-navy-50/20">
          <div className="flex items-center gap-3">
            <div className="bg-navy-600 text-white p-2.5 rounded-2xl shadow-sm">
              <i className="fas fa-sliders-h text-sm"></i>
            </div>
            <div>
              <h3 className="text-sm font-black text-navy-950 uppercase tracking-tight">Painel de Ajustes dos Requerimentos</h3>
              <p className="text-[10px] text-navy-400 font-black uppercase tracking-widest mt-0.5">Gerenciador de comandante e modelos de petições</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-navy-50 text-navy-400 hover:text-navy-950 rounded-xl transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Tabs Row */}
        <div className="flex border-b border-navy-50 px-6 bg-navy-50/10">
          <button
            onClick={() => setActiveTab('comandante')}
            className={`py-3.5 px-4 text-xs font-black uppercase tracking-wider border-b-2 transition-all ${
              activeTab === 'comandante'
                ? 'border-navy-600 text-navy-900 bg-white/50'
                : 'border-transparent text-navy-400 hover:text-navy-950'
            }`}
          >
            <i className="fas fa-user-shield mr-2"></i> Comandante da Unidade
          </button>
          <button
            onClick={() => setActiveTab('modelos')}
            className={`py-3.5 px-4 text-xs font-black uppercase tracking-wider border-b-2 transition-all ${
              activeTab === 'modelos'
                ? 'border-navy-600 text-navy-900 bg-white/50'
                : 'border-transparent text-navy-400 hover:text-navy-950'
            }`}
          >
            <i className="fas fa-file-signature mr-2"></i> Modelos de Justificativa / Amparo
          </button>
        </div>

        {/* Modal Content Box */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-red-700 text-xs font-medium">
              <ShieldAlert className="w-5 h-5 flex-shrink-0 text-red-500" />
              <div>{error}</div>
            </div>
          )}

          {success && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3 text-emerald-800 text-xs font-medium">
              <Check className="w-5 h-5 flex-shrink-0 text-emerald-500" />
              <div>{success}</div>
            </div>
          )}

          {loading && !success && (
            <div className="flex items-center justify-center py-10">
              <div className="w-8 h-8 border-4 border-navy-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}

          {!loading && activeTab === 'comandante' && (
            <div className="space-y-4">
              <div className="bg-navy-50/30 border border-navy-100 rounded-2xl p-4 mb-2">
                <p className="text-[10px] text-navy-500 font-black uppercase tracking-widest leading-relaxed">
                  Abaixo insira as informações do atual Comandante da Unidade. Estes campos serão incorporados no rodapé "DESPACHO DO COMANDANTE" de todos os documentos oficiais PDF emitidos.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black text-navy-500 uppercase tracking-widest">Nome Completo do Comandante</label>
                  <input
                    type="text"
                    value={comNome}
                    onChange={(e) => setComNome(e.target.value)}
                    placeholder="Ex: ADRIANO RODRIGUES DE OLIVEIRA"
                    className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 outline-none transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black text-navy-500 uppercase tracking-widest">Posto / Patente militar</label>
                  <input
                    type="text"
                    value={comPatente}
                    onChange={(e) => setComPatente(e.target.value)}
                    placeholder="Ex: TEN CEL QOPM"
                    className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 outline-none transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black text-navy-500 uppercase tracking-widest">Função / Cargo</label>
                  <input
                    type="text"
                    value={comFuncao}
                    onChange={(e) => setComFuncao(e.target.value)}
                    placeholder="Ex: Comandante do 5º BPM"
                    className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 outline-none transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black text-navy-500 uppercase tracking-widest">Matrícula funcional</label>
                  <input
                    type="text"
                    value={comMatricula}
                    onChange={(e) => setComMatricula(e.target.value)}
                    placeholder="Ex: Matrícula 97838021"
                    className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-4 py-3 text-xs font-semibold text-navy-950 outline-none transition-all"
                  />
                </div>
              </div>
            </div>
          )}

          {!loading && activeTab === 'modelos' && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* Type selector & list on left */}
              <div className="md:col-span-5 space-y-4 border-r border-navy-50 md:pr-4">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black text-navy-500 uppercase tracking-widest">Natureza do Requerimento</label>
                  <select
                    value={selectedType}
                    onChange={(e) => {
                      setSelectedType(e.target.value);
                      handleCancelTemplateEdit();
                    }}
                    className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-3 py-2.5 text-xs font-bold text-navy-950 outline-none transition-all"
                  >
                    {Object.entries(TIPO_LABELS_MAP).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-navy-400 uppercase tracking-widest">Modelos Disponíveis</span>
                    <span className="bg-navy-50 text-navy-700 text-[10px] font-black px-2 py-0.5 rounded-full">{currentTypeTemplates.length}</span>
                  </div>

                  <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
                    {currentTypeTemplates.length === 0 ? (
                      <div className="p-4 bg-navy-50/50 border border-dashed border-navy-100 rounded-2xl text-center text-[11px] font-semibold text-navy-400">
                        Nenhum modelo cadastrado. Use o formulário à direita para criar um.
                      </div>
                    ) : (
                      currentTypeTemplates.map((item, idx) => (
                        <div 
                          key={idx}
                          className={`p-3 rounded-xl border transition-all text-left group flex items-start justify-between gap-2 ${
                            editingIndex === idx 
                              ? 'border-navy-600 bg-navy-50/20' 
                              : 'border-navy-100 hover:border-navy-300 bg-white'
                          }`}
                        >
                          <div className="flex-1 min-w-0" onClick={() => handleEditTemplate(idx)}>
                            <p className="text-xs font-black text-navy-900 truncate uppercase tracking-tight">{item.label}</p>
                            <p className="text-[10px] text-navy-400 font-bold truncate mt-1">{item.text}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteTemplate(idx)}
                            className="text-navy-300 hover:text-red-500 p-1 rounded transition-colors flex-shrink-0"
                            title="Deletar Modelo"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Template details editor on right */}
              <form onSubmit={handleSaveTemplateForm} className="md:col-span-7 space-y-4">
                <div className="bg-navy-50/40 p-3 rounded-xl border border-navy-100 flex items-center justify-between">
                  <span className="text-[10px] font-black text-navy-700 uppercase tracking-widest">
                    {editingIndex !== null ? `Editando Modelo #${editingIndex + 1}` : 'Cadastrar Novo Modelo'}
                  </span>
                  {editingIndex !== null && (
                    <button
                      type="button"
                      onClick={handleCancelTemplateEdit}
                      className="text-[10px] font-black text-navy-400 hover:text-navy-950 uppercase"
                    >
                      Cancelar
                    </button>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black text-navy-500 uppercase tracking-widest">Título do Modelo (Label)</label>
                  <input
                    type="text"
                    value={tempLabel}
                    onChange={(e) => setTempLabel(e.target.value)}
                    placeholder="Ex: Auxílio Fardamento por Promoção"
                    className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-3 py-2.5 text-xs font-semibold text-navy-950 outline-none transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black text-navy-500 uppercase tracking-widest">Texto Justificativo (Petição)</label>
                  <textarea
                    rows={4}
                    value={tempText}
                    onChange={(e) => setTempText(e.target.value)}
                    placeholder="REQUER a concessão de..."
                    className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-3 py-2.5 text-xs font-medium text-navy-950 outline-none transition-all resize-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black text-navy-500 uppercase tracking-widest">Amparo Legal</label>
                  <textarea
                    rows={2}
                    value={tempAmparo}
                    onChange={(e) => setTempAmparo(e.target.value)}
                    placeholder="Ex: Artigo 19 da Lei Complementar nº 127/2008"
                    className="w-full bg-white border border-navy-200 focus:border-navy-500 rounded-xl px-3 py-2.5 text-xs font-medium text-navy-950 outline-none transition-all resize-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-navy-600 hover:bg-navy-500 text-white py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" /> {editingIndex !== null ? 'Salvar Edições do Modelo' : 'Adicionar ao Tipo Escolhido'}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-navy-50 bg-navy-50/10 flex items-center justify-between">
          <button
            onClick={onClose}
            className="border border-navy-200 hover:bg-navy-50 text-navy-700 px-5 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all"
          >
            Sair sem Salvar
          </button>
          
          <button
            onClick={handleSaveAll}
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-md transition-all active:scale-95 flex items-center gap-1.5"
          >
            <Save className="w-4 h-4" /> Gravar Alterações no Banco
          </button>
        </div>
      </div>
    </div>
  );
}
