import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';

interface MonthlyCalendarProps {
  data: { date?: string }[];
  onDateClick?: (date: string) => void;
  onMonthChange?: (date: Date) => void;
  title?: string;
  color?: 'navy' | 'red';
  isLoading?: boolean;
}

const MonthlyCalendar: React.FC<MonthlyCalendarProps> = ({ data, onDateClick, onMonthChange, title = 'Registros Mensais', color = 'navy', isLoading = false }) => {
  const [currentDate, setCurrentDate] = React.useState(new Date());

  React.useEffect(() => {
    onMonthChange?.(currentDate);
  }, [currentDate]);

  const daysInMonth = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const date = new Date(year, month, 1);
    const days = [];
    
    // Fill empty days before first of month
    const firstDay = date.getDay();
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }
    
    while (date.getMonth() === month) {
      days.push(new Date(date));
      date.setDate(date.getDate() + 1);
    }
    
    return days;
  }, [currentDate]);

  const counts = useMemo(() => {
    const map: Record<string, { ss: number, ro: number }> = {};
    data.forEach(item => {
      let rawDate = (item as any).date || (item as any).data || (item as any).created_at;
      if (rawDate) {
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
        } else if (rawDate && typeof rawDate.toDate === 'function') {
          const d = rawDate.toDate();
          dateStr = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
        } else if (rawDate instanceof Date) {
          dateStr = `${rawDate.getFullYear()}-${(rawDate.getMonth() + 1).toString().padStart(2, '0')}-${rawDate.getDate().toString().padStart(2, '0')}`;
        }
        
        if (dateStr && dateStr.length === 10) {
          if (!map[dateStr]) map[dateStr] = { ss: 0, ro: 0 };
          // Logic to distinguish SS and RO
          const isRO = (item as any).nr_ro !== undefined || (item as any).fato !== undefined;
          if (isRO) map[dateStr].ro++;
          else map[dateStr].ss++;
        }
      }
    });
    return map;
  }, [data]);

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const colorClasses = {
    navy: {
      bg: 'bg-navy-50',
      text: 'text-navy-900',
      border: 'border-navy-100',
      accent: 'bg-navy-700',
      accentText: 'text-white',
      hover: 'hover:bg-navy-100',
      badge: 'bg-navy-600'
    },
    red: {
      bg: 'bg-red-50',
      text: 'text-red-900',
      border: 'border-red-100',
      accent: 'bg-red-700',
      accentText: 'text-white',
      hover: 'hover:bg-red-100',
      badge: 'bg-red-600'
    }
  };

  const c = colorClasses[color];
  const isCurrentlyLoading = isLoading;

  return (
    <div className={`p-4 rounded-3xl border ${c.border} ${c.bg} shadow-sm mb-6 relative overflow-hidden transition-all duration-500 ${isCurrentlyLoading ? 'opacity-60 grayscale' : 'opacity-100'}`}>
      {isCurrentlyLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/20 backdrop-blur-[1px]">
          <div className={`w-8 h-8 border-4 ${color === 'navy' ? 'border-navy-600' : 'border-red-600'} border-t-transparent rounded-full animate-spin`}></div>
        </div>
      )}
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className={`text-[10px] font-black uppercase tracking-widest ${c.text} opacity-50`}>{title}</h3>
          <p className={`text-sm font-black uppercase ${c.text}`}>{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={prevMonth} className={`p-2 rounded-xl border ${c.border} bg-white transition-all active:scale-95`}><ChevronLeft size={16} /></button>
          <button onClick={nextMonth} className={`p-2 rounded-xl border ${c.border} bg-white transition-all active:scale-95`}><ChevronRight size={16} /></button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, i) => (
          <div key={i} className={`text-center text-[10px] font-black ${c.text} opacity-30 py-2`}>{day}</div>
        ))}
        {daysInMonth.map((day, i) => {
          if (!day) return <div key={i} />;
          
          const y = day.getFullYear();
          const m = (day.getMonth() + 1).toString().padStart(2, '0');
          const d = day.getDate().toString().padStart(2, '0');
          const dateStr = `${y}-${m}-${d}`;
          
          const dayCounts = (counts[dateStr] as any) || { ss: 0, ro: 0 };
          const totalCount = dayCounts.ss + dayCounts.ro;
          const today = new Date();
          const todayStr = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
          const isToday = todayStr === dateStr;

          // Days with occurrences are marked as green/emerald (Imported)
          const isImported = totalCount > 0;

          return (
            <div 
              key={i} 
              onClick={() => onDateClick?.(dateStr)}
              className={`
                aspect-square rounded-2xl border flex flex-col items-center justify-center relative cursor-pointer transition-all active:scale-90
                ${isImported 
                  ? 'bg-emerald-50 border-emerald-400 text-emerald-950 font-black shadow-sm hover:bg-emerald-100' 
                  : `${c.border} opacity-40 ${c.hover}`
                }
                ${isToday ? `ring-2 ring-offset-2 ${color === 'navy' ? 'ring-navy-600' : 'ring-red-600'}` : ''}
              `}
            >
              <span className={`text-sm font-black ${isImported ? 'text-emerald-950' : 'text-navy-400'}`}>{day.getDate()}</span>
              {isImported && (
                <>
                  <span className="absolute top-1 left-1.5 text-emerald-600 flex items-center justify-center">
                    <Check size={8} strokeWidth={4} />
                  </span>
                  <span className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-lg bg-emerald-600 text-white font-black text-[8px] min-w-[16px] text-center shadow-sm">
                    {totalCount}
                  </span>
                  <div className="absolute bottom-1 flex gap-0.5">
                    {dayCounts.ss > 0 && <div className="w-1 h-1 rounded-full bg-navy-600 shadow-sm" title={`SS: ${dayCounts.ss}`} />}
                    {dayCounts.ro > 0 && <div className="w-1 h-1 rounded-full bg-red-600 shadow-sm" title={`RO: ${dayCounts.ro}`} />}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-3 border-t border-navy-100 flex flex-wrap gap-4 items-center justify-between text-[10px] font-bold text-navy-400">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-lg bg-emerald-50 border border-emerald-400 flex items-center justify-center">
            <Check size={6} className="text-emerald-600 animate-pulse" strokeWidth={4} />
          </div>
          <span className="uppercase tracking-wider">Dias com Ocorrências Importadas</span>
        </div>
        <div className="flex gap-3">
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-navy-600" />
            <span className="uppercase text-[9px] tracking-wider font-black">SS</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-red-600" />
            <span className="uppercase text-[9px] tracking-wider font-black">RO</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MonthlyCalendar;
