import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Save, Calendar as CalendarIcon, Users, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface OccupancyFormProps {
  onSuccess: () => void;
}

export default function OccupancyForm({ onSuccess }: OccupancyFormProps) {
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [occupancy, setOccupancy] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!occupancy || isNaN(Number(occupancy))) {
      setStatus('error');
      setMessage('Ingresa un número válido');
      return;
    }

    setStatus('loading');
    
    const scriptUrl = (import.meta as any).env.VITE_GOOGLE_SCRIPT_URL;

    if (!scriptUrl) {
      // Simulación si no hay URL configurada para que el usuario vea cómo funciona
      setTimeout(() => {
        setStatus('success');
        setMessage('¡Datos guardados! (Modo Simulación)');
        setTimeout(() => {
          setStatus('idle');
          setOccupancy('');
          onSuccess();
        }, 2000);
      }, 1500);
      return;
    }

    try {
      // Formatear fecha para el Sheet (dd/MM/yyyy)
      const [y, m, d] = date.split('-');
      const formattedDate = `${d}/${m}/${y}`;

      const response = await fetch(scriptUrl, {
        method: 'POST',
        mode: 'no-cors', // Necesario para Google Apps Script
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fecha: formattedDate,
          ocupacion: Number(occupancy),
          tipo: 'OCUPACION', // Identificador más simple
          timestamp: new Date().toISOString()
        }),
      });

      // Con no-cors no podemos ver el body, pero si llegamos aquí es que se envió
      setStatus('success');
      setMessage('Ocupación enviada correctamente');
      setOccupancy('');
      
      setTimeout(() => {
        setStatus('idle');
        onSuccess();
      }, 3000);
    } catch (error) {
      console.error('Error saving occupancy:', error);
      setStatus('error');
      setMessage('Error al conectar con Google Sheets');
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
        <Users size={14} className="text-violet-500" />
        Cargar Ocupación Diaria
      </h4>

      <form onSubmit={handleSubmit} className="space-y-3">
        <p className="text-[9px] text-slate-400 italic mb-2">
          * Los datos pueden tardar unos minutos en reflejarse en el dashboard debido a la sincronización de Google Sheets.
        </p>
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 ml-1">Fecha</label>
          <div className="relative">
            <CalendarIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="date" 
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 outline-none transition-all"
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 ml-1">Pax en Hotel</label>
          <div className="relative">
            <Users size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="number" 
              placeholder="Ej: 45"
              value={occupancy}
              onChange={(e) => setOccupancy(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 outline-none transition-all"
            />
          </div>
        </div>

        <motion.button
          whileTap={{ scale: 0.98 }}
          disabled={status === 'loading'}
          className={`w-full py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all ${
            status === 'loading' ? 'bg-slate-100 text-slate-400' :
            status === 'success' ? 'bg-emerald-500 text-white' :
            status === 'error' ? 'bg-rose-500 text-white' :
            'bg-violet-600 text-white hover:bg-violet-700 shadow-sm'
          }`}
        >
          {status === 'loading' ? <Loader2 size={16} className="animate-spin" /> :
           status === 'success' ? <CheckCircle2 size={16} /> :
           status === 'error' ? <AlertCircle size={16} /> :
           <Save size={16} />}
          {status === 'loading' ? 'Guardando...' :
           status === 'success' ? '¡Guardado!' :
           status === 'error' ? 'Reintentar' :
           'Guardar Ocupación'}
        </motion.button>

        {message && (
          <p className={`text-[10px] font-medium text-center mt-2 ${
            status === 'error' ? 'text-rose-500' : 'text-emerald-600'
          }`}>
            {message}
          </p>
        )}
      </form>
    </div>
  );
}
