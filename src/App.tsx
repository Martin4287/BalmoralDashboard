import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  CreditCard, 
  TrendingUp, 
  Calendar as CalendarIcon, 
  Filter, 
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Utensils,
  Moon,
  Coffee,
  Wallet,
  Download,
  RefreshCw,
  Clock,
  Camera,
  AlertCircle,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  AreaChart,
  Area,
  LineChart,
  Line,
  Legend
} from 'recharts';
import { 
  format, 
  subDays, 
  isSameDay, 
  parse, 
  isValid, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  addMonths, 
  subMonths, 
  isSameMonth, 
  isToday 
} from 'date-fns';
import { es } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { fetchData, DailyStats } from './services/dataService';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import OccupancyForm from './components/OccupancyForm';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

type ViewType = 'dashboard' | 'calendar' | 'billing';

const parseDate = (dateStr: string) => {
  const formats = ['dd/MM/yyyy', 'MM/dd/yyyy', 'yyyy-MM-dd', 'd/M/yyyy', 'M/d/yyyy'];
  for (const f of formats) {
    try {
      const d = parse(dateStr, f, new Date());
      if (isValid(d)) return d;
    } catch { /* continue */ }
  }
  return null;
};

export default function App() {
  const [data, setData] = useState<DailyStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  
  // Filters
  const [selectedType, setSelectedType] = useState<string>('TODOS');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const stats = await fetchData();
      setData(stats);
      setLastUpdate(new Date());
      setError(null);
    } catch (err) {
      setError('Error al cargar los datos de Google Sheets. Asegúrate de que el enlace sea público y tenga el formato correcto.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredData = useMemo(() => {
    return data.filter(item => {
      const matchesType = selectedType === 'TODOS' || item.tipo === selectedType;
      
      let matchesDate = true;
      const itemDate = parseDate(item.fecha);
      
      if (itemDate) {
        if (startDate) {
          const start = parse(startDate, 'yyyy-MM-dd', new Date());
          if (isValid(start) && itemDate < start) matchesDate = false;
        }
        if (endDate) {
          const end = parse(endDate, 'yyyy-MM-dd', new Date());
          if (isValid(end) && itemDate > end) matchesDate = false;
        }
      }

      return matchesType && matchesDate;
    });
  }, [data, selectedType, startDate, endDate]);

  const dateFilteredData = useMemo(() => {
    return data.filter(item => {
      let matchesDate = true;
      const itemDate = parseDate(item.fecha);
      if (itemDate) {
        if (startDate) {
          const start = parse(startDate, 'yyyy-MM-dd', new Date());
          if (isValid(start) && itemDate < start) matchesDate = false;
        }
        if (endDate) {
          const end = parse(endDate, 'yyyy-MM-dd', new Date());
          if (isValid(end) && itemDate > end) matchesDate = false;
        }
      }
      return matchesDate;
    });
  }, [data, startDate, endDate]);

  const stats = useMemo(() => {
    const totalQty = filteredData.reduce((acc, curr) => acc + curr.cantidad, 0);
    const totalBilled = filteredData.reduce((acc, curr) => acc + curr.total, 0);
    const avgTicket = totalQty > 0 ? totalBilled / totalQty : 0;
    
    const byPayment = {
      efectivo: filteredData.reduce((acc, curr) => acc + curr.efectivo, 0),
      tarjeta: filteredData.reduce((acc, curr) => acc + curr.tarjeta, 0),
      qr: filteredData.reduce((acc, curr) => acc + curr.qr, 0),
      cargoHabitacion: filteredData.reduce((acc, curr) => acc + curr.cargoHabitacion, 0),
    };

    const uniqueDates = Array.from(new Set(dateFilteredData.map(d => d.fecha)));
    const totalOccupancy = uniqueDates.reduce<number>((acc, date) => {
      const dayData = dateFilteredData.filter(d => d.fecha === date);
      const maxDayOccupancy = Math.max(...dayData.map(d => d.ocupacion), 0);
      return acc + maxDayOccupancy;
    }, 0);

    const conversionRate = totalOccupancy > 0 ? (totalQty / totalOccupancy) * 100 : 0;

    return { totalQty, totalBilled, avgTicket, byPayment, totalOccupancy, conversionRate };
  }, [filteredData, dateFilteredData]);

  const monthlyComparison = useMemo(() => {
    if (data.length === 0) return { percent: 0, trendUp: true, currentCovers: 0 };

    const now = new Date();
    
    const parseDate = (dateStr: string) => {
      const formats = ['dd/MM/yyyy', 'MM/dd/yyyy', 'yyyy-MM-dd', 'd/M/yyyy', 'M/d/yyyy'];
      for (const f of formats) {
        try {
          const d = parse(dateStr, f, new Date());
          if (isValid(d)) return d;
        } catch { /* continue */ }
      }
      return null;
    };

    let currentCovers = 0;
    let prevCovers = 0;

    data.forEach(item => {
      const itemDate = parseDate(item.fecha);
      if (!itemDate) return;

      if (isSameMonth(itemDate, now)) {
        currentCovers += item.cantidad;
      } else if (isSameMonth(itemDate, subMonths(now, 1))) {
        prevCovers += item.cantidad;
      }
    });

    if (prevCovers === 0) return { percent: 0, trendUp: true, currentCovers };

    const diff = currentCovers - prevCovers;
    const percent = (diff / prevCovers) * 100;
    
    return { 
      percent: Math.abs(Math.round(percent)), 
      trendUp: percent >= 0,
      currentCovers 
    };
  }, [data]);

  const [isScreenshotMode, setIsScreenshotMode] = useState(false);

  const yesterdayData = useMemo(() => {
    if (data.length === 0) return [];
    
    const parseDate = (dateStr: string) => {
      const formats = ['dd/MM/yyyy', 'MM/dd/yyyy', 'yyyy-MM-dd', 'd/M/yyyy', 'M/d/yyyy'];
      for (const f of formats) {
        try {
          const d = parse(dateStr, f, new Date());
          if (isValid(d)) return d;
        } catch { /* continue */ }
      }
      return null;
    };

    const yesterday = subDays(new Date(), 1);
    const matchesYesterday = data.filter(item => {
      const itemDate = parseDate(item.fecha);
      return itemDate && isSameDay(itemDate, yesterday);
    });

    if (matchesYesterday.length > 0) return matchesYesterday;

    // If no data for yesterday, find the most recent day in the dataset
    const sortedByDate = [...data].sort((a, b) => {
      const dateA = parseDate(a.fecha) || new Date(0);
      const dateB = parseDate(b.fecha) || new Date(0);
      return dateB.getTime() - dateA.getTime();
    });

    if (sortedByDate.length === 0) return [];
    
    const mostRecentDate = parseDate(sortedByDate[0].fecha);
    if (!mostRecentDate) return [];

    return data.filter(item => {
      const itemDate = parseDate(item.fecha);
      return itemDate && isSameDay(itemDate, mostRecentDate);
    });
  }, [data]);

  const filteredYesterdayData = useMemo(() => {
    return yesterdayData.filter(row => 
      row.tipo !== 'OCUPACIÓN' && 
      row.tipo !== 'OCUPACION' && 
      row.tipo !== 'OCUPACIÓN HOTEL'
    );
  }, [yesterdayData]);

  const chartData = useMemo(() => {
    const groupedByDate: Record<string, { fecha: string; almuerzo: number; cena: number; dateObj: Date }> = {};
    
    const parseDate = (dateStr: string) => {
      const formats = ['dd/MM/yyyy', 'MM/dd/yyyy', 'yyyy-MM-dd', 'd/M/yyyy', 'M/d/yyyy'];
      for (const f of formats) {
        try {
          const d = parse(dateStr, f, new Date());
          if (isValid(d)) return d;
        } catch { /* continue */ }
      }
      return null;
    };

    filteredData.forEach(item => {
      const dateObj = parseDate(item.fecha);
      if (dateObj) {
        const key = format(dateObj, 'yyyy-MM-dd');
        if (!groupedByDate[key]) {
          groupedByDate[key] = { fecha: format(dateObj, 'dd/MM'), almuerzo: 0, cena: 0, dateObj };
        }
        if (item.tipo === 'ALMUERZO') {
          groupedByDate[key].almuerzo += item.cantidad;
        } else if (item.tipo === 'CENA') {
          groupedByDate[key].cena += item.cantidad;
        }
      }
    });
    return Object.values(groupedByDate).sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
  }, [filteredData]);

  const conversionChartData = useMemo(() => {
    const groupedByDate: Record<string, { fecha: string; almuerzoQty: number; cenaQty: number; ocupacion: number; dateObj: Date }> = {};
    
    dateFilteredData.forEach(item => {
      const dateObj = parseDate(item.fecha);
      if (dateObj) {
        const key = format(dateObj, 'yyyy-MM-dd');
        if (!groupedByDate[key]) {
          groupedByDate[key] = { 
            fecha: format(dateObj, 'dd/MM'), 
            almuerzoQty: 0, 
            cenaQty: 0, 
            ocupacion: item.ocupacion || 0, 
            dateObj 
          };
        }
        
        // Update occupancy if we found a non-zero value (in case it's only in one row)
        if (item.ocupacion > 0 && groupedByDate[key].ocupacion === 0) {
          groupedByDate[key].ocupacion = item.ocupacion;
        }

        if (item.tipo === 'ALMUERZO') {
          groupedByDate[key].almuerzoQty += item.cantidad;
        } else if (item.tipo === 'CENA') {
          groupedByDate[key].cenaQty += item.cantidad;
        }
      }
    });

    return Object.values(groupedByDate)
      .map(day => ({
        fecha: day.fecha,
        almuerzo: day.ocupacion > 0 ? (day.almuerzoQty / day.ocupacion) * 100 : 0,
        cena: day.ocupacion > 0 ? (day.cenaQty / day.ocupacion) * 100 : 0,
        dateObj: day.dateObj
      }))
      .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
  }, [dateFilteredData]);
  const paymentChartData = [
    { name: 'Efectivo', value: stats.byPayment.efectivo },
    { name: 'Tarjeta', value: stats.byPayment.tarjeta },
    { name: 'QR', value: stats.byPayment.qr },
    { name: 'Cargo de Habitación', value: stats.byPayment.cargoHabitacion },
  ].filter(p => p.value > 0);

  const downloadData = useCallback(() => {
    if (filteredData.length === 0) return;
    
    const headers = ['Fecha', 'Tipo', 'Cantidad', 'Efectivo', 'Tarjeta', 'QR', 'Cargo Hab.', 'Total', 'Ticket Promedio'];
    const csvContent = [
      headers.join(','),
      ...filteredData.map(item => [
        item.fecha,
        item.tipo,
        item.cantidad,
        item.efectivo,
        item.tarjeta,
        item.qr,
        item.cargoHabitacion,
        item.total,
        item.ticketPromedio.toFixed(2)
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `gastroanalytics_export_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [filteredData]);

  if (loading && data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50">
        <RefreshCw className="w-12 h-12 text-blue-600 animate-spin mb-4" />
        <p className="text-slate-600 font-medium">Cargando dashboard en tiempo real...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row font-sans text-slate-900">
      {/* Sidebar */}
      <aside className={cn(
        "w-full lg:w-72 bg-white border-r border-slate-200 p-6 flex flex-col transition-all duration-300",
        isScreenshotMode ? "hidden" : "flex"
      )}>
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
            <TrendingUp size={24} />
          </div>
          <div>
            <h1 className="font-bold text-slate-900 text-lg leading-tight">Balmoral Dashboard</h1>
            <p className="text-slate-500 text-xs font-medium">By Martin Schupp</p>
          </div>
        </div>

        <nav className="space-y-1 mb-10">
          <NavItem 
            icon={<LayoutDashboard size={20} />} 
            label="Dashboard" 
            active={currentView === 'dashboard'} 
            onClick={() => setCurrentView('dashboard')}
          />
          <NavItem 
            icon={<CalendarIcon size={20} />} 
            label="Calendario" 
            active={currentView === 'calendar'} 
            onClick={() => setCurrentView('calendar')}
          />
          <NavItem 
            icon={<CreditCard size={20} />} 
            label="Facturación" 
            active={currentView === 'billing'} 
            onClick={() => setCurrentView('billing')}
          />
        </nav>

        <div className="mt-auto">
          <motion.div 
            whileHover={{ y: -2 }}
            className="bg-slate-50 rounded-2xl p-4 border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300"
          >
            <div className="flex items-center gap-2 mb-3">
              <Filter size={16} className="text-slate-400" />
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Filtros Inteligentes</span>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Desde</label>
                <input 
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Hasta</label>
                <input 
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Tipo de Servicio</label>
                <select 
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                >
                  <option value="TODOS">Todos los servicios</option>
                  <option value="ALMUERZO">Almuerzo</option>
                  <option value="CENA">Cena</option>
                  <option value="OTROS">Otros</option>
                </select>
              </div>

              <div className="flex gap-2">
                <motion.button 
                  whileTap={{ scale: 0.95 }}
                  onClick={loadData}
                  disabled={loading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg py-2.5 text-sm font-semibold transition-colors flex items-center justify-center gap-2 shadow-md shadow-blue-100"
                >
                  <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                  Actualizar
                </motion.button>
                <motion.button 
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setStartDate('');
                    setEndDate('');
                    setSelectedType('TODOS');
                  }}
                  className="px-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors flex items-center justify-center"
                  title="Limpiar Filtros"
                >
                  <RefreshCw size={16} className="rotate-180" />
                </motion.button>
              </div>

              <div className="pt-6 mt-6 border-t border-slate-200">
                <OccupancyForm onSuccess={loadData} />
              </div>
            </div>
          </motion.div>
        </div>
      </aside>

      {/* Main Content */}
      <main className={cn(
        "flex-1 p-4 lg:p-8 overflow-y-auto transition-all duration-300",
        isScreenshotMode ? "bg-white p-0" : "bg-slate-50"
      )}>
        {!isScreenshotMode && (
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">
                {currentView === 'dashboard' ? 'Resumen Ejecutivo' : 
                 currentView === 'calendar' ? 'Calendario de Reservas' : 
                 'Análisis de Facturación'}
              </h2>
              <div className="flex items-center gap-2 text-slate-500 text-sm mt-1">
                <Clock size={14} />
                <span>Última actualización: {format(lastUpdate, 'HH:mm:ss')}</span>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="bg-white border border-slate-200 rounded-lg px-4 py-2 flex items-center gap-3 shadow-sm">
                <CalendarIcon size={18} className="text-blue-600" />
                <span className="text-sm font-medium text-slate-700">
                  {format(new Date(), "EEEE, d 'de' MMMM", { locale: es })}
                </span>
              </div>
              <motion.button 
                whileTap={{ scale: 0.95 }}
                onClick={downloadData}
                title="Descargar CSV"
                className="p-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <Download size={20} />
              </motion.button>
            </div>
          </header>
        )}

        {error && (
          <div className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-xl mb-8 flex items-center gap-3">
            <AlertCircle size={20} />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        <AnimatePresence mode="wait">
          {currentView === 'dashboard' ? (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
            >
              {!isScreenshotMode && (
                <>
                  {/* KPI Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
                <KpiCard 
                  title="Total Reservas" 
                  value={stats.totalQty.toLocaleString()} 
                  icon={<Users className="text-blue-600" />} 
                  trend="+12.5%" 
                  trendUp={true}
                  color="blue"
                />
                <KpiCard 
                  title="Facturación Total" 
                  value={`$${stats.totalBilled.toLocaleString()}`} 
                  icon={<Wallet className="text-emerald-600" />} 
                  trend="+8.2%" 
                  trendUp={true}
                  color="emerald"
                />
                <KpiCard 
                  title="Ticket Promedio" 
                  value={`$${Math.round(stats.avgTicket).toLocaleString()}`} 
                  icon={<TrendingUp className="text-amber-600" />} 
                  trend="-2.4%" 
                  trendUp={false}
                  color="amber"
                />
                <KpiCard 
                  title="Ocupación Hotel" 
                  value={stats.totalOccupancy.toLocaleString()} 
                  icon={<LayoutDashboard className="text-violet-600" />} 
                  trend="Pax Hotel" 
                  trendUp={true}
                  color="violet"
                />
                <KpiCard 
                  title="Tasa Conversión" 
                  value={`${stats.conversionRate.toFixed(1)}%`} 
                  icon={<TrendingUp className="text-rose-600" />} 
                  trend="Pax / Hotel" 
                  trendUp={stats.conversionRate > 20}
                  color="rose"
                />
              </div>

              {/* Charts Section */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
                <motion.div 
                  whileHover={{ y: -4 }}
                  className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-300"
                >
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                      <TrendingUp size={18} className="text-blue-600" />
                      Evolución de Cubiertos (Pax)
                    </h3>
                    <div className="flex gap-4">
                      <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                        <div className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Almuerzos
                      </span>
                      <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                        <div className="w-2.5 h-2.5 rounded-full bg-indigo-500" /> Cenas
                      </span>
                    </div>
                  </div>
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <defs>
                          <filter id="shadow" height="200%">
                            <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="blur" />
                            <feOffset in="blur" dx="0" dy="4" result="offsetBlur" />
                            <feComponentTransfer>
                              <feFuncA type="linear" slope="0.2" />
                            </feComponentTransfer>
                            <feMerge>
                              <feMergeNode />
                              <feMergeNode in="SourceGraphic" />
                            </feMerge>
                          </filter>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" strokeOpacity={0.6} />
                        <XAxis 
                          dataKey="fecha" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{fill: '#64748b', fontSize: 11}}
                          dy={10}
                        />
                        <YAxis 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{fill: '#64748b', fontSize: 11}}
                        />
                        <Tooltip 
                          contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                          cursor={{ stroke: '#f1f5f9', strokeWidth: 2 }}
                        />
                        <Legend verticalAlign="top" height={36} iconType="circle" />
                        <Line 
                          name="Almuerzo"
                          type="monotone" 
                          dataKey="almuerzo" 
                          stroke="#f59e0b" 
                          strokeWidth={4} 
                          strokeLinecap="round"
                          dot={{ r: 4, fill: '#fff', stroke: '#f59e0b', strokeWidth: 2 }}
                          activeDot={{ r: 6, fill: '#f59e0b', stroke: '#fff', strokeWidth: 2 }}
                          animationDuration={1500}
                          filter="url(#shadow)"
                        />
                        <Line 
                          name="Cena"
                          type="monotone" 
                          dataKey="cena" 
                          stroke="#6366f1" 
                          strokeWidth={4} 
                          strokeLinecap="round"
                          dot={{ r: 4, fill: '#fff', stroke: '#6366f1', strokeWidth: 2 }}
                          activeDot={{ r: 6, fill: '#6366f1', stroke: '#fff', strokeWidth: 2 }}
                          animationDuration={1500}
                          filter="url(#shadow)"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </motion.div>

                <motion.div 
                  whileHover={{ y: -4 }}
                  className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-300"
                >
                  <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                    <CreditCard size={18} className="text-emerald-600" />
                    Medios de Pago
                  </h3>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={paymentChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {paymentChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                          formatter={(value: any) => `$${value.toLocaleString()}`}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-3 mt-4">
                    {paymentChartData.map((item, index) => (
                      <div key={item.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{backgroundColor: COLORS[index % COLORS.length]}} />
                          <span className="text-sm text-slate-600 font-medium">{item.name}</span>
                        </div>
                        <span className="text-sm font-bold text-slate-900">
                          {stats.totalBilled > 0 ? ((item.value / stats.totalBilled) * 100).toFixed(1) : 0}%
                        </span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              </div>

              {/* Conversion Analysis Section */}
              <div className="grid grid-cols-1 gap-8 mb-8">
                <motion.div 
                  whileHover={{ y: -4 }}
                  className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-300"
                >
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                      <TrendingUp size={18} className="text-rose-600" />
                      Tasa de Conversión Diaria (%)
                    </h3>
                    <div className="flex gap-4">
                      <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                        <div className="w-2.5 h-2.5 rounded-full bg-rose-400" /> Almuerzos
                      </span>
                      <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                        <div className="w-2.5 h-2.5 rounded-full bg-rose-600" /> Cenas
                      </span>
                    </div>
                  </div>
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={conversionChartData}>
                        <defs>
                          <linearGradient id="colorAlmConv" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#fb7185" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#fb7185" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorCenConv" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#e11d48" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#e11d48" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" strokeOpacity={0.6} />
                        <XAxis 
                          dataKey="fecha" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{fill: '#64748b', fontSize: 11}}
                          dy={10}
                        />
                        <YAxis 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{fill: '#64748b', fontSize: 11}}
                          unit="%"
                        />
                        <Tooltip 
                          contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                          formatter={(value: number) => [`${value.toFixed(1)}%`, 'Conversión']}
                        />
                        <Legend verticalAlign="top" height={36} iconType="circle" />
                        <Area 
                          name="Almuerzo"
                          type="monotone" 
                          dataKey="almuerzo" 
                          stroke="#fb7185" 
                          strokeWidth={3}
                          fillOpacity={1} 
                          fill="url(#colorAlmConv)" 
                        />
                        <Area 
                          name="Cena"
                          type="monotone" 
                          dataKey="cena" 
                          stroke="#e11d48" 
                          strokeWidth={3}
                          fillOpacity={1} 
                          fill="url(#colorCenConv)" 
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </motion.div>
              </div>

                </>
              )}

              {/* Yesterday's Data Table */}
              <motion.div 
                whileHover={!isScreenshotMode ? { y: -4 } : {}}
                className={cn(
                  "bg-white rounded-2xl border border-slate-200 shadow-sm transition-all duration-300 overflow-hidden",
                  isScreenshotMode ? "fixed inset-0 z-[100] rounded-none border-none shadow-none flex flex-col h-screen" : "hover:shadow-xl"
                )}
              >
                <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div>
                      <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <Clock size={18} className="text-violet-600" />
                        {yesterdayData.length > 0 && isSameDay(parse(yesterdayData[0].fecha, 'dd/MM/yyyy', new Date()), subDays(new Date(), 1)) 
                          ? 'Detalle del Día Anterior' 
                          : 'Detalle del Último Día con Datos'}
                      </h3>
                      <p className="text-slate-500 text-xs font-medium mt-1">
                        {yesterdayData.length > 0 ? `Datos del ${yesterdayData[0].fecha}` : 'No hay datos disponibles'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end gap-3">
                    <button 
                      onClick={() => setIsScreenshotMode(!isScreenshotMode)}
                      className={cn(
                        "p-2 rounded-lg transition-all flex items-center gap-2 text-xs font-bold",
                        isScreenshotMode 
                          ? "bg-violet-600 text-white shadow-lg shadow-violet-200" 
                          : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                      )}
                    >
                      <Camera size={16} />
                      <span>{isScreenshotMode ? 'Salir Modo Captura' : 'Modo Captura'}</span>
                    </button>

                    {yesterdayData.length > 0 && (
                      <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
                        <div className="text-right">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ocupación Total</p>
                          <p className="text-xl font-black text-slate-900 leading-none">
                            {Math.max(...yesterdayData.map(d => d.ocupacion || 0), 0)}
                          </p>
                        </div>
                        <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm border border-slate-100">
                          <Users size={20} className="text-slate-400" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                  {/* Desktop Table View */}
                  <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50">
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Tipo</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Cubiertos</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Efectivo</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Tarjeta</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">QR</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Cargo Hab.</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Total</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Conversión</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Ticket Prom.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredYesterdayData.length > 0 ? (() => {
                        const totalDayOccupancy = Math.max(...yesterdayData.map(d => d.ocupacion || 0), 0);
                        return filteredYesterdayData.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                {row.tipo === 'ALMUERZO' ? <Coffee size={16} className="text-amber-500" /> : 
                                 row.tipo === 'CENA' ? <Moon size={16} className="text-indigo-500" /> : 
                                 <Utensils size={16} className="text-slate-400" />}
                                <span className="font-bold text-slate-700 text-sm">{row.tipo}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-600 font-medium">{row.cantidad}</td>
                            <td className="px-6 py-4 text-sm text-slate-600 font-medium">${row.efectivo.toLocaleString()}</td>
                            <td className="px-6 py-4 text-sm text-slate-600 font-medium">${row.tarjeta.toLocaleString()}</td>
                            <td className="px-6 py-4 text-sm text-slate-600 font-medium">${row.qr.toLocaleString()}</td>
                            <td className="px-6 py-4 text-sm text-slate-600 font-medium">${row.cargoHabitacion.toLocaleString()}</td>
                            <td className="px-6 py-4">
                              <span className="text-sm font-bold text-slate-900">${row.total.toLocaleString()}</span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col">
                                <span className={cn(
                                  "text-xs font-bold px-2 py-1 rounded-full w-fit",
                                  totalDayOccupancy > 0 ? (row.cantidad / totalDayOccupancy > 0.2 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700") : "bg-slate-100 text-slate-500"
                                )}>
                                  {totalDayOccupancy > 0 ? `${((row.cantidad / totalDayOccupancy) * 100).toFixed(1)}%` : '-'}
                                </span>
                                {totalDayOccupancy > 0 && (
                                  <span className="text-[10px] text-slate-400 mt-1 font-medium">
                                    ({row.cantidad}/{totalDayOccupancy})
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-1.5">
                                <TrendingUp size={14} className="text-emerald-500" />
                                <span className="text-sm font-bold text-emerald-600">${Math.round(row.ticketPromedio).toLocaleString()}</span>
                              </div>
                            </td>
                          </tr>
                        ));
                      })() : (
                        <tr>
                          <td colSpan={9} className="px-6 py-12 text-center text-slate-400 font-medium">
                            No hay datos registrados para el día de ayer.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Mobile/Tablet Card View (Optimized for Screenshots) */}
                <div className="lg:hidden p-4 space-y-4 bg-slate-50/50">
                  {filteredYesterdayData.length > 0 ? (() => {
                    const totalDayOccupancy = Math.max(...yesterdayData.map(d => d.ocupacion || 0), 0);
                    return filteredYesterdayData.map((row, idx) => (
                      <div key={idx} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-slate-100 bg-white flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            {row.tipo === 'ALMUERZO' ? <Coffee size={18} className="text-amber-500" /> : 
                             row.tipo === 'CENA' ? <Moon size={18} className="text-indigo-500" /> : 
                             <Utensils size={18} className="text-slate-400" />}
                            <span className="font-black text-slate-800 uppercase tracking-tight">{row.tipo}</span>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className={cn(
                              "text-[10px] font-black px-2 py-0.5 rounded-full",
                              totalDayOccupancy > 0 ? (row.cantidad / totalDayOccupancy > 0.2 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700") : "bg-slate-100 text-slate-500"
                            )}>
                              {totalDayOccupancy > 0 ? `${((row.cantidad / totalDayOccupancy) * 100).toFixed(1)}% CONV.` : '-%'}
                            </span>
                            <span className="text-[9px] text-slate-400 font-bold mt-0.5">({row.cantidad}/{totalDayOccupancy} PAX)</span>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 divide-x divide-slate-100">
                          <div className="p-3 space-y-3">
                            <div>
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Cubiertos</p>
                              <p className="text-lg font-black text-slate-900">{row.cantidad}</p>
                            </div>
                            <div>
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Total Ventas</p>
                              <p className="text-lg font-black text-violet-600">${row.total.toLocaleString()}</p>
                            </div>
                          </div>
                          <div className="p-3 space-y-3">
                            <div>
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Ticket Promedio</p>
                              <div className="flex items-center gap-1">
                                <TrendingUp size={12} className="text-emerald-500" />
                                <p className="text-lg font-black text-emerald-600">${Math.round(row.ticketPromedio).toLocaleString()}</p>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <p className="text-[8px] font-bold text-slate-400 uppercase">Efec.</p>
                                <p className="text-[11px] font-bold text-slate-700">${row.efectivo.toLocaleString()}</p>
                              </div>
                              <div>
                                <p className="text-[8px] font-bold text-slate-400 uppercase">Tarj.</p>
                                <p className="text-[11px] font-bold text-slate-700">${row.tarjeta.toLocaleString()}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
                          <div className="flex gap-3">
                            <div className="flex flex-col">
                              <span className="text-[8px] font-bold text-slate-400 uppercase">QR</span>
                              <span className="text-[10px] font-bold text-slate-600">${row.qr.toLocaleString()}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[8px] font-bold text-slate-400 uppercase">Hab.</span>
                              <span className="text-[10px] font-bold text-slate-600">${row.cargoHabitacion.toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ));
                  })() : (
                    <div className="py-12 text-center text-slate-400 font-medium bg-white rounded-xl border border-dashed border-slate-200">
                      No hay datos registrados para el día de ayer.
                    </div>
                  )}
                </div>
              </div>
              </motion.div>
            </motion.div>
          ) : currentView === 'calendar' ? (
            <motion.div
              key="calendar"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <CalendarView data={filteredData} />
            </motion.div>
          ) : (
            <motion.div
              key="billing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              <BillingView data={filteredData} />
            </motion.div>
          )}
      </AnimatePresence>
      </main>
    </div>
  );
}

function CalendarView({ data }: { data: DailyStats[] }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const statsByDay = useMemo<Record<string, { total: number; pax: number; items: DailyStats[] }>>(() => {
    const grouped: Record<string, { total: number; pax: number; items: DailyStats[] }> = {};
    data.forEach(item => {
      if (!grouped[item.fecha]) grouped[item.fecha] = { total: 0, pax: 0, items: [] };
      grouped[item.fecha].total += item.total;
      grouped[item.fecha].pax += item.cantidad;
      grouped[item.fecha].items.push(item);
    });
    return grouped;
  }, [data]);

  // Calculate max values for relative bars
  const maxStats = useMemo(() => {
    let maxPax = 0;
    let maxTotal = 0;
    Object.values(statsByDay).forEach((s: { total: number; pax: number; items: DailyStats[] }) => {
      if (s.pax > maxPax) maxPax = s.pax;
      if (s.total > maxTotal) maxTotal = s.total;
    });
    return { maxPax, maxTotal };
  }, [statsByDay]);

  const selectedDayData = selectedDay ? statsByDay[selectedDay] : null;

  return (
    <div className="space-y-6">
      <motion.div 
        whileHover={{ y: -2 }}
        className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden"
      >
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <h3 className="text-xl font-bold text-slate-800 capitalize">
              {format(currentMonth, 'MMMM yyyy', { locale: es })}
            </h3>
            <div className="flex items-center gap-1">
              <motion.button 
                whileTap={{ scale: 0.9 }}
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-600"
              >
                <ChevronLeft size={20} />
              </motion.button>
              <motion.button 
                whileTap={{ scale: 0.9 }}
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-600"
              >
                <ChevronRight size={20} />
              </motion.button>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-4 text-xs font-medium text-slate-500">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-blue-500" /> Carga (PAX)
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-500" /> Facturación
              </div>
            </div>
            <motion.button 
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                const today = new Date();
                setCurrentMonth(today);
                setSelectedDay(format(today, 'dd/MM/yyyy'));
              }}
              className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-sm font-bold border border-slate-200 transition-colors"
            >
              Hoy
            </motion.button>
          </div>
        </div>

        <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/50">
          {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(day => (
            <div key={day} className="py-3 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {days.map((day, idx) => {
            const dateStr = format(day, 'dd/MM/yyyy');
            const dayStats = statsByDay[dateStr];
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isTodayDate = isToday(day);
            const isSelected = selectedDay === dateStr;

            return (
              <div 
                key={idx} 
                onClick={() => setSelectedDay(dateStr)}
                className={cn(
                  "min-h-[100px] lg:min-h-[130px] p-2 lg:p-3 border-r border-b border-slate-100 transition-all cursor-pointer relative group",
                  !isCurrentMonth && "bg-slate-50/30 opacity-40",
                  isSelected && "bg-blue-50/50 ring-2 ring-inset ring-blue-500 z-10",
                  !isSelected && isCurrentMonth && "hover:bg-slate-50"
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={cn(
                    "text-xs lg:text-sm font-bold w-6 h-6 lg:w-7 lg:h-7 flex items-center justify-center rounded-full transition-colors",
                    isTodayDate ? "bg-blue-600 text-white shadow-md shadow-blue-100" : 
                    isSelected ? "bg-blue-100 text-blue-700" : "text-slate-500 group-hover:text-slate-900"
                  )}>
                    {format(day, 'd')}
                  </span>
                  {dayStats && (
                    <span className="text-[10px] font-bold text-slate-400">
                      {dayStats.items.length} serv.
                    </span>
                  )}
                </div>

                {dayStats && (
                  <div className="space-y-2">
                    {/* Workload Indicator (PAX) */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[9px] font-bold text-blue-700">
                        <div className="flex items-center gap-1">
                          <Users size={10} />
                          <span>{dayStats.pax}</span>
                        </div>
                      </div>
                      <div className="h-1 w-full bg-blue-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-500 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, (dayStats.pax / (maxStats.maxPax || 1)) * 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Billing Indicator */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[9px] font-bold text-emerald-700">
                        <div className="flex items-center gap-1">
                          <Wallet size={10} />
                          <span>${Math.round(dayStats.total).toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="h-1 w-full bg-emerald-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, (dayStats.total / (maxStats.maxTotal || 1)) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Day Detail Section */}
      <AnimatePresence mode="wait">
        {selectedDayData ? (
          <motion.div
            key={selectedDay}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            whileHover={{ y: -4 }}
            className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden"
          >
            <div className="p-6 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between">
              <div>
                <h4 className="text-lg font-bold text-slate-800">
                  Detalle del {format(parse(selectedDay!, 'dd/MM/yyyy', new Date()), "EEEE, d 'de' MMMM", { locale: es })}
                </h4>
                <p className="text-slate-500 text-sm font-medium">Resumen de servicios y facturación</p>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total PAX</p>
                  <p className="text-xl font-black text-blue-600">{selectedDayData.pax}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Facturación</p>
                  <p className="text-xl font-black text-emerald-600">${selectedDayData.total.toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {['ALMUERZO', 'CENA', 'OTROS'].map(tipo => {
                  const item = selectedDayData.items.find(i => i.tipo === tipo);
                  if (!item) return null;

                  return (
                    <div key={tipo} className="bg-slate-50 rounded-xl p-5 border border-slate-100 hover:border-blue-200 transition-colors">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-10 h-10 rounded-lg flex items-center justify-center",
                            tipo === 'ALMUERZO' ? "bg-amber-100 text-amber-600" :
                            tipo === 'CENA' ? "bg-indigo-100 text-indigo-600" :
                            "bg-slate-200 text-slate-600"
                          )}>
                            {tipo === 'ALMUERZO' ? <Coffee size={20} /> : 
                             tipo === 'CENA' ? <Moon size={20} /> : 
                             <Utensils size={20} />}
                          </div>
                          <span className="font-bold text-slate-800">{tipo}</span>
                        </div>
                        <span className="bg-white px-2 py-1 rounded-md text-xs font-bold text-slate-500 border border-slate-200">
                          {item.cantidad} PAX
                        </span>
                      </div>

                      <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500 font-medium">Facturación</span>
                          <span className="font-bold text-slate-900">${item.total.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500 font-medium">Ticket Prom.</span>
                          <span className="font-bold text-blue-600">${Math.round(item.ticketPromedio).toLocaleString()}</span>
                        </div>
                        
                        <div className="pt-3 border-t border-slate-200 mt-3">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Medios de Pago</p>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="text-[11px]">
                              <span className="text-slate-400">Efectivo:</span>
                              <span className="ml-1 font-bold text-slate-700">${item.efectivo.toLocaleString()}</span>
                            </div>
                            <div className="text-[11px]">
                              <span className="text-slate-400">Tarjeta:</span>
                              <span className="ml-1 font-bold text-slate-700">${item.tarjeta.toLocaleString()}</span>
                            </div>
                            <div className="text-[11px]">
                              <span className="text-slate-400">QR:</span>
                              <span className="ml-1 font-bold text-slate-700">${item.qr.toLocaleString()}</span>
                            </div>
                            <div className="text-[11px]">
                              <span className="text-slate-400">C. Habitación:</span>
                              <span className="ml-1 font-bold text-slate-700">${item.cargoHabitacion.toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        ) : (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
            <CalendarIcon size={48} className="text-slate-200 mx-auto mb-4" />
            <p className="text-slate-400 font-medium">Selecciona un día para ver el detalle de las reservas</p>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function BillingView({ data }: { data: DailyStats[] }) {
  const billingStats = useMemo(() => {
    const total = data.reduce((acc, curr) => acc + curr.total, 0);
    const efectivo = data.reduce((acc, curr) => acc + curr.efectivo, 0);
    const tarjeta = data.reduce((acc, curr) => acc + curr.tarjeta, 0);
    const qr = data.reduce((acc, curr) => acc + curr.qr, 0);
    const cargoHabitacion = data.reduce((acc, curr) => acc + curr.cargoHabitacion, 0);
    
    const byType = {
      ALMUERZO: data.filter(d => d.tipo === 'ALMUERZO').reduce((acc, curr) => acc + curr.total, 0),
      CENA: data.filter(d => d.tipo === 'CENA').reduce((acc, curr) => acc + curr.total, 0),
      OTROS: data.filter(d => d.tipo === 'OTROS').reduce((acc, curr) => acc + curr.total, 0),
    };

    const dailyEvolution = data.reduce((acc: any[], curr) => {
      const existing = acc.find(a => a.fecha === curr.fecha);
      if (existing) {
        existing.total += curr.total;
        existing.efectivo += curr.efectivo;
        existing.tarjeta += curr.tarjeta;
        existing.qr += curr.qr;
        existing.cargoHabitacion += curr.cargoHabitacion;
      } else {
        acc.push({
          fecha: curr.fecha,
          total: curr.total,
          efectivo: curr.efectivo,
          tarjeta: curr.tarjeta,
          qr: curr.qr,
          cargoHabitacion: curr.cargoHabitacion,
          dateObj: parse(curr.fecha, 'dd/MM/yyyy', new Date())
        });
      }
      return acc;
    }, []).sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

    return { total, efectivo, tarjeta, qr, cargoHabitacion, byType, dailyEvolution };
  }, [data]);

  return (
    <div className="space-y-8">
      {/* Billing KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard 
          title="Facturación Total" 
          value={`$${billingStats.total.toLocaleString()}`} 
          icon={<Wallet className="text-emerald-600" />} 
          trend="+8.2%" 
          trendUp={true}
          color="emerald"
        />
        <KpiCard 
          title="Ventas Almuerzo" 
          value={`$${billingStats.byType.ALMUERZO.toLocaleString()}`} 
          icon={<Coffee className="text-amber-600" />} 
          trend="+5.4%" 
          trendUp={true}
          color="amber"
        />
        <KpiCard 
          title="Ventas Cena" 
          value={`$${billingStats.byType.CENA.toLocaleString()}`} 
          icon={<Moon className="text-indigo-600" />} 
          trend="+12.1%" 
          trendUp={true}
          color="blue"
        />
        <KpiCard 
          title="Otros Ingresos" 
          value={`$${billingStats.byType.OTROS.toLocaleString()}`} 
          icon={<Utensils className="text-slate-600" />} 
          trend="Estable" 
          trendUp={true}
          color="violet"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Payment Methods Breakdown */}
        <motion.div 
          whileHover={{ y: -4 }}
          className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-300"
        >
          <h3 className="text-xl font-bold text-slate-800 mb-8 flex items-center gap-3">
            <CreditCard className="text-blue-600" />
            Distribución por Medio de Pago
          </h3>
          <div className="space-y-6">
            {[
              { label: 'Efectivo', value: billingStats.efectivo, color: 'bg-emerald-500' },
              { label: 'Tarjeta', value: billingStats.tarjeta, color: 'bg-blue-500' },
              { label: 'QR', value: billingStats.qr, color: 'bg-amber-500' },
              { label: 'Cargo de Habitación', value: billingStats.cargoHabitacion, color: 'bg-indigo-500' },
            ].map(item => (
              <div key={item.label} className="space-y-2">
                <div className="flex justify-between items-end">
                  <span className="text-sm font-bold text-slate-600">{item.label}</span>
                  <div className="text-right">
                    <span className="text-lg font-black text-slate-900">${item.value.toLocaleString()}</span>
                    <span className="ml-2 text-xs font-bold text-slate-400">
                      ({billingStats.total > 0 ? ((item.value / billingStats.total) * 100).toFixed(1) : 0}%)
                    </span>
                  </div>
                </div>
                <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${(item.value / (billingStats.total || 1)) * 100}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className={cn("h-full rounded-full shadow-inner", item.color)}
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Daily Billing Evolution */}
        <motion.div 
          whileHover={{ y: -4 }}
          className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-300"
        >
          <h3 className="text-xl font-bold text-slate-800 mb-8 flex items-center gap-3">
            <TrendingUp className="text-emerald-600" />
            Evolución Diaria de Ingresos
          </h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={billingStats.dailyEvolution}>
                <defs>
                  <linearGradient id="colorBilling" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="fecha" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#64748b', fontSize: 11}}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#64748b', fontSize: 11}}
                  tickFormatter={(val) => `$${val/1000}k`}
                />
                <Tooltip 
                  contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                  formatter={(value: any) => [`$${value.toLocaleString()}`, 'Facturación']}
                />
                <Area type="monotone" dataKey="total" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorBilling)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Detailed Billing Table */}
      <motion.div 
        whileHover={{ y: -4 }}
        className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden"
      >
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-800">Desglose Detallado por Servicio</h3>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Registros: {data.length}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Fecha</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Servicio</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Efectivo</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Tarjeta</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">QR</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">C. Hab.</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 text-sm font-bold text-slate-700">{row.fecha}</td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider",
                      row.tipo === 'ALMUERZO' ? "bg-amber-100 text-amber-700" :
                      row.tipo === 'CENA' ? "bg-indigo-100 text-indigo-700" :
                      "bg-slate-100 text-slate-600"
                    )}>
                      {row.tipo}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 font-medium">${row.efectivo.toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm text-slate-600 font-medium">${row.tarjeta.toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm text-slate-600 font-medium">${row.qr.toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm text-slate-600 font-medium">${row.cargoHabitacion.toLocaleString()}</td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-black text-emerald-600">${row.total.toLocaleString()}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}

function NavItem({ icon, label, active = false, onClick }: { icon: React.ReactNode; label: string; active?: boolean; onClick?: () => void }) {
  return (
    <motion.button 
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all shadow-sm",
        active 
          ? "bg-blue-600 text-white shadow-blue-200 shadow-lg" 
          : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
      )}
    >
      {icon}
      {label}
    </motion.button>
  );
}

function KpiCard({ title, value, icon, trend, trendUp, color }: { 
  title: string; 
  value: string; 
  icon: React.ReactNode; 
  trend: string; 
  trendUp: boolean;
  color: 'blue' | 'emerald' | 'amber' | 'violet' | 'rose';
}) {
  const colorClasses = {
    blue: "bg-blue-50 text-blue-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    violet: "bg-violet-50 text-violet-600",
    rose: "bg-rose-50 text-rose-600",
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -5, scale: 1.02 }}
      className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-300 cursor-default"
    >
      <div className="flex items-center justify-between mb-4">
        <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shadow-inner", colorClasses[color])}>
          {icon}
        </div>
        <div className={cn(
          "flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold shadow-sm",
          trendUp ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
        )}>
          {trendUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          {trend}
        </div>
      </div>
      <div>
        <p className="text-slate-500 text-sm font-medium mb-1">{title}</p>
        <h4 className="text-2xl font-bold text-slate-900 tracking-tight">{value}</h4>
      </div>
    </motion.div>
  );
}
