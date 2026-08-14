import React, { useState } from 'react';
import { 
  MilitarPromocao, 
  VagaQuadro, 
  PromocaoUserLevel,
  QuadroPMMS,
  GraduacaoPMMS
} from '../../typesPromocoes';
import { 
  DEFAULT_PROXIMAS_DATAS, 
  evaluateMilitarPromotion, 
  PROXIMO_POSTO_GRADUACAO 
} from '../../services/promocoesService';
import { 
  Play, 
  RotateCcw, 
  TrendingUp, 
  Plus, 
  Minus, 
  UserMinus, 
  CheckCircle2, 
  HelpCircle, 
  Sliders, 
  Sparkles,
  ArrowRight,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';

interface MotorRegrasSimuladorProps {
  militares: MilitarPromocao[];
  vagas: VagaQuadro[];
  userLevel: PromocaoUserLevel;
  onApplyPromocaoSimulada: (militarId: string, novaGraduacao: GraduacaoPMMS) => Promise<void>;
}

export const MotorRegrasSimulador: React.FC<MotorRegrasSimuladorProps> = ({
  militares,
  vagas,
  userLevel,
  onApplyPromocaoSimulada
}) => {
  const [selectedTargetDate, setSelectedTargetDate] = useState<string>(DEFAULT_PROXIMAS_DATAS[0].data);
  const [customVagasDelta, setCustomVagasDelta] = useState<Record<string, number>>({});
  const [simulatedReservas, setSimulatedReservas] = useState<string[]>([]);
  const [applyingId, setApplyingId] = useState<string | null>(null);

  // Filter out simulated retired militaries from active evaluation
  const activeMilitaresForSimulation = militares.map(m => {
    if (simulatedReservas.includes(m.id)) {
      return { ...m, situacao_funcional: 'RESERVA' as const };
    }
    return m;
  });

  // Evaluate promotions under current simulation parameters
  const simResults = activeMilitaresForSimulation.map(m => 
    evaluateMilitarPromotion(m, vagas, activeMilitaresForSimulation, selectedTargetDate, customVagasDelta)
  );

  const promovidosProjetados = simResults.filter(r => r.elegivel_vaga);

  const handleAdjustVagaDelta = (quadro: QuadroPMMS, graduacao: GraduacaoPMMS, delta: number) => {
    const key = `${quadro}_${graduacao}`;
    const current = customVagasDelta[key] || 0;
    setCustomVagasDelta(prev => ({ ...prev, [key]: current + delta }));
  };

  const handleToggleSimulatedReserva = (id: string) => {
    setSimulatedReservas(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleResetSimulation = () => {
    setCustomVagasDelta({});
    setSimulatedReservas([]);
  };

  const handleExecuteSinglePromocao = async (militarId: string, novaGrad: GraduacaoPMMS) => {
    setApplyingId(militarId);
    try {
      await onApplyPromocaoSimulada(militarId, novaGrad);
    } catch (err) {
      console.error(err);
    } finally {
      setApplyingId(null);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Simulation Header */}
      <div className="bg-gradient-to-r from-navy-950 via-navy-900 to-navy-950 border border-amber-500/30 rounded-3xl p-6 md:p-8 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="bg-amber-500 text-navy-950 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider">
              Simulador de Vagas & Aposentadorias
            </span>
            <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-bold px-3 py-1 rounded-full uppercase">
              Motor Algorítmico Ativo
            </span>
          </div>
          <h2 className="text-2xl font-black uppercase text-white tracking-tight">
            Cenários e Previsão de Promoção PMMS
          </h2>
          <p className="text-xs text-navy-200 font-medium max-w-xl">
            Simule o impacto de abertura de vagas adicionais e da ida de praças/oficiais para a reserva. O sistema recalcula instantaneamente a fila de antiguidade.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={handleResetSimulation}
            className="bg-navy-800 hover:bg-navy-700 text-amber-400 border border-amber-500/30 font-black text-xs uppercase px-4 py-3 rounded-2xl transition-all flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Resetar Cenário</span>
          </button>
        </div>
      </div>

      {/* Control Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Panel 1: Target Date & Vacancy Quota Adjuster */}
        <div className="bg-white border border-navy-100 rounded-3xl p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-navy-100">
            <h3 className="font-black text-sm uppercase text-navy-950 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-amber-600" />
              <span>1. Configurar Vagas no Cenário</span>
            </h3>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase text-navy-500 mb-1">Data Promocional Alvo</label>
            <select
              value={selectedTargetDate}
              onChange={(e) => setSelectedTargetDate(e.target.value)}
              className="w-full bg-navy-50 border border-navy-200 text-navy-950 text-xs font-bold rounded-2xl p-3 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              {DEFAULT_PROXIMAS_DATAS.map((d, idx) => (
                <option key={idx} value={d.data}>
                  {d.nome} {d.statusAta === 'PENDENTE' ? '— [Ata Pendente / Atrasada]' : '— [Previsão]'}
                </option>
              ))}
            </select>

            {/* Target Date Status Callout */}
            {(() => {
              const infoData = DEFAULT_PROXIMAS_DATAS.find(d => d.data === selectedTargetDate);
              if (!infoData) return null;
              return (
                <div className={`mt-2 p-3 rounded-2xl border text-xs space-y-1 transition-all ${
                  infoData.statusAta === 'PENDENTE' 
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-950' 
                    : 'bg-navy-50 border-navy-200 text-navy-900'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="font-black text-[10px] uppercase text-amber-950 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 inline" />
                      {infoData.statusAtaRotulo}
                    </span>
                    {infoData.statusAta === 'PENDENTE' && (
                      <span className="px-2 py-0.5 bg-amber-500 text-navy-950 font-black text-[8px] uppercase rounded-full">
                        Ata Atrasada
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] font-medium leading-tight opacity-90">
                    {infoData.observacao}
                  </p>
                </div>
              );
            })()}
          </div>

          <div className="space-y-3 pt-2">
            <span className="text-[10px] font-black uppercase text-navy-400 block">Ajuste de Vagas por Quadro/Graduação</span>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {vagas.filter(v => !['1º Tenente', 'Capitão', 'Major', 'Tenente-Coronel'].includes(v.graduacao as string)).map(v => {
                const key = `${v.quadro}_${v.graduacao}`;
                const delta = customVagasDelta[key] || 0;
                const totalFinal = Math.max(0, v.vagas_abertas + delta);

                return (
                  <div key={v.id} className="flex items-center justify-between p-3 bg-navy-50 rounded-2xl border border-navy-100 text-xs">
                    <div>
                      <span className="font-black text-navy-950 uppercase block">{v.graduacao}</span>
                      <span className="text-[9px] font-bold text-navy-500">{v.quadro} - Base: {v.vagas_abertas} abertas</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleAdjustVagaDelta(v.quadro, v.graduacao, -1)}
                        className="w-7 h-7 bg-white hover:bg-navy-200 text-navy-900 font-black rounded-lg border border-navy-200 flex items-center justify-center transition-all"
                      >
                        -
                      </button>
                      <span className="font-black text-amber-600 w-6 text-center text-sm">{totalFinal}</span>
                      <button
                        onClick={() => handleAdjustVagaDelta(v.quadro, v.graduacao, 1)}
                        className="w-7 h-7 bg-white hover:bg-navy-200 text-navy-900 font-black rounded-lg border border-navy-200 flex items-center justify-center transition-all"
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Panel 2: Retirement / Reserva Simulator */}
        <div className="bg-white border border-navy-100 rounded-3xl p-6 shadow-xs space-y-5 lg:col-span-2">
          <div className="flex items-center justify-between pb-3 border-b border-navy-100">
            <h3 className="font-black text-sm uppercase text-navy-950 flex items-center gap-2">
              <UserMinus className="w-4 h-4 text-amber-600" />
              <span>2. Simular Transferências para Reserva / Reformas</span>
            </h3>
            <span className="text-[10px] font-bold text-navy-400 uppercase">
              {simulatedReservas.length} simulados
            </span>
          </div>

          <p className="text-xs text-navy-500 font-medium">
            Marque os policiais militares que pretendem dar entrada na Reserva Remunerada para verificar a liberação em cadeia de vagas para os mais antigos abaixo na fila.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
            {militares.map(m => {
              const isSimulatedReserva = simulatedReservas.includes(m.id);
              return (
                <div 
                  key={m.id}
                  onClick={() => handleToggleSimulatedReserva(m.id)}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-center justify-between select-none ${
                    isSimulatedReserva 
                      ? 'bg-amber-50 border-amber-300 text-amber-950 shadow-xs' 
                      : 'bg-navy-50/70 border-navy-100 hover:bg-navy-100/60 text-navy-900'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-xs uppercase">{m.graduacao} {m.nome_guerra}</span>
                      <span className="bg-navy-950 text-white text-[9px] font-black px-2 py-0.5 rounded">{m.quadro}</span>
                    </div>
                    <span className="text-[10px] font-semibold text-navy-400 block mt-0.5">
                      #{m.ordem_antiguidade}º na fila - {m.unidade}
                    </span>
                  </div>

                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center font-black text-xs ${
                    isSimulatedReserva ? 'bg-amber-500 text-navy-950' : 'bg-navy-200 text-navy-600'
                  }`}>
                    {isSimulatedReserva ? '✓' : '+'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Simulation Outcome Results */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <h3 className="text-lg font-black uppercase text-navy-950 tracking-tight">
              Resultado da Simulação: Promovidos Projetados ({promovidosProjetados.length})
            </h3>
          </div>
          {(() => {
            const dateInfo = DEFAULT_PROXIMAS_DATAS.find(d => d.data === selectedTargetDate);
            return (
              <div className="flex items-center gap-2">
                {dateInfo?.statusAta === 'PENDENTE' && (
                  <span className="px-2.5 py-0.5 bg-amber-500 text-navy-950 text-[9px] font-black uppercase rounded-full shadow-2xs">
                    Ata Pendente de Publicação (Atrasada)
                  </span>
                )}
                <span className="text-xs font-bold text-navy-600 uppercase">
                  Data Alvo: {selectedTargetDate}
                </span>
              </div>
            );
          })()}
        </div>

        <div className="bg-white border border-navy-100 rounded-3xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-navy-950 text-white text-[10px] font-black uppercase tracking-wider">
                  <th className="p-4 pl-6">Posição</th>
                  <th className="p-4">Militar</th>
                  <th className="p-4">Quadro</th>
                  <th className="p-4">Graduação Atual</th>
                  <th className="p-4">Próxima Graduação</th>
                  <th className="p-4">Cumprimento Interstício</th>
                  <th className="p-4 pr-6 text-right">Ação Oficial</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-50 text-xs font-semibold text-navy-900">
                {promovidosProjetados.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-12 text-center text-navy-400 uppercase font-bold text-xs">
                      Com os parâmetros atuais, nenhum militar atende simultaneamente o interstício e as vagas abertas. Tente aumentar as vagas no simulador.
                    </td>
                  </tr>
                ) : (
                  promovidosProjetados.map((res, idx) => (
                    <tr key={res.militar.id} className="hover:bg-emerald-50/40 transition-colors">
                      <td className="p-4 pl-6 font-black text-emerald-600">
                        #{idx + 1}º Selecionado
                      </td>
                      <td className="p-4">
                        <span className="font-black text-navy-950 uppercase block">{res.militar.nome_guerra}</span>
                        <span className="text-[10px] font-medium text-navy-400 uppercase block">{res.militar.nome} (Mat. {res.militar.matricula})</span>
                      </td>
                      <td className="p-4 font-bold text-navy-600">
                        {res.militar.quadro}
                      </td>
                      <td className="p-4">
                        <span className="bg-navy-100 text-navy-950 font-black px-2.5 py-1 rounded-xl text-[10px] uppercase">
                          {res.militar.graduacao}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1.5 text-emerald-700 font-black uppercase">
                          <ArrowRight className="w-3.5 h-3.5" />
                          <span>{res.proxima_graduacao}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2.5 py-1 rounded-full uppercase">
                          100% ({res.meses_cumpridos} meses)
                        </span>
                      </td>
                      <td className="p-4 pr-6 text-right">
                        {(userLevel === 'ADMIN' || userLevel === 'EDITOR') && res.proxima_graduacao && (
                          <button
                            disabled={applyingId === res.militar.id}
                            onClick={() => handleExecuteSinglePromocao(res.militar.id, res.proxima_graduacao!)}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] uppercase tracking-wider px-3.5 py-2 rounded-xl transition-all shadow-xs flex items-center gap-1.5 ml-auto active:scale-95"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>{applyingId === res.militar.id ? 'Efetivando...' : 'Efetivar Promoção'}</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
