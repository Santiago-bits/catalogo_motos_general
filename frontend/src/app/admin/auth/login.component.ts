import { Component, ElementRef, NgZone, OnInit, ViewChild, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { SiteService } from '../../core/services/site.service';

const GSI_URL = 'https://accounts.google.com/gsi/client';
let gsiPromise: Promise<any> | null = null;

/** Carga una sola vez el script de Google Identity Services. */
function loadGoogleScript(): Promise<any> {
  const w = window as any;
  if (w.google?.accounts?.id) return Promise.resolve(w.google);
  gsiPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GSI_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(w.google);
    script.onerror = () => {
      gsiPromise = null;
      reject(new Error('gsi'));
    };
    document.head.appendChild(script);
  });
  return gsiPromise;
}

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="login">
      <section class="login__hero">
        <a routerLink="/" class="brand">
          @if (site.logoImage(); as logo) {
            <img class="brand__logo" [src]="logo" alt="Inicio" />
          } @else {
          @if (site.brandIcon(); as icon) {
            <img class="brand__icon" [src]="icon" alt="" />
          }
          <span class="brand__name">{{ site.brandName() }}<span class="dot">.</span> <span class="brand__sub">{{ site.brandSub() }}</span></span>
          }
        </a>
        <div class="hero__copy">
          <span class="r-eyebrow hero__eyebrow">Panel administrativo</span>
          <h1 class="hero__title">Tu stock,<br><span>bajo control.</span></h1>
          <p class="hero__text">Cargá motos, respondé consultas y seguí las cotizaciones desde un solo lugar.</p>
        </div>
        <div class="hero__slash" aria-hidden="true"></div>
      </section>

      <section class="login__form-wrap">
        <form class="login__form" (ngSubmit)="submit()">
          <div class="form__head">
            <span class="r-eyebrow">Acceso</span>
            <h2 class="form__title">Iniciar sesión</h2>
          </div>

          @if (error()) {
            <p class="form__error" role="alert">{{ error() }}</p>
          }

          <label class="r-field">Email
            <input class="r-input" type="email" name="email" [(ngModel)]="email" required autocomplete="username" />
          </label>

          <label class="r-field">Contraseña
            <span class="password">
              <input class="r-input" [type]="showPassword() ? 'text' : 'password'" name="password" [(ngModel)]="password" required autocomplete="current-password" />
              <button type="button" class="password__toggle" (click)="showPassword.set(!showPassword())">{{ showPassword() ? 'Ocultar' : 'Ver' }}</button>
            </span>
          </label>

          <button type="submit" class="r-btn r-btn--red submit" [disabled]="loading()">{{ loading() ? 'Ingresando...' : 'Ingresar' }}</button>

          @if (googleClientId()) {
            <div class="divider"><span>o</span></div>
            <div class="google" #googleButton></div>
            <p class="google__hint">Sólo para cuentas ya cargadas como usuarios del panel.</p>
          }

          <a routerLink="/" class="back">← Volver al sitio</a>
        </form>
      </section>
    </div>
  `,
  styles: [`
    .login { min-height: 100vh; display: flex; flex-wrap: wrap; background: var(--r-paper); }

    .login__hero { flex: 1 1 480px; min-width: 0; background: var(--r-ink); color: #FFFFFF; padding: 40px 48px; display: flex; flex-direction: column; gap: 48px; position: relative; overflow: hidden; }
    .brand { display: flex; align-items: center; gap: 12px; color: #FFFFFF; text-decoration: none; position: relative; z-index: 1; }
    .brand:hover { color: #FFFFFF; }
    .brand__mark { width: 44px; height: 44px; background: var(--r-red); display: flex; align-items: center; justify-content: center; transform: skewX(-10deg); }
    .brand__icon { display: block; width: 44px; height: 44px; object-fit: contain; }
    .brand__name { font-family: var(--r-display); font-weight: 800; font-size: 30px; letter-spacing: 0.04em; line-height: 1; text-transform: uppercase; }
    .dot { color: var(--r-red); }
    .brand__sub { font-weight: 500; color: var(--r-grey); font-size: 22px; letter-spacing: 0.12em; }
    /* Centrado y un poco por encima de la mitad del panel. */
    .hero__copy { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 20px; position: relative; z-index: 1; max-width: 560px; margin: auto; transform: translateY(-8vh); }
    .hero__eyebrow { color: var(--r-red-soft); }
    .hero__title { margin: 0; font-family: var(--r-display); font-weight: 800; font-size: 76px; line-height: 0.92; text-transform: uppercase; }
    .hero__title span { color: var(--r-red); }
    .hero__text { margin: 0; font-size: 19px; line-height: 1.55; color: #CACACE; }
    .hero__slash { position: absolute; right: -120px; bottom: -40px; width: 300px; height: 70%; background: var(--r-red); transform: skewX(-12deg); opacity: 0.9; }

    .login__form-wrap { flex: 1 1 420px; min-width: 0; display: flex; align-items: center; justify-content: center; padding: 48px 24px; }
    .login__form { width: 100%; max-width: 420px; background: #FFFFFF; border: 1px solid var(--r-line); border-top: 4px solid var(--r-red); padding: 40px 36px; display: flex; flex-direction: column; gap: 20px; }
    .form__head { display: flex; flex-direction: column; gap: 6px; }
    .form__title { margin: 0; font-family: var(--r-display); font-weight: 800; font-size: 42px; line-height: 1; text-transform: uppercase; }
    .form__error { margin: 0; padding: 12px 14px; background: #FDE6E8; color: var(--r-red); font-weight: 600; border-left: 4px solid var(--r-red); }
    .password { position: relative; display: block; }
    .password .r-input { padding-right: 84px; }
    .password__toggle { position: absolute; right: 6px; top: 50%; transform: translateY(-50%); background: transparent; border: 0; padding: 8px 10px; font-family: var(--r-display); font-weight: 700; font-size: 14px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--r-muted); }
    .password__toggle:hover { color: var(--r-ink); }
    .submit { min-height: 52px; margin-top: 4px; }
    .back { align-self: center; font-weight: 600; font-size: 15px; }

    @media (max-width: 640px) {
      .login__hero { padding: 28px 20px; gap: 32px; }
      .hero__title { font-size: 52px; }
      .hero__copy { transform: none; }
      .login__form { padding: 32px 22px; }
    }
    .brand__logo { display: block; height: 52px; width: auto; max-width: 240px; object-fit: contain; }
    .divider { display: flex; align-items: center; gap: 12px; color: var(--r-muted); font-size: 14px; }
    .divider::before, .divider::after { content: ''; flex: 1; height: 1px; background: var(--r-line); }
    .google { display: flex; justify-content: center; min-height: 44px; }
    .google__hint { margin: -8px 0 0; text-align: center; font-size: 13px; color: var(--r-muted); }
  `],
})
export class LoginComponent implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);
  private zone = inject(NgZone);
  site = inject(SiteService);

  @ViewChild('googleButton') set googleButton(el: ElementRef<HTMLElement> | undefined) {
    if (el) this.renderGoogleButton(el.nativeElement);
  }

  email = '';
  password = '';
  loading = signal(false);
  showPassword = signal(false);
  error = signal<string | null>(null);
  googleClientId = signal<string | null>(null);

  ngOnInit(): void {
    this.site.load();
    // Como en SH: el botón sólo aparece si hay un ID de cliente de Google configurado.
    this.auth.loginConfig().subscribe({
      next: (cfg) => this.googleClientId.set(cfg.google_client_id),
      error: () => this.googleClientId.set(null),
    });
  }

  /** Carga Google Identity Services y dibuja el botón oficial "Iniciar sesión con Google". */
  private renderGoogleButton(container: HTMLElement): void {
    const clientId = this.googleClientId();
    if (!clientId) return;

    loadGoogleScript().then((google) => {
      google.accounts.id.initialize({
        client_id: clientId,
        callback: (response: { credential: string }) => this.zone.run(() => this.onGoogleCredential(response.credential)),
      });
      google.accounts.id.renderButton(container, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        shape: 'rectangular',
        text: 'signin_with',
        locale: 'es',
        width: Math.min(container.clientWidth || 340, 400),
      });
    }).catch(() => this.error.set('No se pudo cargar el inicio de sesión con Google.'));
  }

  private onGoogleCredential(credential: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.auth.loginWithGoogle(credential).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.afterLogin(res.user.must_change_password);
      },
      error: (e) => {
        this.loading.set(false);
        this.error.set(e?.error?.message || 'No se pudo iniciar sesión con Google.');
      },
    });
  }

  private afterLogin(mustChangePassword: boolean): void {
    // Igual que en SH: si tiene que cambiar la contraseña, va primero a su perfil.
    if (mustChangePassword || !this.auth.can('dashboard.view')) {
      this.router.navigate(['/admin/perfil']);
    } else {
      this.router.navigate(['/admin']);
    }
  }

  submit(): void {
    if (!this.email || !this.password) {
      this.error.set('Completá email y contraseña.');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.auth.login(this.email, this.password).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.afterLogin(res.user.must_change_password);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Credenciales inválidas o sin acceso al panel.');
      },
    });
  }
}
