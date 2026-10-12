import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  type: 'ok' | 'error' | 'info';
  message: string;
}

export interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel: string;
  danger: boolean;
  resolve: (ok: boolean) => void;
}

/**
 * Avisos (toasts) y confirmaciones del panel, como el data-confirm y los
 * toasts de SH Servicios. El shell los dibuja; cualquier pantalla los pide.
 */
@Injectable({ providedIn: 'root' })
export class UiService {
  toasts = signal<Toast[]>([]);
  confirmRequest = signal<ConfirmRequest | null>(null);

  /** Contador de consultas nuevas / cotizaciones pendientes para el menú. */
  counters = signal<{ inquiries_new: number; quotes_pending: number }>({ inquiries_new: 0, quotes_pending: 0 });

  private nextId = 1;

  success(message: string): void {
    this.push('ok', message);
  }

  error(message: string): void {
    this.push('error', message, 7000);
  }

  info(message: string): void {
    this.push('info', message);
  }

  /** Mensaje legible de un error HTTP de Laravel (validación, 403, 422…). */
  apiError(err: any, fallback = 'No se pudo completar la acción.'): void {
    this.error(UiService.errorMessage(err, fallback));
  }

  static errorMessage(err: any, fallback = 'No se pudo completar la acción.'): string {
    // Sin respuesta del servidor (caído, reiniciándose o sin conexión): el navegador sólo dice "Failed to fetch".
    if (err?.status === 0) return 'No hay conexión con el servidor. Esperá unos segundos y probá de nuevo.';
    if (err?.status === 413) return 'El archivo es demasiado grande para el servidor.';
    const body = err?.error;
    if (body?.errors) {
      const first = Object.values(body.errors as Record<string, string[]>)[0];
      if (first?.length) return first[0];
    }
    if (body?.message && typeof body.message === 'string' && !body.message.startsWith('SQLSTATE')) {
      return body.message;
    }
    if (err?.status === 403) return 'No tenés permiso para realizar esta acción.';
    if (err?.status === 0) return 'No hay conexión con el servidor.';
    return fallback;
  }

  dismiss(id: number): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }

  confirm(message: string, options: { title?: string; confirmLabel?: string; danger?: boolean } = {}): Promise<boolean> {
    return new Promise((resolve) => {
      this.confirmRequest.set({
        title: options.title ?? 'Confirmar',
        message,
        confirmLabel: options.confirmLabel ?? 'Confirmar',
        danger: options.danger ?? false,
        resolve: (ok) => {
          this.confirmRequest.set(null);
          resolve(ok);
        },
      });
    });
  }

  private push(type: Toast['type'], message: string, timeout = 4500): void {
    const id = this.nextId++;
    this.toasts.update((list) => [...list.slice(-3), { id, type, message }]);
    setTimeout(() => this.dismiss(id), timeout);
  }
}
