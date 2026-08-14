import React, { useState, useMemo } from 'react';
import { User } from '../types';
import { 
  ChevronLeft, 
  Search, 
  Send, 
  Check, 
  RefreshCw, 
  Edit, 
  Trash2, 
  Plus, 
  X, 
  RotateCcw, 
  Copy, 
  Info,
  Sliders,
  Sparkles,
  MessageSquare,
  Users,
  CheckCheck,
  CheckSquare,
  Square,
  CornerDownRight,
  ChevronRight,
  ChevronLeft as ChevronLeftIcon,
  Upload,
  FileText,
  Loader2
} from 'lucide-react';

interface WhatsAppManagerProps {
  currentUser: User | null;
  usersList: User[];
  onBack: () => void;
}

interface Template {
  id: string;
  title: string;
  category: 'Serviço' | 'Administrativo' | 'Geral';
  text: string;
  description: string;
}

const PREDEFINED_TEMPLATES: Template[] = [
  {
    id: 'convocacao',
    title: 'Convocação para Serviço Extra',
    category: 'Serviço',
    description: 'Convocação oficial para serviço extraordinário ou instrução militar.',
    text: 'Olá, {RANK} {NOME}! Você está sendo convocado para comparecer ao quartel no dia [DATA] às [HORA]h para fins de [MOTIVO/SERVIÇO]. Favor confirmar o recebimento e leitura desta mensagem de convocação oficial.'
  },
  {
    id: 'escala_alteracao',
    title: 'Aviso de Alteração de Escala',
    category: 'Serviço',
    description: 'Informa o militar sobre alteração de última hora na escala de serviço.',
    text: 'Prezado {RANK} {NOME}, informamos que houve uma alteração na escala de serviço referente ao dia [DATA]. Favor verificar o painel do sistema Argos para confirmar seus novos horários e reportar ciência ao comandante da guarda/unidade.'
  },
  {
    id: 'documentos_pendentes',
    title: 'Solicitação de Documento Administrativo',
    category: 'Administrativo',
    description: 'Cobrança de documentos ou atualização da pasta funcional.',
    text: 'Olá, {RANK} {NOME}. Solicitamos o envio ou entrega do documento pendente ([NOME DO DOCUMENTO]) ao setor de pessoal (P1/RH) até o dia [DATA], para fins de regularização e atualização de sua pasta funcional.'
  },
  {
    id: 'reuniao_unidade',
    title: 'Convocação para Reunião Geral',
    category: 'Geral',
    description: 'Convocação para reuniões gerais ou preleções administrativas.',
    text: 'Atenção, {RANK} {NOME}. Convocamos todos os militares desta unidade para participar da reunião geral administrativa a ser realizada no dia [DATA] às [HORA]h. Pauta: [ASSUNTO]. A presença é obrigatória e de caráter de serviço.'
  },
  {
    id: 'lembrete_geral',
    title: 'Mensagem Geral de Contato',
    category: 'Geral',
    description: 'Mensagem padrão amigável para contato direto.',
    text: 'Olá, {RANK} {NOME}. Aqui é o {SENDER_RANK} {SENDER_NOME} do setor de Gestão Pessoal. Gostaria de falar com você a respeito de [ASSUNTO]. Por favor, responda a esta mensagem assim que estiver disponível.'
  }
];

// Helper to extract custom [PLACEHOLDERS] from text template
const getCustomPlaceholders = (text: string): string[] => {
  const matches = text.match(/\[([^\]]+)\]/g) || [];
  // Remove duplicates and square brackets
  const uniqueKeys = Array.from(new Set(matches)).map(m => m.slice(1, -1));
  return uniqueKeys;
};

