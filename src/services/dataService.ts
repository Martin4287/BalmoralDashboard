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

export interface ServiceDetail {
  pax: number;
  total: number;
  pago: string;
  comentario: string;
  referencia: string;
  mesa: string;
  habitacion: string;
  hora: string;
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
  details: ServiceDetail[];
}

const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1ejsrirpAwCVsftNfF9GQuQRu8q-TEA_kzLxoCts83Zo/export?format=csv';

export const fetchData = async (): Promise<DailyStats[]> => {
  try {
    const response = await fetch(`${SHEET_URL}&t=${Date.now()}`);
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
          
          // Debug: Log headers and first row to see what we're actually getting
          if (rawData.length > 0) {
            console.log('[DataService] Normalized headers found:', Object.keys(rawData[0]));
            console.log('[DataService] First row sample:', rawData[0]);
          }

          // Helper to normalize strings for matching (removes accents)
          const normalizeForMatch = (s: string) => 
            String(s || '')
              .toLowerCase()
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .trim()
              .replace(/[\s.]+/g, '_');

          // Filter by arrived (case insensitive)
          const arrivedData = rawData.filter(row => {
            const arrivedVal = row.arrived || row.llegado || row.status || row.llegó;
            if (arrivedVal === undefined || arrivedVal === null || arrivedVal === '') return true;
            const arrived = String(arrivedVal).toUpperCase().trim();
            return arrived === 'TRUE' || arrived === 'VERDADERO' || arrived === 'SÍ' || arrived === 'SI' || arrived === '1' || arrived === 'CHECKED' || arrived === 'OK';
          });

          console.log(`[DataService] Filas tras filtro 'arrived': ${arrivedData.length}`);

          // Group by date and type
          const grouped: Record<string, DailyStats> = {};
          let occupancyFoundCount = 0;

          arrivedData.forEach(row => {
            // Fuzzy header matching helper
            const rowKeys = Object.keys(row);
            const normalizedRowKeys = rowKeys.map(k => ({ original: k, normalized: normalizeForMatch(k) }));

            const getVal = (aliases: string[]) => {
              const normalizedAliases = aliases.map(a => normalizeForMatch(a));
              
              // 1. Try exact normalized match
              for (const nAlias of normalizedAliases) {
                const foundKey = normalizedRowKeys.find(rk => rk.normalized === nAlias);
                if (foundKey && row[foundKey.original] !== undefined) return row[foundKey.original];
              }

              // 2. Try partial match
              for (const nAlias of normalizedAliases) {
                const foundKey = normalizedRowKeys.find(rk => rk.normalized.includes(nAlias) || nAlias.includes(rk.normalized));
                if (foundKey && row[foundKey.original] !== undefined) return row[foundKey.original];
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
            else if (type.includes('OCUPACION') || type.includes('OCUPACIÓN')) type = 'OCUPACION';
            
            const key = `${normalizedDate}_${type}`;

            const parseNum = (val: any) => {
              if (val === undefined || val === null || val === '') return 0;
              if (typeof val === 'number') return val;
              
              let clean = String(val).replace(/[$\s]/g, '');
              if (clean.includes('.') && clean.includes(',')) {
                clean = clean.replace(/\./g, '').replace(',', '.');
              } else if (clean.includes(',')) {
                clean = clean.replace(',', '.');
              }
              
              const num = parseFloat(clean);
              return isNaN(num) ? 0 : num;
            };

            const efectivo = parseNum(getVal(['efectivo', 'cash', 'contado']));
            const tarjeta = parseNum(getVal(['tarjeta', 'card', 'débito', 'credito', 'crédito', 'visa', 'master']));
            const qr = parseNum(getVal(['qr', 'pix', 'transferencia', 'pago_móvil', 'mercado_pago', 'mp']));
            const cargoHabitacion = parseNum(getVal(['cargo_habitacion', 'room_charge', 'cargo_hab', 'habitación', 'habitacion', 'cargo_de_habitacion']));
            const total = parseNum(getVal(['monto', 'total', 'importe', 'subtotal', 'neto']));

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

            if (ocupacion > 0) {
              occupancyFoundCount++;
              if (occupancyFoundCount < 10) {
                console.log(`[DataService] Found occupancy row: Date=${normalizedDate}, Type=${type}, Value=${ocupacion}`);
              }
            }

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
                ocupacion: 0,
                details: []
              };
            }

            grouped[key].cantidad += cantidad;
            grouped[key].efectivo += finalEfectivo;
            grouped[key].tarjeta += finalTarjeta;
            grouped[key].qr += finalQr;
            grouped[key].cargoHabitacion += finalCargoHabitacion;
            grouped[key].total += finalTotal;
            
            // Create a normalized detail object
            const detail: ServiceDetail = {
              pax: cantidad,
              total: finalTotal,
              pago: paymentMethodRaw || 'S/D',
              comentario: String(getVal(['comentario', 'detalle', 'cliente', 'nota', 'comentarios']) || ''),
              referencia: String(getVal(['referencia', 'ref', 'id', 'nro', 'reserva']) || 'N/A'),
              mesa: String(getVal(['mesa', 'table', 'nro_mesa', 'numero_mesa']) || 'N/A'),
              habitacion: String(getVal(['habitacion', 'habitación', 'room', 'nro_habitacion', 'nro_hab']) || 'N/A'),
              hora: String(getVal(['hora', 'time', 'h', 'horario']) || '--:--')
            };
            grouped[key].details.push(detail);
            // For occupancy, we take the max value if multiple rows for the same date/type have it
            if (ocupacion > grouped[key].ocupacion) {
              grouped[key].ocupacion = ocupacion;
            }
          });

          console.log(`[DataService] Registros de ocupación encontrados: ${occupancyFoundCount}`);

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
