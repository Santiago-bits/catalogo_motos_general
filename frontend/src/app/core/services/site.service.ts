import { Injectable, computed, inject, signal } from '@angular/core';
import { CatalogService } from './catalog.service';

/** Ajustes públicos del sitio (nombre, contacto), cargados una sola vez y compartidos. */
@Injectable({ providedIn: 'root' })
export class SiteService {
  private catalog = inject(CatalogService);
  private loaded = false;

  settings = signal<Record<string, string>>({});

  phone = computed(() => this.settings()['contact_phone'] || '');
  address = computed(() => this.settings()['contact_address'] || '');
  /** Logo con texto (Configuración → Marca); se usa cuando no hay "Logo del sitio" en imagen. */
  brandName = computed(() => this.settings()['brand_name']?.trim() || 'RODADO');
  brandSub = computed(() => this.settings()['brand_sub']?.trim() || 'MOTOS');
  /** Nombre comercial para textos: "Jacob Motor", "Rodado Motos". */
  companyName = computed(() =>
    `${this.brandName()} ${this.brandSub()}`.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase()),
  );
  /**
   * Configuración → Marca y logo: una sola imagen y "Cómo se muestra".
   * logoImage: la imagen sola, en lugar del nombre ('imagen').
   * brandIcon: la imagen a la izquierda del nombre (opción por defecto).
   */
  logoImage = computed(() => (this.settings()['logo_mode'] === 'imagen' ? this.settings()['site_logo'] || '' : ''));
  brandIcon = computed(() => (this.settings()['logo_mode'] ? '' : this.settings()['site_logo'] || ''));
  whatsappUrl = computed(() => {
    const number = (this.settings()['contact_whatsapp'] || '').replace(/\D/g, '');
    return number ? `https://wa.me/${number}` : '';
  });
  phoneUrl = computed(() => {
    const phone = this.phone().replace(/[^\d+]/g, '');
    return phone ? `tel:${phone}` : '';
  });

  /** Enlace a WhatsApp con el mensaje ya escrito. Todo el contacto con el cliente pasa por acá. */
  whatsappLink(text: string): string {
    const base = this.whatsappUrl();
    return base ? `${base}?text=${encodeURIComponent(text)}` : '';
  }

  /** Abre el chat en otra pestaña. Llamar directo desde el clic, para que el navegador no lo bloquee. */
  openWhatsapp(text: string): boolean {
    const link = this.whatsappLink(text);
    if (!link) return false;
    window.open(link, '_blank', 'noopener');
    return true;
  }

  load(): void {
    if (this.loaded) return;
    this.loaded = true;
    this.catalog.settings().subscribe({
      next: (s) => {
        this.settings.set(s ?? {});
        // El panel pone su propio título en cada pantalla.
        if (!location.pathname.startsWith('/admin')) document.title = `${this.companyName()} — Concesionaria`;
      },
      error: () => (this.loaded = false),
    });
  }
}
