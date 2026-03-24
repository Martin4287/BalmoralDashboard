import Papa from 'papaparse';
import { format, parse, subDays, isSameDay } from 'date-fns';

export interface RawReservation {
  fecha: string;
  tipo: string;
  cantidad: string | number;
  arrived: string | boolean;
  efectivo: string | number;
  tarjeta: string | number;
  qr: string | number;
  cargo_habitacion: string | number;
  total: string | number;
  [key: string]: any;
}

export interface DailyStats {
  fecha: string;
  tipo: string;
  cantidad: number;
  efectivo: number;
  tarjeta: number;
  qr: number;
  cargoHabitacion: number;
  total: number;
  ticketPromedio: number;
  ocupacion: number;
}

const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1ejsrirpAwCVsftNfF9GQuQRu8q-TEA_kzLxoCts83Zo/export?format=csv';

export const fetchData = async (): Promise<DailyStats[]> => {
  try {
    const response = await fetch(SHEET_URL);
    if (!response.ok) throw new Error('Failed to fetch Google Sheet');
    const csvText = await response.text();
    
    return new Promise((resolve, reject) => {
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => {
          // Normalize headers: lowercase, trim, replace spaces/dots with underscores
          return header.toLowerCase().trim().replace(/[\s.]+/g, '_');
        },
        complete: (results) => {
          const rawData = results.data as any[];
          
          // Debug: Log headers to see what we're actually getting
          if (rawData.length > 0) {
            console.log('Normalized headers found:', Object.keys(rawData[0]));
          }

          // Filter by arrived (case insensitive)
          const arrivedData = rawData.filter(row => {
            const arrivedVal = row.arrived || row.llegado || row.status || row.llegó;
            if (arrivedVal === undefined || arrivedVal === null || arrivedVal === '') return true;
            const arrived = String(arrivedVal).toUpperCase().trim();
            return arrived === 'TRUE' || arrived === 'VERDADERO' || arrived === 'SÍ' || arrived === 'SI' || arrived === '1' || arrived === 'CHECKED' || arrived === 'OK';
          });

          // Group by date and type
          const grouped: Record<string, DailyStats> = {};

          arrivedData.forEach(row => {
            // Fuzzy header matching helper
            const getVal = (aliases: string[]) => {
              for (const alias of aliases) {
                const normalizedAlias = alias.toLowerCase().trim().replace(/[\s.]+/g, '_');
                if (row[normalizedAlias] !== undefined) return row[normalizedAlias];
              }
              // Try even looser match
              const rowKeys = Object.keys(row);
              for (const alias of aliases) {
                const normalizedAlias = alias.toLowerCase().trim().replace(/[\s.]+/g, '_');
                const found = rowKeys.find(rk => rk.includes(normalizedAlias) || normalizedAlias.includes(rk));
                if (found) return row[found];
              }
              return undefined;
            };

            const dateStr = getVal(['fecha', 'date', 'día', 'dia', 'e', 'f']);
            if (!dateStr) return;

            // Normalize date to dd/MM/yyyy for the rest of the app
            let normalizedDate = String(dateStr).trim();
            // If it's yyyy-MM-dd, convert it
            if (/^\d{4}-\d{2}-\d{2}/.test(normalizedDate)) {
              const [y, m, d] = normalizedDate.split(/[-/]/);
              normalizedDate = `${d}/${m}/${y}`;
            } else if (/^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(normalizedDate)) {
              // Already likely dd/MM/yyyy or MM/dd/yyyy
              // We'll trust the input or handle variations in App.tsx if needed
            }

            // Normalize type
            let typeRaw = getVal(['tipo', 'type', 'servicio', 'category']);
            let type = String(typeRaw || 'OTROS').toUpperCase().trim();
            if (type.includes('ALMUERZO') || type.includes('LUNCH') || type.includes('MEDIODIA')) type = 'ALMUERZO';
            else if (type.includes('CENA') || type.includes('DINNER') || type.includes('NOCHE')) type = 'CENA';
            else if (type.includes('OTRO')) type = 'OTROS';
            
            const key = `${normalizedDate}_${type}`;

            const parseNum = (val: any) => {
              if (val === undefined || val === null || val === '') return 0;
              if (typeof val === 'number') return val;
              
              let clean = String(val).replace(/[$\s]/g, '');
              if (clean.includes('.') && clean.includes(',')) {
                clean = clean.replace(/\./g, '').replace(',', '.');
              } else if (clean.includes(',')) {
                // If it has a comma and it's like 1.234 or 1,234
                // In many locales , is decimal. But if it's 1.000,00 we handled it.
                // If it's just 1,000 it might be 1000 or 1.0. 
                // We'll assume it's a decimal separator if it's the only separator.
                clean = clean.replace(',', '.');
              }
              
              const num = parseFloat(clean);
              return isNaN(num) ? 0 : num;
            };

            const efectivo = parseNum(getVal(['efectivo', 'cash', 'contado']));
            const tarjeta = parseNum(getVal(['tarjeta', 'card', 'débito', 'credito', 'crédito', 'visa', 'master']));
            const qr = parseNum(getVal(['qr', 'pix', 'transferencia', 'pago_móvil', 'mercado_pago', 'mp']));
            const cargoHabitacion = parseNum(getVal(['cargo_habitacion', 'room_charge', 'cargo_hab', 'habitación', 'habitacion', 'cargo_de_habitacion']));
            const total = parseNum(getVal(['total', 'monto', 'importe', 'subtotal', 'neto']));

            const paymentMethodRaw = String(getVal(['pago', 'medio_de_pago', 'forma_de_pago', 'payment_method']) || '').toUpperCase().trim();

            let finalEfectivo = efectivo;
            let finalTarjeta = tarjeta;
            let finalQr = qr;
            let finalCargoHabitacion = cargoHabitacion;

            if (paymentMethodRaw) {
              if (paymentMethodRaw.includes('EFECTIVO') || paymentMethodRaw.includes('CASH') || paymentMethodRaw.includes('CONTADO')) {
                finalEfectivo = total || efectivo;
              } else if (paymentMethodRaw.includes('TARJETA') || paymentMethodRaw.includes('CARD') || paymentMethodRaw.includes('VISA') || paymentMethodRaw.includes('MASTER') || paymentMethodRaw.includes('DEBITO') || paymentMethodRaw.includes('CREDITO')) {
                finalTarjeta = total || tarjeta;
              } else if (paymentMethodRaw.includes('QR') || paymentMethodRaw.includes('PIX') || paymentMethodRaw.includes('TRANSFERENCIA') || paymentMethodRaw.includes('MP') || paymentMethodRaw.includes('MERCADO')) {
                finalQr = total || qr;
              } else if (paymentMethodRaw.includes('HABITACION') || paymentMethodRaw.includes('ROOM') || paymentMethodRaw.includes('CARGO')) {
                finalCargoHabitacion = total || cargoHabitacion;
              }
            }

            // If total was 0 but we have individual payments, sum them up
            const calculatedTotal = finalEfectivo + finalTarjeta + finalQr + finalCargoHabitacion;
            const finalTotal = total || calculatedTotal;
            const cantidad = parseInt(String(getVal(['cantidad', 'pax', 'qty', 'personas', 'comensales']) || 0)) || 0;
            const ocupacion = parseNum(getVal(['ocupacion', 'ocupación', 'hotel_pax', 'pax_hotel', 'pax_h', 'h_pax', 'ocupacion_hotel']));

            if (!grouped[key]) {
              grouped[key] = {
                fecha: normalizedDate,
                tipo: type,
                cantidad: 0,
                efectivo: 0,
                tarjeta: 0,
                qr: 0,
                cargoHabitacion: 0,
                total: 0,
                ticketPromedio: 0,
                ocupacion: 0
              };
            }

            grouped[key].cantidad += cantidad;
            grouped[key].efectivo += finalEfectivo;
            grouped[key].tarjeta += finalTarjeta;
            grouped[key].qr += finalQr;
            grouped[key].cargoHabitacion += finalCargoHabitacion;
            grouped[key].total += finalTotal;
            // For occupancy, we take the max value if multiple rows for the same date/type have it
            if (ocupacion > grouped[key].ocupacion) {
              grouped[key].ocupacion = ocupacion;
            }
          });

          // Calculate averages
          const finalData = Object.values(grouped).map(stat => ({
            ...stat,
            ticketPromedio: stat.cantidad > 0 ? stat.total / stat.cantidad : 0
          }));

          resolve(finalData);
        },
        error: (error: any) => reject(error)
      });
    });
  } catch (error) {
    console.error('Error fetching data:', error);
    throw error;
  }
};
