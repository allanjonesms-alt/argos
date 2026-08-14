import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, FileDigit, FileUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { User, OccurrenceSS, OccurrenceRO } from '../types';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import TacticalAlert from '../components/TacticalAlert';
import MonthlyCalendar from '../components/MonthlyCalendar';
import { cleanCityName } from '../lib/cityUtils';

interface OccurrencesProps {
  user: User | null;
}

const Occurrences: React.FC<OccurrencesProps> = ({ user }) => {
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [occurrencesSS, setOccurrencesSS] = useState<OccurrenceSS[]>([]);
  const [occurrencesRO, setOccurrencesRO] = useState<OccurrenceRO[]>([]);
  const [isLoadingCounts, setIsLoadingCounts] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  
  const combinedOccurrences = useMemo(() => {
    return [...occurrencesSS, ...occurrencesRO];
  }, [occurrencesSS, occurrencesRO]);

  const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const monthLabel = `${monthNames[selectedMonth.getMonth()]} de ${selectedMonth.getFullYear()}`;

  const checkDateInMonth = (rawDate: any, targetDate: Date) => {
    if (!rawDate) return false;
    let d: Date | null = null;
    if (typeof rawDate === 'string') {
      const cleaned = rawDate.trim();
      if (cleaned.includes('T')) {
        const parts = cleaned.split('T')[0].split('-');
        d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      } else if (cleaned.includes('/')) {
        const parts = cleaned.split('/');
        if (parts.length === 3) {
          let y = parts[2].length === 2 ? '20' + parts[2] : parts[2];
          d = new Date(parseInt(y), parseInt(parts[1]) - 1, parseInt(parts[0]));
        }
      } else if (/^\d{4}-\d{2}-\d{2}/.test(cleaned)) {
        const parts = cleaned.substring(0, 10).split('-');
        d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      }
    } else if (rawDate && typeof rawDate.toDate === 'function') {
      d = rawDate.toDate();
    } else if (rawDate instanceof Date) {
      d = rawDate;
    }
    
    if (d) {
      return d.getMonth() === targetDate.getMonth() && d.getFullYear() === targetDate.getFullYear();
    }
    return false;
  };

  const ssInMonth = useMemo(() => occurrencesSS.filter(ss => checkDateInMonth((ss as any).date || (ss as any).created_at, selectedMonth)), [occurrencesSS, selectedMonth]);
  const roInMonth = useMemo(() => occurrencesRO.filter(ro => checkDateInMonth((ro as any).data || (ro as any).created_at, selectedMonth)), [occurrencesRO, selectedMonth]);

  const chartData = useMemo(() => {
    const cityData: Record<string, { name: string; ss: number; ro: number; total: number }> = {};

    ssInMonth.forEach(item => {
      const city = cleanCityName(item.cidade, item.roAddress);
      if (!cityData[city]) {
        cityData[city] = { name: city, ss: 0, ro: 0, total: 0 };
      }
      cityData[city].ss += 1;
      cityData[city].total += 1;
    });

    roInMonth.forEach(item => {
      const city = cleanCityName(item.cidade, item.roAddress);
      if (!cityData[city]) {
        cityData[city] = { name: city, ss: 0, ro: 0, total: 0 };
      }
      cityData[city].ro += 1;
      cityData[city].total += 1;
    });

    return Object.values(cityData)
      .filter(item => item.name !== 'FIGUEIRÃO')
      .sort((a, b) => b.total - a.total);
  }, [ssInMonth, roInMonth]);
  
  const navigate = useNavigate();

  const fetchOccurrences = async () => {
    setIsLoadingCounts(true);
    try {
      const ssSnapshot = await getDocs(collection(db, 'occurrences'));
      const roSnapshot = await getDocs(collection(db, 'occurrences_ro'));
      
      const ssData = ssSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as OccurrenceSS));
      const roData = roSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as OccurrenceRO));
      
      setOccurrencesSS(ssData);
      setOccurrencesRO(roData);
    } catch (err) {
      console.error('Erro ao buscar ocorrências:', err);
    } finally {
      setIsLoadingCounts(false);
    }
  };

  useEffect(() => {
    fetchOccurrences();
  }, []);

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {alertMessage && (
        <TacticalAlert message={alertMessage} onClose={() => setAlertMessage(null)} />
      )}

      <div className="mb-10 animate-fade-in flex justify-between items-end">
        <div>
          <h2 className="text-navy-950 text-3xl font-black uppercase tracking-tighter">Ocorrências</h2>
          <p className="text-navy-500 mt-1 uppercase text-xs font-bold tracking-widest">SS e RO Importados</p>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4 mt-8">
        <h3 className="text-navy-950 text-xl font-black uppercase tracking-tight">
          Resumo do Mês
        </h3>
        <span className="text-navy-500 font-bold text-sm bg-navy-50 py-1 px-3 rounded-full uppercase tracking-wider">
          {monthLabel}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-navy-950 text-white border border-navy-800 p-6 rounded-3xl shadow-lg flex items-center justify-between">
          <div>
            <h3 className="text-navy-300 text-[10px] font-black uppercase tracking-widest mb-1">Total Geral</h3>
            <p className="text-4xl font-black">{ssInMonth.length + roInMonth.length}</p>
          </div>
          <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
            <FileUp size={24} className="text-white" />
          </div>
        </div>
        
        <div className="bg-white border border-navy-100 p-6 rounded-3xl shadow-sm flex items-center justify-between">
          <div>
             <h3 className="text-navy-500 text-[10px] font-black uppercase tracking-widest mb-1">Total S.S</h3>
             <p className="text-4xl font-black text-navy-900">{ssInMonth.length}</p>
          </div>
          <div className="w-12 h-12 bg-navy-50 text-navy-600 rounded-2xl flex items-center justify-center">
            <FileText size={24} />
          </div>
        </div>

        <div className="bg-white border border-red-100 p-6 rounded-3xl shadow-sm flex items-center justify-between">
          <div>
             <h3 className="text-red-500 text-[10px] font-black uppercase tracking-widest mb-1">Total R.O</h3>
             <p className="text-4xl font-black text-red-700">{roInMonth.length}</p>
          </div>
          <div className="w-12 h-12 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center">
            <FileDigit size={24} />
          </div>
        </div>
      </div>

      <div className="bg-white border border-navy-100 rounded-3xl p-6 shadow-sm mb-8 animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-navy-950 font-black uppercase tracking-tight">Registros por Cidade</h3>
          <span className="text-navy-500 font-bold text-xs bg-navy-50 py-1 px-3 rounded-full uppercase tracking-wider">
            {monthLabel}
          </span>
        </div>
        <div className="h-[400px] w-full min-w-0 min-h-[350px]">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={200}>
            <BarChart
              layout="vertical"
              data={chartData}
              margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
              <XAxis type="number" />
              <YAxis 
                 type="category" 
                 dataKey="name" 
                 width={110} 
                 tick={{ fontSize: 9, fontWeight: 'bold', fill: '#64748b' }} 
              />
              <Tooltip 
                 cursor={{fill: '#f1f5f9'}}
                 contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', paddingTop: '20px' }} />
              <Bar dataKey="ss" name="SS" fill="#1e293b" radius={[0, 4, 4, 0]} isAnimationActive={false} />
              <Bar dataKey="ro" name="RO" fill="#b91c1c" radius={[0, 4, 4, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mb-8">
        <MonthlyCalendar 
          data={combinedOccurrences} 
          title="Fluxo Mensal de Registros (SS + RO)"
          color="navy"
          isLoading={isLoadingCounts}
          onDateClick={(dateStr) => navigate(`/ocorrencias/data/${dateStr}`)}
          onMonthChange={setSelectedMonth}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <button 
          onClick={() => navigate('/importar-relatorios')}
          className="group bg-navy-950 border border-navy-900 p-6 rounded-3xl shadow-xl hover:shadow-navy-900/10 transition-all flex flex-col items-center text-center text-white"
        >
          <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <FileUp size={32} className="text-white" />
          </div>
          <h3 className="text-xl font-black uppercase tracking-tight mb-1 font-sans">Importar PDFs</h3>
          <p className="text-navy-300 text-xs leading-relaxed font-bold">Importar Relatórios Detalhados de Ocorrências (SS e RO) via PDF.</p>
        </button>

        <button 
          onClick={() => navigate('/lista-ss')}
          className="group bg-white border border-navy-100 p-6 rounded-3xl shadow-sm hover:shadow-xl hover:border-navy-300 transition-all flex flex-col items-center text-center"
        >
          <div className="w-16 h-16 bg-navy-600 rounded-2xl flex items-center justify-center mb-4 group-hover:rotate-6 transition-transform shadow-lg">
            <FileText size={32} className="text-white" />
          </div>
          <h3 className="text-xl font-black text-navy-950 uppercase tracking-tight mb-1 font-sans">Lista SS</h3>
          <p className="text-navy-500 text-xs leading-relaxed font-bold font-sans">Visualizar e gerenciar Solicitações de Serviço importadas.</p>
        </button>

        <button 
          onClick={() => navigate('/lista-ro')}
          className="group bg-white border border-navy-100 p-6 rounded-3xl shadow-sm hover:shadow-xl hover:border-navy-300 transition-all flex flex-col items-center text-center"
        >
          <div className="w-16 h-16 bg-red-700 rounded-2xl flex items-center justify-center mb-4 group-hover:rotate-6 transition-transform shadow-lg">
            <FileDigit size={32} className="text-white" />
          </div>
          <h3 className="text-xl font-black text-navy-950 uppercase tracking-tight mb-1 font-sans">Lista R.O</h3>
          <p className="text-navy-500 text-xs leading-relaxed font-bold font-sans">Visualizar e gerenciar Relatórios de Ocorrência importados.</p>
        </button>
      </div>
    </div>
  );
};

export default Occurrences;
