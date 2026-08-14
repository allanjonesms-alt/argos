import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Filter, FileText, FileDigit } from 'lucide-react';
import { User, OccurrenceSS, OccurrenceRO } from '../types';
import { db } from '../firebase';
import { collection, getDocs, query } from 'firebase/firestore';
import { cleanCityName } from '../lib/cityUtils';

interface DateOccurrencesProps {
  user: User | null;
}

const DateOccurrences: React.FC<DateOccurrencesProps> = ({ user }) => {
  const { date } = useParams<{ date: string }>();
  const navigate = useNavigate();
  const [occurrencesSS, setOccurrencesSS] = useState<OccurrenceSS[]>([]);
  const [occurrencesRO, setOccurrencesRO] = useState<OccurrenceRO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCity, setSelectedCity] = useState<string>('');

  useEffect(() => {
    const fetchOccurrences = async () => {
      if (!date) return;
      setIsLoading(true);
      try {
        const ssSnapshot = await getDocs(collection(db, 'occurrences'));
        const roSnapshot = await getDocs(collection(db, 'occurrences_ro'));
        
        const ssData = ssSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as OccurrenceSS));
        const roData = roSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as OccurrenceRO));

        const isSameDate = (rawDate: any, targetDate: string) => {
          if (!rawDate) return false;
          let dateStr = '';
          if (typeof rawDate === 'string') {
            const cleaned = rawDate.trim();
            if (cleaned.includes('T')) {
              dateStr = cleaned.split('T')[0];
            } else if (cleaned.includes('/')) {
              const parts = cleaned.split('/');
              if (parts.length === 3) {
                let d = parts[0].padStart(2, '0');
                let m = parts[1].padStart(2, '0');
                let y = parts[2];
                if (y.length === 2) y = '20' + y;
                dateStr = `${y}-${m}-${d}`;
              }
            } else if (/^\d{4}-\d{2}-\d{2}/.test(cleaned)) {
              dateStr = cleaned.substring(0, 10);
            }
          } else if (typeof rawDate.toDate === 'function') {
            const d = rawDate.toDate();
            dateStr = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
          }
          return dateStr === targetDate;
        };
        
        setOccurrencesSS(ssData.filter(item => isSameDate(item.date || (item as any).data || item.created_at, date)));
        setOccurrencesRO(roData.filter(item => isSameDate(item.date || (item as any).data || item.created_at, date)));
      } catch (err) {
        console.error('Erro ao buscar ocorrências para a data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOccurrences();
  }, [date]);

  const uniqueCities = useMemo(() => {
    const cities = new Set<string>();
    occurrencesSS.forEach(item => {
      const city = cleanCityName(item.cidade, item.roAddress);
      if (city) cities.add(city);
    });
    occurrencesRO.forEach(item => {
      const city = cleanCityName(item.cidade, item.roAddress);
      if (city) cities.add(city);
    });
    return Array.from(cities).sort();
  }, [occurrencesSS, occurrencesRO]);

  const filteredSS = useMemo(() => {
    if (!selectedCity) return occurrencesSS;
    return occurrencesSS.filter(item => {
      const city = cleanCityName(item.cidade, item.roAddress);
      return city === selectedCity;
    });
  }, [occurrencesSS, selectedCity]);

  const filteredRO = useMemo(() => {
    if (!selectedCity) return occurrencesRO;
    return occurrencesRO.filter(item => {
      const city = cleanCityName(item.cidade, item.roAddress);
      return city === selectedCity;
    });
  }, [occurrencesRO, selectedCity]);

  const formatDateLabel = (dateString: string) => {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
  };

  const navigateToDate = (offset: number) => {
    if (!date) return;
    const [year, month, day] = date.split('-').map(Number);
    const newDate = new Date(year, month - 1, day);
    newDate.setDate(newDate.getDate() + offset);
    
    const nextYear = newDate.getFullYear();
    const nextMonth = String(newDate.getMonth() + 1).padStart(2, '0');
    const nextDay = String(newDate.getDate()).padStart(2, '0');
    
    navigate(`/ocorrencias/data/${nextYear}-${nextMonth}-${nextDay}`);
  };

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 animate-fade-in">
      <div className="flex items-center gap-4 mb-8">
        <button 
          onClick={() => navigate('/ocorrencias')}
          className="p-3 bg-white border border-navy-100 rounded-xl hover:bg-navy-50 text-navy-600 transition-colors"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="flex flex-col">
          <h2 className="text-navy-950 text-2xl md:text-3xl font-black uppercase tracking-tighter">Ocorrências da Data</h2>
          <div className="flex items-center gap-2 mt-1">
            <button 
              onClick={() => navigateToDate(-1)}
              className="p-1 hover:bg-navy-100 text-navy-600 rounded-md transition-colors"
              title="Dia anterior"
            >
              <ChevronLeft size={16} />
            </button>
            <p className="text-navy-500 uppercase text-xs font-bold tracking-widest">{date ? formatDateLabel(date) : ''}</p>
            <button 
              onClick={() => navigateToDate(1)}
              className="p-1 hover:bg-navy-100 text-navy-600 rounded-md transition-colors"
              title="Próximo dia"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Statistics Cards */}
        <div className="bg-navy-950 text-white border border-navy-800 p-6 rounded-3xl shadow-lg flex items-center justify-between">
          <div>
            <h3 className="text-navy-300 text-[10px] font-black uppercase tracking-widest mb-1">Total Geral</h3>
            <p className="text-4xl font-black">{filteredSS.length + filteredRO.length}</p>
          </div>
          <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
            <Filter size={24} className="text-white" />
          </div>
        </div>
        
        <div className="bg-white border border-navy-100 p-6 rounded-3xl shadow-sm flex items-center justify-between">
          <div>
             <h3 className="text-navy-500 text-[10px] font-black uppercase tracking-widest mb-1">Solicitações de Serviço (SS)</h3>
             <p className="text-4xl font-black text-navy-900">{filteredSS.length}</p>
          </div>
          <div className="w-12 h-12 bg-navy-50 text-navy-600 rounded-2xl flex items-center justify-center">
            <FileText size={24} />
          </div>
        </div>

        <div className="bg-white border border-red-100 p-6 rounded-3xl shadow-sm flex items-center justify-between">
          <div>
             <h3 className="text-red-500 text-[10px] font-black uppercase tracking-widest mb-1">Ocorrências (RO)</h3>
             <p className="text-4xl font-black text-red-700">{filteredRO.length}</p>
          </div>
          <div className="w-12 h-12 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center">
            <FileDigit size={24} />
          </div>
        </div>
      </div>

      <div className="bg-white border border-navy-100 rounded-3xl p-6 shadow-sm mb-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h3 className="font-black text-navy-900 uppercase text-sm flex items-center gap-2">
            <Filter size={16} /> Filtros
          </h3>
          <select
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
            className="w-full sm:w-64 bg-navy-50 border border-navy-100 text-navy-900 text-xs font-bold rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-navy-500 uppercase transition-all"
          >
            <option value="">Todas as Cidades</option>
            {uniqueCities.map(city => (
              <option key={city} value={city}>{city}</option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="py-20 flex justify-center">
           <div className="w-10 h-10 border-4 border-navy-200 border-t-navy-900 rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="space-y-10">
          <div>
            <h3 className="text-navy-900 font-black uppercase tracking-widest text-lg mb-6 flex items-center gap-2 border-b border-navy-100 pb-3">
              <FileText size={20} className="text-navy-500" /> Solicitações de Serviço (SS)
            </h3>
            {filteredSS.length === 0 ? (
              <div className="text-center py-10 bg-navy-50/50 rounded-2xl border border-navy-100 border-dashed">
                <p className="text-navy-400 font-bold text-sm uppercase">Nenhuma SS encontrada</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredSS.map(ss => (
                  <div key={ss.id} className="bg-white border border-navy-100 p-5 rounded-2xl hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-3">
                      <span className="bg-navy-100 text-navy-800 text-[10px] font-black px-2.5 py-1 rounded-lg uppercase">
                        SS: {ss.nr_ss || 'N/A'}
                      </span>
                      <span className="text-navy-400 text-[10px] font-bold">
                        {ss.time || ''}
                      </span>
                    </div>
                    <h4 className="font-black text-navy-900 text-sm mb-2">{ss.tipo_ss || 'Sem Tipo'}</h4>
                    <div className="text-xs text-navy-600 mb-3 line-clamp-3 leading-relaxed">
                      {ss.facts || ss.eventoComunicado || 'Sem descrição fática.'}
                    </div>
                    <div className="pt-3 border-t border-navy-50 flex justify-between items-end">
                       <span className="text-[10px] font-bold text-navy-400 uppercase tracking-wider block">
                         {cleanCityName(ss.cidade, ss.roAddress)}
                       </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="text-red-900 font-black uppercase tracking-widest text-lg mb-6 flex items-center gap-2 border-b border-red-100 pb-3">
              <FileDigit size={20} className="text-red-500" /> Relatórios de Ocorrência (RO)
            </h3>
            {filteredRO.length === 0 ? (
              <div className="text-center py-10 bg-red-50/50 rounded-2xl border border-red-100 border-dashed">
                <p className="text-red-400 font-bold text-sm uppercase">Nenhum RO encontrado</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredRO.map(ro => (
                  <div key={ro.id} className="bg-white border border-red-100 p-5 rounded-2xl hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-3">
                      <span className="bg-red-100 text-red-800 text-[10px] font-black px-2.5 py-1 rounded-lg uppercase">
                        RO: {ro.nr_ro || 'N/A'}
                      </span>
                      <span className="text-navy-400 text-[10px] font-bold">
                        {ro.time || ''}
                      </span>
                    </div>
                    <h4 className="font-black text-navy-900 text-sm mb-2">
                       {Array.isArray(ro.fato) ? ro.fato.join(', ') : ro.fato || 'Fato não informado'}
                    </h4>
                    <div className="text-xs text-navy-600 mb-3 line-clamp-3 leading-relaxed">
                      {ro.facts || ro.eventoComunicado || 'Sem descrição fática.'}
                    </div>
                    <div className="pt-3 border-t border-red-50 flex justify-between items-end">
                       <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider block">
                         {cleanCityName(ro.cidade, ro.roAddress)}
                       </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DateOccurrences;