export const WhatsAppManager: React.FC<WhatsAppManagerProps> = ({ currentUser, usersList, onBack }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOfficerIds, setSelectedOfficerIds] = useState<string[]>([]);
  const [activeOfficerIdForPreview, setActiveOfficerIdForPreview] = useState<string>('');
  const [sentOfficerIds, setSentOfficerIds] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  // Filters for batch selection
  const [filterUnit, setFilterUnit] = useState('');
  const [filterRank, setFilterRank] = useState('');

  // Load templates from localStorage or use predefined
  const [templates, setTemplates] = useState<Template[]>(() => {
    const saved = localStorage.getItem('argos_whatsapp_templates');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Erro ao decodificar modelos do localStorage:', e);
      }
    }
    return PREDEFINED_TEMPLATES;
  });

  // Selected template ID state
  const [selectedTemplateId, setSelectedTemplateId] = useState(() => {
    return templates[0]?.id || PREDEFINED_TEMPLATES[0].id;
  });

  // Dynamic variable field inputs
  const [dynamicFields, setDynamicFields] = useState<Record<string, string>>({});

  // Attachment / PDF Link states
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [attachmentName, setAttachmentName] = useState('');

  // PDF upload states
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [isDragActive, setIsDragActive] = useState(false);

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setUploadError('Apenas arquivos PDF são permitidos.');
      return;
    }

    // Limit size to 15MB
    if (file.size > 15 * 1024 * 1024) {
      setUploadError('O arquivo PDF não deve exceder 15MB.');
      return;
    }

    setIsUploading(true);
    setUploadError('');

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const result = reader.result as string;
          const base64Data = result.split(',')[1];

          const response = await fetch('/api/upload-pdf', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              filename: file.name,
              base64Data,
            }),
          });

          if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || 'Erro ao fazer upload do PDF para o servidor.');
          }

          const data = await response.json();
          const downloadUrl = `${window.location.origin}${data.url}`;

          setAttachmentName(file.name.replace(/\.pdf$/i, ''));
          setAttachmentUrl(downloadUrl);
          setIsManualEdit(false);
        } catch (error: any) {
          console.error(error);
          setUploadError(error.message || 'Erro ao processar o arquivo.');
        } finally {
          setIsUploading(false);
        }
      };

      reader.onerror = () => {
        setUploadError('Erro ao ler o arquivo.');
        setIsUploading(false);
      };

      reader.readAsDataURL(file);
    } catch (error: any) {
      console.error(error);
      setUploadError('Erro na leitura ou upload do arquivo.');
      setIsUploading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };
  
  // Custom manual edit states
  const [messageBody, setMessageBody] = useState('');
  const [isManualEdit, setIsManualEdit] = useState(false);

  // Manage Templates Modal State
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  
  // Template Form Fields
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState<'Serviço' | 'Administrativo' | 'Geral'>('Geral');
  const [formDescription, setFormDescription] = useState('');
  const [formText, setFormText] = useState('');
  const [customVariableInput, setCustomVariableInput] = useState('');

  // Save to LocalStorage helper
  const saveTemplates = (newTemplates: Template[]) => {
    setTemplates(newTemplates);
    localStorage.setItem('argos_whatsapp_templates', JSON.stringify(newTemplates));
  };

  // Filter out any default or non-militar users with phone numbers
  const officers = useMemo(() => {
    return usersList.filter(u => {
      const isSessionCopy = (u as any).is_session || u.ord === 99;
      return !isSessionCopy && u.telefone;
    });
  }, [usersList]);

  // Extract unique units & ranks for batch selection
  const uniqueUnits = useMemo(() => {
    const unitsSet = new Set<string>();
    officers.forEach(o => {
      if (o.unidade) unitsSet.add(o.unidade);
    });
    return Array.from(unitsSet).sort();
  }, [officers]);

  const uniqueRanks = useMemo(() => {
    const ranksSet = new Set<string>();
    officers.forEach(o => {
      if (o.rank) ranksSet.add(o.rank);
    });
    return Array.from(ranksSet).sort();
  }, [officers]);

  // Get selected officers array
  const selectedOfficers = useMemo(() => {
    return officers.filter(o => selectedOfficerIds.includes(o.id));
  }, [officers, selectedOfficerIds]);

  // Selected officer for active preview
  const previewOfficer = useMemo(() => {
    const activeId = activeOfficerIdForPreview || selectedOfficerIds[0];
    return officers.find(o => o.id === activeId);
  }, [officers, selectedOfficerIds, activeOfficerIdForPreview]);

  // Index of current preview officer in selection array
  const currentPreviewIndex = useMemo(() => {
    if (!previewOfficer) return -1;
    return selectedOfficerIds.indexOf(previewOfficer.id);
  }, [selectedOfficerIds, previewOfficer]);

  // Selected template data
  const selectedTemplate = useMemo(() => {
    return templates.find(t => t.id === selectedTemplateId) || templates[0] || PREDEFINED_TEMPLATES[0];
  }, [templates, selectedTemplateId]);

  // Extract dynamic placeholders from active template
  const currentPlaceholders = useMemo(() => {
    return getCustomPlaceholders(selectedTemplate.text);
  }, [selectedTemplate]);

  // Filter officers for search results
  const filteredOfficers = useMemo(() => {
    if (!searchTerm) return [];
    const term = searchTerm.toLowerCase();
    return officers.filter(o => 
      o.nome.toLowerCase().includes(term) ||
      (o.nome_completo && o.nome_completo.toLowerCase().includes(term)) ||
      o.matricula.includes(term)
    ).slice(0, 5);
  }, [officers, searchTerm]);

  // Custom function to generate message for any officer
  const getMessageForOfficer = (officer: User | undefined) => {
    if (!officer) return '';
    let text = selectedTemplate.text;

    // Replace officer rank & name
    const rank = officer.rank || 'Policial';
    const nome = officer.nome || '[NOME]';
    text = text.replace(/{RANK}/g, rank).replace(/{NOME}/g, nome);

    // Replace sender rank & name
    const senderRank = currentUser?.rank || 'Administrador';
    const senderNome = currentUser?.nome || 'Gestão Pessoal';
    text = text.replace(/{SENDER_RANK}/g, senderRank).replace(/{SENDER_NOME}/g, senderNome);

    // Replace each custom placeholder [KEY] with dynamicFields[KEY]
    currentPlaceholders.forEach(placeholder => {
      const val = dynamicFields[placeholder];
      const escaped = placeholder.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(`\\[${escaped}\\]`, 'g');
      text = text.replace(regex, val || `[${placeholder}]`);
    });

    // Handle attachment link formatting
    if (attachmentUrl) {
      if (text.includes('{LINK_ANEXO}')) {
        text = text.replace(/{LINK_ANEXO}/g, attachmentUrl);
      } else {
        const label = attachmentName ? `🔗 Anexo (${attachmentName}): ` : '🔗 Documento Anexo: ';
        text = text + `\n\n${label}${attachmentUrl}`;
      }
    } else {
      text = text.replace(/{LINK_ANEXO}/g, '[LINK DO ANEXO]');
    }

    return text;
  };

  // Live preview interpolated message text
  const generatedMessage = useMemo(() => {
    return getMessageForOfficer(previewOfficer);
  }, [selectedTemplate, previewOfficer, currentUser, dynamicFields, currentPlaceholders, attachmentUrl, attachmentName]);

  // Active message text (manual edits vs generated)
  const activeMessageText = isManualEdit ? messageBody : generatedMessage;

  // Handle template selection
  const handleTemplateSelect = (id: string) => {
    setSelectedTemplateId(id);
    setIsManualEdit(false);
  };

  // Toggle single officer selection
  const handleToggleOfficer = (officer: User) => {
    setSelectedOfficerIds(prev => {
      const isSelected = prev.includes(officer.id);
      if (isSelected) {
        const next = prev.filter(id => id !== officer.id);
        if (activeOfficerIdForPreview === officer.id) {
          setActiveOfficerIdForPreview(next[0] || '');
        }
        return next;
      } else {
        const next = [...prev, officer.id];
        setActiveOfficerIdForPreview(officer.id);
        return next;
      }
    });
    setSearchTerm('');
    setIsManualEdit(false);
  };

  // Batch Select Actions
  const handleSelectAllFiltered = () => {
    let matches = officers;
    if (filterUnit) {
      matches = matches.filter(o => o.unidade === filterUnit);
    }
    if (filterRank) {
      matches = matches.filter(o => o.rank === filterRank);
    }

    const matchIds = matches.map(o => o.id);
    setSelectedOfficerIds(prev => {
      // Merge unique IDs
      const merged = Array.from(new Set([...prev, ...matchIds]));
      if (merged.length > 0 && !merged.includes(activeOfficerIdForPreview)) {
        setActiveOfficerIdForPreview(merged[0]);
      }
      return merged;
    });
    setIsManualEdit(false);
  };

  const handleDeselectAllFiltered = () => {
    let matches = officers;
    if (filterUnit) {
      matches = matches.filter(o => o.unidade === filterUnit);
    }
    if (filterRank) {
      matches = matches.filter(o => o.rank === filterRank);
    }

    const matchIds = matches.map(o => o.id);
    setSelectedOfficerIds(prev => {
      const next = prev.filter(id => !matchIds.includes(id));
      if (activeOfficerIdForPreview && !next.includes(activeOfficerIdForPreview)) {
        setActiveOfficerIdForPreview(next[0] || '');
      }
      return next;
    });
    setIsManualEdit(false);
  };

  const handleClearSelection = () => {
    setSelectedOfficerIds([]);
    setActiveOfficerIdForPreview('');
    setSentOfficerIds([]);
    setIsManualEdit(false);
  };

  // Send WhatsApp to specific officer
  const handleSendWhatsApp = (officer: User) => {
    if (!officer || !officer.telefone) return;
    
    const phoneClean = officer.telefone.replace(/\D/g, '');
    let finalPhone = phoneClean;
    if (finalPhone.length === 10 || finalPhone.length === 11) {
      if (!finalPhone.startsWith('55')) {
        finalPhone = '55' + finalPhone;
      }
    }

    // Use current active manually edited message if we are previewing this officer and manual edits are active, 
    // otherwise generate the template text dynamically for them.
    const messageToSend = (isManualEdit && previewOfficer?.id === officer.id)
      ? messageBody
      : getMessageForOfficer(officer);

    const encodedText = encodeURIComponent(messageToSend);
    const url = `https://wa.me/${finalPhone}?text=${encodedText}`;
    window.open(url, '_blank');

    // Mark as sent in session list
    if (!sentOfficerIds.includes(officer.id)) {
      setSentOfficerIds(prev => [...prev, officer.id]);
    }
  };

  // Send to active previewed officer
  const handleSendActive = () => {
    if (previewOfficer) {
      handleSendWhatsApp(previewOfficer);
    }
  };

  // Advance preview to next selected officer
  const handleNextOfficer = () => {
    if (selectedOfficerIds.length === 0) return;
    const nextIndex = (currentPreviewIndex + 1) % selectedOfficerIds.length;
    const nextId = selectedOfficerIds[nextIndex];
    setActiveOfficerIdForPreview(nextId);
    setIsManualEdit(false);
  };

  const handlePrevOfficer = () => {
    if (selectedOfficerIds.length === 0) return;
    const prevIndex = (currentPreviewIndex - 1 + selectedOfficerIds.length) % selectedOfficerIds.length;
    const nextId = selectedOfficerIds[prevIndex];
    setActiveOfficerIdForPreview(nextId);
    setIsManualEdit(false);
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(activeMessageText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // --- Modal Editing Functions ---
  const handleOpenManageModal = () => {
    setIsManageModalOpen(true);
    if (templates.length > 0) {
      handleSelectEditingTemplate(templates[0]);
    } else {
      setEditingTemplateId(null);
      clearForm();
    }
  };

  const handleSelectEditingTemplate = (t: Template) => {
    setEditingTemplateId(t.id);
    setFormTitle(t.title);
    setFormCategory(t.category);
    setFormDescription(t.description);
    setFormText(t.text);
  };

  const clearForm = () => {
    setFormTitle('');
    setFormCategory('Geral');
    setFormDescription('');
    setFormText('');
    setEditingTemplateId(null);
  };

  const handleAddNewTemplate = () => {
    const newId = 'modelo_' + Date.now();
    const newTemplate: Template = {
      id: newId,
      title: 'Novo Modelo de Texto',
      category: 'Geral',
      description: 'Descrição curta do propósito deste aviso.',
      text: 'Olá, {RANK} {NOME}! Mensagem de exemplo.'
    };

    const updated = [...templates, newTemplate];
    saveTemplates(updated);
    handleSelectEditingTemplate(newTemplate);
  };

  const handleSaveTemplate = () => {
    if (!formTitle.trim()) {
      alert('Por favor, informe o título do modelo.');
      return;
    }

    if (editingTemplateId) {
      const updated = templates.map(t => {
        if (t.id === editingTemplateId) {
          return {
            ...t,
            title: formTitle,
            category: formCategory,
            description: formDescription,
            text: formText
          };
        }
        return t;
      });
      saveTemplates(updated);
      alert('Modelo salvo com sucesso!');
    }
  };

  const handleDeleteTemplate = (id: string) => {
    if (window.confirm('Tem certeza de que deseja remover este modelo de texto permanentemente?')) {
      const updated = templates.filter(t => t.id !== id);
      saveTemplates(updated);
      
      if (editingTemplateId === id) {
        if (updated.length > 0) {
          handleSelectEditingTemplate(updated[0]);
        } else {
          clearForm();
        }
      }

      if (selectedTemplateId === id) {
        if (updated.length > 0) {
          setSelectedTemplateId(updated[0].id);
        } else if (PREDEFINED_TEMPLATES.length > 0) {
          setSelectedTemplateId(PREDEFINED_TEMPLATES[0].id);
        }
      }
    }
  };

  const handleResetToDefaults = () => {
    if (window.confirm('Deseja restaurar todos os modelos padrão originais? Todas as suas alterações e novos modelos criados serão apagados.')) {
      saveTemplates(PREDEFINED_TEMPLATES);
      setSelectedTemplateId(PREDEFINED_TEMPLATES[0].id);
      setIsManageModalOpen(false);
      setIsManualEdit(false);
      alert('Modelos restaurados com sucesso!');
    }
  };

  const insertTagAtCursor = (tag: string) => {
    const textarea = document.getElementById('template-editor-textarea') as HTMLTextAreaElement;
    if (!textarea) {
      setFormText(prev => prev + tag);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = formText;
    const newText = text.substring(0, start) + tag + text.substring(end);
    setFormText(newText);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + tag.length, start + tag.length);
    }, 0);
  };

  const handleAddCustomVariable = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customVariableInput.trim()) return;
    const formattedTag = `[${customVariableInput.trim().toUpperCase()}]`;
    insertTagAtCursor(formattedTag);
    setCustomVariableInput('');
  };

  return (
    <div className="space-y-6 animate-fade-in" id="whatsapp-manager">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-navy-100 pb-4 gap-4">
        <div className="flex items-center space-x-3">
          <button 
            onClick={onBack}
            className="w-10 h-10 bg-navy-50 text-navy-600 hover:bg-navy-100 rounded-xl transition-all flex items-center justify-center border border-navy-100"
            id="back-from-whatsapp"
          >
            <ChevronLeft size={18} />
          </button>
          <div>
            <span className="text-[10px] font-black tracking-widest text-[#CB9E1B] uppercase">Ferramentas de Comunicação</span>
            <h3 className="text-xl font-black text-navy-950 uppercase tracking-tighter">Gerador de Avisos Coletivos via WhatsApp</h3>
            <p className="text-[10px] text-navy-400 font-bold uppercase tracking-widest mt-0.5">Selecione vários policiais e envie mensagens personalizadas em lote</p>
          </div>
        </div>

        {/* Edit templates trigger */}
        <button
          type="button"
          onClick={handleOpenManageModal}
          className="px-4 py-2.5 bg-navy-950 hover:bg-navy-800 text-white rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all shadow-md active:scale-95 self-start md:self-auto"
          id="manage-templates-trigger"
        >
          <Edit size={12} className="text-[#CB9E1B]" />
          <span>Configurar Modelos</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Selector, Templates & Form Inputs (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* STEP 1: Select Officer */}
          <div className="bg-white border border-navy-100 rounded-3xl p-6 shadow-lg space-y-4" id="step-select-officer">
            <div className="flex items-center justify-between border-b border-navy-50 pb-2">
              <h4 className="text-navy-950 font-black uppercase text-xs flex items-center gap-2">
                <span className="w-5 h-5 bg-navy-900 text-white font-mono text-[10px] rounded-full flex items-center justify-center">1</span>
                Selecione os Policiais Militares
              </h4>
              <span className="text-[9px] font-black text-[#CB9E1B] uppercase tracking-widest">({selectedOfficerIds.length} Selecionados)</span>
            </div>

            {/* Quick Batch Selection Card */}
            <div className="bg-navy-50/50 border border-navy-100/80 rounded-2xl p-4 space-y-3.5">
              <div className="flex items-center gap-2 text-[9px] font-black uppercase text-navy-800 tracking-wider">
                <Users size={12} className="text-navy-600" />
                <span>Seleção Coletiva / Filtro por Lote</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[8px] font-black uppercase text-navy-400 tracking-wider">Filtrar por Unidade</label>
                  <select
                    value={filterUnit}
                    onChange={(e) => setFilterUnit(e.target.value)}
                    className="w-full bg-white border border-navy-100 rounded-xl px-2.5 py-2 text-[10px] font-bold text-navy-950 outline-none focus:border-navy-600 uppercase"
                  >
                    <option value="">TODAS AS UNIDADES</option>
                    {uniqueUnits.map(unit => (
                      <option key={unit} value={unit}>{unit}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[8px] font-black uppercase text-navy-400 tracking-wider">Filtrar por Patente / Graduação</label>
                  <select
                    value={filterRank}
                    onChange={(e) => setFilterRank(e.target.value)}
                    className="w-full bg-white border border-navy-100 rounded-xl px-2.5 py-2 text-[10px] font-bold text-navy-950 outline-none focus:border-navy-600 uppercase"
                  >
                    <option value="">TODAS AS PATENTES</option>
                    {uniqueRanks.map(rank => (
                      <option key={rank} value={rank}>{rank}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-1 border-t border-navy-100/40">
                <button
                  type="button"
                  onClick={handleSelectAllFiltered}
                  className="px-3 py-2 bg-navy-950 hover:bg-navy-800 text-white rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1 active:scale-95"
                >
                  <CheckSquare size={10} className="text-[#CB9E1B]" />
                  <span>Selecionar Filtrados</span>
                </button>
                
                <button
                  type="button"
                  onClick={handleDeselectAllFiltered}
                  className="px-3 py-2 bg-navy-100 hover:bg-navy-200 text-navy-700 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1 active:scale-95"
                >
                  <Square size={10} />
                  <span>Remover Filtrados</span>
                </button>

                <button
                  type="button"
                  onClick={handleClearSelection}
                  disabled={selectedOfficerIds.length === 0}
                  className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1 disabled:opacity-50 disabled:pointer-events-none active:scale-95 ml-auto border border-rose-100/50"
                >
                  <Trash2 size={10} />
                  <span>Limpar Tudo</span>
                </button>
              </div>
            </div>

            {/* Individual Search Block */}
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-navy-400" size={16} />
                <input
                  type="text"
                  placeholder="Pesquisar policial individualmente para adicionar/remover..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-navy-50/50 border border-navy-100 rounded-xl text-xs font-bold text-navy-950 placeholder-navy-300 focus:outline-none focus:border-navy-600 focus:bg-white transition-all uppercase"
                />
              </div>

              {/* Suggestions */}
              {searchTerm && filteredOfficers.length > 0 && (
                <div className="border border-navy-100 rounded-2xl bg-white shadow-xl overflow-hidden divide-y divide-navy-50 animate-fade-in z-20 relative">
                  {filteredOfficers.map((o) => {
                    const isSelected = selectedOfficerIds.includes(o.id);
                    return (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => handleToggleOfficer(o)}
                        className="w-full text-left p-4 hover:bg-navy-50 flex items-center justify-between transition-colors"
                      >
                        <div>
                          <p className="text-xs font-black text-navy-950 uppercase">{o.rank} {o.nome}</p>
                          <p className="text-[9px] font-bold text-navy-400 uppercase">MATRÍCULA: {o.matricula} • {o.unidade || 'Sem Unidade'}</p>
                        </div>
                        <span className={`text-[9px] font-black uppercase border rounded-lg px-2.5 py-1 transition-all ${
                          isSelected 
                            ? 'bg-rose-50 text-rose-700 border-rose-100' 
                            : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                        }`}>
                          {isSelected ? 'Remover' : 'Adicionar'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {searchTerm && filteredOfficers.length === 0 && (
                <div className="text-center py-6 text-navy-400 text-xs font-bold uppercase border border-navy-100 rounded-2xl bg-navy-50/20">
                  Nenhum policial com telefone cadastrado foi encontrado.
                </div>
              )}
            </div>

            {/* Render Selected Recipient Chips */}
            {selectedOfficers.length > 0 && (
              <div className="space-y-2">
                <span className="text-[9px] font-black uppercase text-navy-400 tracking-wider block">Lista de Policiais Selecionados ({selectedOfficers.length})</span>
                <div className="flex flex-wrap gap-2 max-h-[160px] overflow-y-auto p-1 border border-navy-50 rounded-xl bg-navy-50/20">
                  {selectedOfficers.map(o => {
                    const isPreviewed = previewOfficer?.id === o.id;
                    const isSent = sentOfficerIds.includes(o.id);
                    return (
                      <div 
                        key={o.id} 
                        onClick={() => {
                          setActiveOfficerIdForPreview(o.id);
                          setIsManualEdit(false);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase transition-all flex items-center gap-1.5 cursor-pointer border ${
                          isPreviewed 
                            ? 'bg-navy-950 border-navy-950 text-white shadow-sm' 
                            : 'bg-white hover:bg-navy-50 text-navy-950 border-navy-100'
                        }`}
                      >
                        {isSent ? (
                          <CheckCheck size={11} className="text-emerald-500" />
                        ) : (
                          <span className={`w-1.5 h-1.5 rounded-full ${isPreviewed ? 'bg-[#CB9E1B]' : 'bg-navy-300'}`}></span>
                        )}
                        <span>{o.rank} {o.nome}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleOfficer(o);
                          }}
                          className={`ml-1 hover:text-rose-500 rounded-full p-0.5 transition-colors ${isPreviewed ? 'text-white/60 hover:bg-white/10' : 'text-navy-400 hover:bg-navy-100'}`}
                        >
                          <X size={10} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* STEP 2: Predefined / Custom Templates selection */}
          <div className="bg-white border border-navy-100 rounded-3xl p-6 shadow-lg space-y-4" id="step-select-template">
            <div className="flex items-center justify-between border-b border-navy-50 pb-2">
              <h4 className="text-navy-950 font-black uppercase text-xs flex items-center gap-2">
                <span className="w-5 h-5 bg-navy-900 text-white font-mono text-[10px] rounded-full flex items-center justify-center">2</span>
                Selecione o Modelo de Texto
              </h4>
              <span className="text-[9px] font-bold text-navy-400 uppercase tracking-widest">Modelos Disponíveis ({templates.length})</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[220px] overflow-y-auto pr-1">
              {templates.map((t) => {
                const isActive = selectedTemplateId === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleTemplateSelect(t.id)}
                    className={`p-4 rounded-2xl border text-left transition-all relative ${
                      isActive 
                        ? 'bg-navy-950 border-navy-950 text-white shadow-md' 
                        : 'bg-navy-50/30 border-navy-100 text-navy-950 hover:bg-navy-50 hover:border-navy-200'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-black text-xs uppercase tracking-tight">{t.title}</span>
                      <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${
                        isActive ? 'bg-white/20 text-white' : 'bg-navy-100 text-navy-600'
                      }`}>
                        {t.category}
                      </span>
                    </div>
                    <p className={`text-[10px] leading-relaxed mt-1.5 ${
                      isActive ? 'text-navy-200' : 'text-navy-400 font-bold'
                    }`}>
                      {t.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* STEP 3: Dynamic Variable Fillers */}
          <div className="bg-white border border-navy-100 rounded-3xl p-6 shadow-lg space-y-4" id="step-fill-variables">
            <div className="flex items-center justify-between border-b border-navy-50 pb-2">
              <h4 className="text-navy-950 font-black uppercase text-xs flex items-center gap-2">
                <span className="w-5 h-5 bg-navy-900 text-white font-mono text-[10px] rounded-full flex items-center justify-center">3</span>
                Preencha as Variáveis do Texto
              </h4>
              <span className="text-[9px] font-bold text-navy-400 uppercase tracking-widest font-mono">DADOS DINÂMICOS</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {currentPlaceholders.map((placeholder) => (
                <div key={placeholder} className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-navy-500 tracking-wider">
                    {placeholder.replace('/', ' / ')}
                  </label>
                  <input
                    type="text"
                    placeholder={`Preencha o campo ${placeholder.toLowerCase()}...`}
                    value={dynamicFields[placeholder] || ''}
                    onChange={(e) => {
                      setDynamicFields({ ...dynamicFields, [placeholder]: e.target.value });
                      setIsManualEdit(false);
                    }}
                    className="w-full bg-navy-50/50 border border-navy-100 rounded-xl px-3 py-2 text-xs font-bold text-navy-950 outline-none focus:border-navy-600 focus:bg-white transition-all uppercase"
                  />
                </div>
              ))}
              {currentPlaceholders.length === 0 && (
                <p className="text-center text-[10px] text-navy-400 font-bold uppercase py-4 sm:col-span-2">
                  Este modelo não possui variáveis adicionais de preenchimento. Ele se ajusta automaticamente ao remetente e destinatário selecionados.
                </p>
              )}
            </div>
          </div>

          {/* STEP 4: Anexar Documento / Link do PDF */}
          <div className="bg-white border border-navy-100 rounded-3xl p-6 shadow-lg space-y-4" id="step-attachment">
            <div className="flex items-center justify-between border-b border-navy-50 pb-2">
              <h4 className="text-navy-950 font-black uppercase text-xs flex items-center gap-2">
                <span className="w-5 h-5 bg-navy-900 text-white font-mono text-[10px] rounded-full flex items-center justify-center">4</span>
                Anexar Documento / PDF (Opcional)
              </h4>
              <span className="text-[9px] font-bold text-[#CB9E1B] uppercase tracking-widest font-mono">LINK DE DOWNLOAD</span>
            </div>

            <div className="space-y-4">
              {/* Drag and Drop Uploader Block */}
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all relative flex flex-col items-center justify-center cursor-pointer ${
                  isDragActive
                    ? 'border-navy-950 bg-navy-50/70'
                    : 'border-navy-200 bg-navy-50/20 hover:bg-navy-50/50 hover:border-navy-400'
                }`}
              >
                <input
                  type="file"
                  id="pdf-upload-input"
                  accept=".pdf"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileUpload(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />
                
                <label htmlFor="pdf-upload-input" className="w-full h-full cursor-pointer flex flex-col items-center justify-center space-y-2">
                  {isUploading ? (
                    <div className="flex flex-col items-center space-y-2 py-2">
                      <Loader2 className="w-8 h-8 text-[#CB9E1B] animate-spin" />
                      <span className="text-[10px] font-black uppercase text-navy-800 tracking-wider">Salvando PDF no Servidor...</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center space-y-2 py-2">
                      <div className="w-10 h-10 bg-navy-100 rounded-xl flex items-center justify-center border border-navy-200 text-navy-800">
                        <Upload size={18} />
                      </div>
                      <div>
                        <span className="text-[10px] font-black uppercase text-navy-950 block tracking-wider">
                          Arraste seu PDF aqui ou clique para fazer upload
                        </span>
                        <span className="text-[8.5px] font-bold text-navy-400 uppercase tracking-tight block mt-0.5">
                          O arquivo será salvo no servidor e gerará um link curto e seguro para envio
                        </span>
                      </div>
                    </div>
                  )}
                </label>
              </div>

              {uploadError && (
                <div className="text-[9px] font-black uppercase text-rose-600 bg-rose-50 border border-rose-100 rounded-xl p-3 flex items-center gap-2 animate-fade-in">
                  <X size={12} className="flex-shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}

              {/* Editable Fields (Populated by upload or manual input) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-navy-500 tracking-wider">Identificação / Nome do PDF</label>
                  <input
                    type="text"
                    placeholder="Ex: Escala de Plantão, Boletim Interno"
                    value={attachmentName}
                    onChange={(e) => {
                      setAttachmentName(e.target.value);
                      setIsManualEdit(false);
                    }}
                    className="w-full bg-navy-50/50 border border-navy-100 rounded-xl px-3 py-2 text-xs font-bold text-navy-950 outline-none focus:border-navy-600 focus:bg-white transition-all uppercase"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-navy-500 tracking-wider">Link de Download (Gerado Automaticamente)</label>
                  <input
                    type="url"
                    placeholder="Upload um arquivo PDF ou cole um link..."
                    value={attachmentUrl}
                    onChange={(e) => {
                      setAttachmentUrl(e.target.value);
                      setIsManualEdit(false);
                    }}
                    className="w-full bg-navy-50/50 border border-navy-100 rounded-xl px-3 py-2 text-xs font-bold text-navy-950 outline-none focus:border-navy-600 focus:bg-white transition-all"
                  />
                </div>
              </div>

              {/* Suggestions / Presets */}
              <div className="bg-navy-50/50 border border-navy-100 p-3.5 rounded-2xl space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-black uppercase text-navy-600 tracking-wider block">Sugestões de Links Rápidos</span>
                  {attachmentUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setAttachmentName('');
                        setAttachmentUrl('');
                        setIsManualEdit(false);
                      }}
                      className="text-[8px] font-black uppercase text-rose-600 hover:text-rose-700 bg-rose-50 border border-rose-100 rounded px-2 py-0.5"
                    >
                      Remover Anexo
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAttachmentName('Escala Mensal Extra');
                      setAttachmentUrl('https://argos.sistema.pm/escalas/escala_servico_extra.pdf');
                      setIsManualEdit(false);
                    }}
                    className="px-2.5 py-1.5 bg-white hover:bg-navy-900 hover:text-white rounded-lg text-[8.5px] font-bold border border-navy-100 transition-colors uppercase tracking-wider"
                  >
                    📄 Escala de Serviço (PDF)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAttachmentName('Boletim Geral da Unidade');
                      setAttachmentUrl('https://argos.sistema.pm/boletins/boletim_geral_unidade.pdf');
                      setIsManualEdit(false);
                    }}
                    className="px-2.5 py-1.5 bg-white hover:bg-navy-900 hover:text-white rounded-lg text-[8.5px] font-bold border border-navy-100 transition-colors uppercase tracking-wider"
                  >
                    📄 Boletim Geral (PDF)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAttachmentName('Diretrizes Operacionais');
                      setAttachmentUrl('https://argos.sistema.pm/diretrizes/diretriz_abordagem.pdf');
                      setIsManualEdit(false);
                    }}
                    className="px-2.5 py-1.5 bg-white hover:bg-navy-900 hover:text-white rounded-lg text-[8.5px] font-bold border border-navy-100 transition-colors uppercase tracking-wider"
                  >
                    📄 Diretrizes PM (PDF)
                  </button>
                </div>
              </div>

              {attachmentUrl && (
                <div className="text-[9.5px] font-black uppercase text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-xl p-3 flex items-center gap-2 animate-fade-in">
                  <Check size={14} />
                  <span>Anexo preparado para envio! O link será enviado aos policiais selecionados.</span>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Right Column: Preview & Dispatches Panel (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-navy-950 border border-navy-900 rounded-[2rem] p-6 shadow-2xl text-white flex flex-col h-full justify-between min-h-[500px]" id="step-preview-panel">
            <div>
              {/* Phone Header Mockup */}
              <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
                <div className="flex items-center space-x-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#10b981] animate-pulse"></div>
                  <span className="font-mono text-[9px] font-black tracking-wider text-white/50 uppercase">Visualizador de Envio</span>
                </div>
                <div className="text-[8px] font-black uppercase bg-white/10 text-white/70 px-2.5 py-0.5 rounded-full border border-white/5 max-w-[180px] truncate" title={selectedTemplate.title}>
                  {selectedTemplate.title}
                </div>
              </div>

              {selectedOfficerIds.length === 0 ? (
                /* Empty state warning */
                <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                  <Users size={48} className="text-white/10" />
                  <div>
                    <h5 className="font-black text-xs uppercase tracking-tight text-white/80">Nenhum Policial Selecionado</h5>
                    <p className="text-[9.5px] text-white/40 uppercase max-w-[200px] mx-auto leading-relaxed mt-1">Selecione destinatários no Passo 1 para visualizar o texto dinâmico.</p>
                  </div>
                </div>
              ) : (
                /* Interactive Queue and Preview */
                <div className="space-y-4">
                  
                  {/* Queue Navigator */}
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 flex items-center justify-between">
                    <button 
                      type="button"
                      onClick={handlePrevOfficer}
                      className="w-8 h-8 hover:bg-white/10 rounded-lg flex items-center justify-center text-white/70 hover:text-white transition-colors"
                      title="Militar Anterior"
                    >
                      <ChevronLeftIcon size={16} />
                    </button>

                    <div className="text-center">
                      <span className="text-[8px] font-black uppercase text-white/40 tracking-wider">Fila de Disparo (Militar {currentPreviewIndex + 1} de {selectedOfficerIds.length})</span>
                      <h5 className="text-xs font-black uppercase text-[#CB9E1B] truncate max-w-[180px]">
                        {previewOfficer?.rank} {previewOfficer?.nome}
                      </h5>
                    </div>

                    <button 
                      type="button"
                      onClick={handleNextOfficer}
                      className="w-8 h-8 hover:bg-white/10 rounded-lg flex items-center justify-center text-white/70 hover:text-white transition-colors"
                      title="Próximo Militar"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>

                  {/* Text Area */}
                  <div className="space-y-2">
                    <label className="text-[9px] font-black uppercase text-white/40 tracking-wider">Corpo da Mensagem (Editável)</label>
                    <textarea
                      value={activeMessageText}
                      onChange={(e) => {
                        setMessageBody(e.target.value);
                        setIsManualEdit(true);
                      }}
                      className="w-full min-h-[220px] bg-white/5 border border-white/10 rounded-2xl p-4 text-xs font-medium text-white placeholder-white/30 leading-relaxed outline-none focus:border-white/30 resize-none font-sans"
                      placeholder="Escreva sua mensagem personalizada..."
                    />
                  </div>

                  {/* Attachment indicator if active */}
                  {attachmentUrl && (
                    <div className="bg-[#CB9E1B]/10 border border-[#CB9E1B]/20 text-[#CB9E1B] rounded-xl p-3 text-[9px] font-black uppercase flex items-center gap-1.5">
                      <Info size={12} />
                      <span>{attachmentName || 'Anexo'} configurado com sucesso!</span>
                    </div>
                  )}

                  {/* Sent Badge indicator */}
                  {previewOfficer && sentOfficerIds.includes(previewOfficer.id) && (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl p-2.5 text-[9px] font-black uppercase flex items-center justify-center gap-1.5 animate-fade-in">
                      <CheckCheck size={12} />
                      <span>Mensagem já enviada via link nesta sessão</span>
                    </div>
                  )}

                  {/* Tips */}
                  <div className="flex items-start gap-2 text-[9.5px] font-bold text-white/40 uppercase">
                    <Info size={14} className="text-white/50 mt-0.5" />
                    <p className="leading-relaxed">Abaixo, envie individualmente para cada policial ou use os botões da fila acima para avançar.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Actions Panel */}
            <div className="border-t border-white/10 pt-6 mt-6 space-y-3">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCopyText}
                  disabled={selectedOfficerIds.length === 0}
                  className="flex-1 bg-white/5 hover:bg-white/10 disabled:opacity-50 text-white font-black text-[10px] uppercase tracking-widest py-3 px-4 rounded-xl transition-all border border-white/10 active:scale-95 flex items-center justify-center gap-1.5"
                >
                  {copied ? (
                    <>
                      <Check size={12} className="text-emerald-400" />
                      <span>Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={12} />
                      <span>Copiar Texto</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsManualEdit(false);
                    setDynamicFields({});
                  }}
                  disabled={selectedOfficerIds.length === 0}
                  className="bg-white/5 hover:bg-white/10 text-white/80 hover:text-white p-3 disabled:opacity-50 rounded-xl transition-all border border-white/10 active:scale-95 flex items-center justify-center"
                  title="Restaurar Valores Originais"
                >
                  <RefreshCw size={14} />
                </button>
              </div>

              {selectedOfficerIds.length > 0 && previewOfficer && (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={handleSendActive}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] uppercase tracking-widest py-4 px-6 rounded-xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 border border-emerald-600/20"
                  >
                    <Send size={12} />
                    <span>Enviar para {previewOfficer.rank} {previewOfficer.nome}</span>
                  </button>

                  {/* Quick helper to send and advance */}
                  {selectedOfficerIds.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        handleSendActive();
                        // Advance to next after a delay to allow popup blocker bypass
                        setTimeout(() => {
                          handleNextOfficer();
                        }, 800);
                      }}
                      className="w-full bg-white/10 hover:bg-white/20 text-white font-black text-[9px] uppercase tracking-widest py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 border border-white/10"
                    >
                      <span>Enviar e Próximo Militar</span>
                      <ChevronRight size={12} />
                    </button>
                  )}
                </div>
              )}

              {selectedOfficerIds.length === 0 && (
                <p className="text-center text-[9px] text-[#CB9E1B] font-bold uppercase tracking-wide">
                  * Selecione os policiais no Passo 1 para liberar os disparos.
                </p>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* ================= EDITING / CONFIG MODAL ================= */}
      {isManageModalOpen && (
        <div className="fixed inset-0 bg-navy-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in" id="manage-templates-modal">
          <div className="bg-white border border-navy-100 rounded-[2rem] shadow-2xl max-w-5xl w-full h-[90vh] flex flex-col overflow-hidden">
            
            {/* Modal Header */}
            <div className="bg-[#0A1A30] text-white p-6 flex justify-between items-center border-b border-navy-900">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center border border-white/10 text-[#CB9E1B]">
                  <Sliders size={20} />
                </div>
                <div>
                  <h3 className="font-black text-lg uppercase tracking-tight">Gerenciar Modelos de Mensagem</h3>
                  <p className="text-[10px] text-navy-200 font-bold uppercase tracking-wider">Configure textos prontos com preenchimento dinâmico de variáveis</p>
                </div>
              </div>
              <button 
                onClick={() => setIsManageModalOpen(false)}
                className="w-10 h-10 hover:bg-white/10 rounded-xl transition-all flex items-center justify-center text-white/70 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body: Split screen */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden">
              
              {/* Left Pane: Templates list (5 cols) */}
              <div className="md:col-span-5 border-r border-navy-100 flex flex-col bg-navy-50/30 overflow-hidden">
                <div className="p-4 border-b border-navy-100 flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-navy-400 tracking-wider">Modelos Disponíveis</span>
                  <button
                    type="button"
                    onClick={handleAddNewTemplate}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1 active:scale-95 shadow-sm"
                  >
                    <Plus size={10} />
                    <span>Adicionar</span>
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  {templates.map((t) => {
                    const isEditing = editingTemplateId === t.id;
                    return (
                      <div 
                        key={t.id}
                        onClick={() => handleSelectEditingTemplate(t)}
                        className={`p-3.5 rounded-xl border transition-all text-left cursor-pointer flex items-start justify-between group ${
                          isEditing 
                            ? 'bg-white border-navy-900 shadow-md ring-2 ring-navy-950/5' 
                            : 'bg-white/80 hover:bg-white border-navy-100'
                        }`}
                      >
                        <div className="space-y-1.5 flex-1 pr-2">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-xs text-navy-950 uppercase line-clamp-1">{t.title}</span>
                            <span className="text-[7.5px] font-black uppercase bg-navy-100 text-navy-600 px-1.5 py-0.5 rounded-md flex-shrink-0">
                              {t.category}
                            </span>
                          </div>
                          <p className="text-[9px] font-bold text-navy-400 uppercase line-clamp-2 leading-relaxed">
                            {t.description || 'Sem descrição cadastrada'}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteTemplate(t.id);
                          }}
                          className="w-7 h-7 bg-rose-50 text-rose-600 hover:bg-rose-500 hover:text-white rounded-lg transition-all flex items-center justify-center border border-rose-100 opacity-80 group-hover:opacity-100"
                          title="Excluir Modelo"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    );
                  })}
                  {templates.length === 0 && (
                    <div className="text-center py-12 text-navy-400 text-xs font-bold uppercase">
                      Nenhum modelo cadastrado.
                    </div>
                  )}
                </div>
              </div>

              {/* Right Pane: Editor Form (7 cols) */}
              <div className="md:col-span-7 flex flex-col bg-white overflow-hidden">
                {editingTemplateId ? (
                  <div className="flex-1 overflow-y-auto p-6 space-y-5">
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#CB9E1B] block">Formulário de Edição</span>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                      {/* Title */}
                      <div className="sm:col-span-8 space-y-1">
                        <label className="text-[9px] font-black uppercase text-navy-500 tracking-wider">Título do Modelo</label>
                        <input
                          type="text"
                          value={formTitle}
                          onChange={(e) => setFormTitle(e.target.value)}
                          placeholder="Ex: Convocação Oficial de Serviço"
                          className="w-full bg-navy-50/50 border border-navy-100 rounded-xl px-3 py-2 text-xs font-bold text-navy-950 outline-none focus:border-navy-600 focus:bg-white transition-all uppercase"
                        />
                      </div>

                      {/* Category */}
                      <div className="sm:col-span-4 space-y-1">
                        <label className="text-[9px] font-black uppercase text-navy-500 tracking-wider">Categoria</label>
                        <select
                          value={formCategory}
                          onChange={(e) => setFormCategory(e.target.value as any)}
                          className="w-full bg-navy-50/50 border border-navy-100 rounded-xl px-3 py-2 text-xs font-bold text-navy-950 outline-none focus:border-navy-600 focus:bg-white transition-all uppercase"
                        >
                          <option value="Serviço">Serviço</option>
                          <option value="Administrativo">Administrativo</option>
                          <option value="Geral">Geral</option>
                        </select>
                      </div>

                      {/* Description */}
                      <div className="sm:col-span-12 space-y-1">
                        <label className="text-[9px] font-black uppercase text-navy-500 tracking-wider">Descrição Curta (Finalidade)</label>
                        <input
                          type="text"
                          value={formDescription}
                          onChange={(e) => setFormDescription(e.target.value)}
                          placeholder="Ex: Utilizado para convocar militar para instrução ou escalas extras"
                          className="w-full bg-navy-50/50 border border-navy-100 rounded-xl px-3 py-2 text-xs font-bold text-navy-950 outline-none focus:border-navy-600 focus:bg-white transition-all"
                        />
                      </div>

                      {/* Template text body */}
                      <div className="sm:col-span-12 space-y-2">
                        <div className="flex justify-between items-center">
                          <label className="text-[9px] font-black uppercase text-navy-500 tracking-wider">Texto do Modelo (Suporta Tags)</label>
                          <span className="text-[8px] font-bold text-navy-400 uppercase tracking-tight">Utilize colchetes [CAMPOS] para criar variáveis dinâmicas</span>
                        </div>
                        <textarea
                          id="template-editor-textarea"
                          value={formText}
                          onChange={(e) => setFormText(e.target.value)}
                          placeholder="Olá, {RANK} {NOME}! Escreva seu texto aqui..."
                          className="w-full min-h-[160px] bg-navy-50/50 border border-navy-100 rounded-2xl p-4 text-xs font-medium text-navy-950 leading-relaxed outline-none focus:border-navy-600 focus:bg-white transition-all resize-none"
                        />
                      </div>

                      {/* Helper Tag Inserter */}
                      <div className="sm:col-span-12 space-y-2 bg-navy-50/50 border border-navy-100 p-4 rounded-2xl">
                        <div className="flex items-center gap-1.5 text-[9px] font-black text-navy-900 uppercase">
                          <Sparkles size={11} className="text-[#CB9E1B]" />
                          <span>Clique para Inserir Variáveis no Texto</span>
                        </div>
                        
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          <button
                            type="button"
                            onClick={() => insertTagAtCursor('{RANK}')}
                            className="px-2 py-1 bg-white hover:bg-navy-900 hover:text-white rounded-lg text-[8px] font-black border border-navy-100 transition-colors uppercase tracking-wider"
                            title="Substitui pelo posto/graduação do policial"
                          >
                            Posto/Grad {"{RANK}"}
                          </button>
                          <button
                            type="button"
                            onClick={() => insertTagAtCursor('{NOME}')}
                            className="px-2 py-1 bg-white hover:bg-navy-900 hover:text-white rounded-lg text-[8px] font-black border border-navy-100 transition-colors uppercase tracking-wider"
                            title="Substitui pelo nome de guerra do policial"
                          >
                            Nome Guerra {"{NOME}"}
                          </button>
                          <button
                            type="button"
                            onClick={() => insertTagAtCursor('{SENDER_RANK}')}
                            className="px-2 py-1 bg-white hover:bg-navy-900 hover:text-white rounded-lg text-[8px] font-black border border-navy-100 transition-colors uppercase tracking-wider"
                            title="Substitui pelo posto/graduação de quem envia"
                          >
                            Remetente Posto {"{SENDER_RANK}"}
                          </button>
                          <button
                            type="button"
                            onClick={() => insertTagAtCursor('{SENDER_NOME}')}
                            className="px-2 py-1 bg-white hover:bg-navy-900 hover:text-white rounded-lg text-[8px] font-black border border-navy-100 transition-colors uppercase tracking-wider"
                            title="Substitui pelo nome de guerra de quem envia"
                          >
                            Remetente Nome {"{SENDER_NOME}"}
                          </button>
                          <button
                            type="button"
                            onClick={() => insertTagAtCursor('{LINK_ANEXO}')}
                            className="px-2 py-1 bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white rounded-lg text-[8px] font-black border border-emerald-100 transition-colors uppercase tracking-wider"
                            title="Posiciona o Link do Anexo PDF configurado no Passo 4"
                          >
                            Link do Anexo {"{LINK_ANEXO}"}
                          </button>
                        </div>

                        {/* Standard field templates */}
                        <div className="flex flex-wrap gap-1.5 pt-1 border-t border-navy-100 mt-2">
                          <button
                            type="button"
                            onClick={() => insertTagAtCursor('[DATA]')}
                            className="px-2 py-1 bg-[#CB9E1B]/10 hover:bg-[#CB9E1B] hover:text-white text-[#CB9E1B] rounded-lg text-[8px] font-black border border-[#CB9E1B]/10 transition-colors uppercase tracking-wider"
                          >
                            Data [DATA]
                          </button>
                          <button
                            type="button"
                            onClick={() => insertTagAtCursor('[HORA]')}
                            className="px-2 py-1 bg-[#CB9E1B]/10 hover:bg-[#CB9E1B] hover:text-white text-[#CB9E1B] rounded-lg text-[8px] font-black border border-[#CB9E1B]/10 transition-colors uppercase tracking-wider"
                          >
                            Hora [HORA]
                          </button>
                          <button
                            type="button"
                            onClick={() => insertTagAtCursor('[MOTIVO]')}
                            className="px-2 py-1 bg-[#CB9E1B]/10 hover:bg-[#CB9E1B] hover:text-white text-[#CB9E1B] rounded-lg text-[8px] font-black border border-[#CB9E1B]/10 transition-colors uppercase tracking-wider"
                          >
                            Motivo [MOTIVO]
                          </button>
                          <button
                            type="button"
                            onClick={() => insertTagAtCursor('[DOCUMENTO]')}
                            className="px-2 py-1 bg-[#CB9E1B]/10 hover:bg-[#CB9E1B] hover:text-white text-[#CB9E1B] rounded-lg text-[8px] font-black border border-[#CB9E1B]/10 transition-colors uppercase tracking-wider"
                          >
                            Documento [DOCUMENTO]
                          </button>
                        </div>

                        {/* Custom tags creator */}
                        <form onSubmit={handleAddCustomVariable} className="flex gap-2 items-center mt-2 border-t border-navy-100 pt-3">
                          <span className="text-[8px] font-bold text-navy-400 uppercase tracking-wider whitespace-nowrap">Criar Campo:</span>
                          <input
                            type="text"
                            placeholder="Ex: LOCAL, EVENTO, VALOR..."
                            value={customVariableInput}
                            onChange={(e) => setCustomVariableInput(e.target.value)}
                            className="flex-1 bg-white border border-navy-200 rounded-lg px-2.5 py-1 text-[9px] font-bold text-navy-950 uppercase outline-none focus:border-navy-500"
                          />
                          <button
                            type="submit"
                            className="px-2.5 py-1 bg-navy-950 hover:bg-navy-800 text-white font-black text-[8px] uppercase tracking-wider rounded-lg flex items-center gap-1 transition-all"
                          >
                            <Plus size={8} />
                            <span>Adicionar</span>
                          </button>
                        </form>
                      </div>

                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-6 text-navy-400 text-xs font-bold uppercase space-y-2">
                    <MessageSquare size={32} className="text-navy-200 animate-pulse" />
                    <span>Selecione ou crie um modelo ao lado para editar</span>
                  </div>
                )}

                {/* Editor Action Bar */}
                {editingTemplateId && (
                  <div className="border-t border-navy-100 p-4 bg-navy-50/20 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={handleSaveTemplate}
                      className="px-4 py-2 bg-[#0A1A30] hover:bg-navy-800 text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-95"
                    >
                      Salvar Alterações
                    </button>
                  </div>
                )}
              </div>

            </div>

            {/* Modal Footer */}
            <div className="border-t border-navy-100 p-5 bg-navy-50/50 flex flex-col sm:flex-row justify-between items-center gap-4">
              <button
                type="button"
                onClick={handleResetToDefaults}
                className="text-rose-600 hover:text-rose-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all active:scale-95 border border-rose-100 bg-rose-50 hover:bg-rose-100/50 px-4 py-2.5 rounded-xl"
              >
                <RotateCcw size={12} />
                <span>Restaurar Todos Padrões</span>
              </button>

              <button
                type="button"
                onClick={() => setIsManageModalOpen(false)}
                className="w-full sm:w-auto px-6 py-3 bg-navy-950 hover:bg-navy-800 text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-md text-center"
              >
                Fechar e Aplicar
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
