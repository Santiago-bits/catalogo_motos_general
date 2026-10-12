/** Textos y colores de estados que se repiten en todo el panel. */

export type ChipClass = 'ok' | 'warn' | 'danger' | 'info' | 'neutral' | 'accent' | 'dark';

export const AVAILABILITY: Record<string, { label: string; chip: ChipClass }> = {
  disponible: { label: 'Disponible', chip: 'ok' },
  reservado: { label: 'Reservada', chip: 'warn' },
  vendido: { label: 'Vendida', chip: 'danger' },
  consultar: { label: 'Consultar', chip: 'neutral' },
};

export const CONDITION: Record<string, { label: string; chip: ChipClass }> = {
  nueva: { label: '0 km', chip: 'ok' },
  usada: { label: 'Usada', chip: 'warn' },
  reacondicionada: { label: 'Reacondicionada', chip: 'info' },
};

export const INQUIRY_STATUS: Record<string, { label: string; chip: ChipClass }> = {
  nueva: { label: 'Nueva', chip: 'accent' },
  en_proceso: { label: 'En proceso', chip: 'warn' },
  respondida: { label: 'Respondida', chip: 'ok' },
  cerrada: { label: 'Cerrada', chip: 'neutral' },
};

export const QUOTE_STATUS: Record<string, { label: string; chip: ChipClass }> = {
  pendiente: { label: 'Pendiente', chip: 'accent' },
  contactado: { label: 'Contactado', chip: 'ok' },
  cerrada: { label: 'Cerrada', chip: 'neutral' },
};

export const CHANNELS: Record<string, string> = {
  web: 'Ficha de producto',
  whatsapp: 'WhatsApp (ficha de producto)',
  contacto: 'Formulario de contacto',
  canje: 'Plan canje',
  newsletter: 'Newsletter',
  financiacion: 'Financiación',
  service: 'Service',
  repuestos: 'Repuestos',
};

export const AUDIT_ACTIONS: Record<string, { label: string; chip: ChipClass }> = {
  crear: { label: 'Alta', chip: 'ok' },
  editar: { label: 'Edición', chip: 'info' },
  eliminar: { label: 'Baja', chip: 'danger' },
  login: { label: 'Ingreso', chip: 'neutral' },
  importar: { label: 'Importación', chip: 'warn' },
  exportar: { label: 'Exportación', chip: 'neutral' },
};

export const TAG_COLORS: { value: string; label: string }[] = [
  { value: 'red', label: 'Rojo' },
  { value: 'dark', label: 'Negro' },
  { value: 'green', label: 'Verde' },
  { value: 'blue', label: 'Azul' },
  { value: 'orange', label: 'Naranja' },
  { value: 'gray', label: 'Gris' },
];

/** Secciones del catálogo en el panel (como Maquinaria / Máquinas usadas / Repuestos en SH). */
export interface CatalogSection {
  key: 'motos' | 'usadas' | 'cascos' | 'repuestos';
  type: 'moto' | 'casco' | 'repuesto';
  condicion?: 'usada';
  title: string;
  singular: string;
  icon: string;
  publicPath: string;
}

export const SECTIONS: Record<CatalogSection['key'], CatalogSection> = {
  motos: { key: 'motos', type: 'moto', title: 'Motos 0 km', singular: 'moto', icon: 'bi-bicycle', publicPath: 'motos' },
  usadas: { key: 'usadas', type: 'moto', condicion: 'usada', title: 'Motos usadas', singular: 'moto usada', icon: 'bi-arrow-repeat', publicPath: 'motos' },
  cascos: { key: 'cascos', type: 'casco', title: 'Cascos', singular: 'casco', icon: 'bi-shield-shaded', publicPath: 'cascos' },
  repuestos: { key: 'repuestos', type: 'repuesto', title: 'Repuestos', singular: 'repuesto', icon: 'bi-nut-fill', publicPath: 'repuestos' },
};

const numberFmt = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });
const dateFmt = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export function money(amount: number | string | null | undefined, currency = 'ARS'): string {
  if (amount === null || amount === undefined || amount === '') return '—';
  return `${currency === 'USD' ? 'US$' : '$'} ${numberFmt.format(Number(amount))}`;
}

export function num(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  return numberFmt.format(Number(value));
}

export function date(value: string | null | undefined, withTime = false): string {
  if (!value) return '—';
  const d = new Date(value);
  return isNaN(d.getTime()) ? '—' : (withTime ? dateTimeFmt : dateFmt).format(d);
}

/** URL pública de un producto en el sitio. */
export function publicUrl(product: { type: string; slug: string }): string {
  return `/${product.type}s/${product.slug}`;
}
