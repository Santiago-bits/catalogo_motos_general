import { Component, Directive, ElementRef, OnDestroy, OnInit, effect, inject, input } from '@angular/core';
import { MotoIconComponent } from './moto-icon.component';

const reduceMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const canObserve = () => typeof IntersectionObserver === 'function';

/**
 * Aparición al bajar: el bloque entra subiendo cuando llega a la pantalla.
 * Con appReveal="stagger" son los hijos los que aparecen uno detrás de otro (tarjetas en cascada).
 */
@Directive({ selector: '[appReveal]', standalone: true })
export class RevealDirective implements OnInit, OnDestroy {
  appReveal = input<'' | 'stagger'>('');
  private el: HTMLElement = inject(ElementRef).nativeElement;
  private io?: IntersectionObserver;

  ngOnInit(): void {
    if (!canObserve()) return;
    // Sin JavaScript o sin IntersectionObserver todo queda visible: el estado oculto depende de html.anim.
    document.documentElement.classList.add('anim');
    const stagger = this.appReveal() === 'stagger';
    this.el.classList.add(stagger ? 'stagger' : 'reveal');
    this.io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      if (stagger) Array.from(this.el.children).forEach((c, i) => (c as HTMLElement).style.setProperty('--i', String(Math.min(i, 8))));
      this.el.classList.add('is-in');
      this.io?.disconnect();
      // Terminada la entrada se quitan las clases, así los hover y transiciones propias vuelven a mandar.
      setTimeout(() => this.el.classList.remove('reveal', 'stagger', 'is-in'), 1900);
    }, { threshold: 0, rootMargin: '0px 0px -12% 0px' });
    this.io.observe(this.el);
  }

  ngOnDestroy(): void {
    this.io?.disconnect();
  }
}

/** Números que cuentan: muestra el valor y, la primera vez que aparece, sube desde cero. */
@Directive({ selector: '[appCountUp]', standalone: true })
export class CountUpDirective implements OnDestroy {
  appCountUp = input.required<number>();
  suffix = input('');
  private el: HTMLElement = inject(ElementRef).nativeElement;
  private io?: IntersectionObserver;
  private done = false;

  constructor() {
    effect(() => {
      const end = this.appCountUp();
      this.el.textContent = this.format(end);
      if (this.done || reduceMotion() || !canObserve()) return;
      this.io?.disconnect();
      this.io = new IntersectionObserver((entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        this.io?.disconnect();
        this.done = true;
        this.animate(end);
      }, { threshold: 0.6 });
      this.io.observe(this.el);
    });
  }

  private animate(end: number): void {
    let t0 = 0;
    const step = (t: number) => {
      if (!t0) t0 = t;
      const p = Math.min((t - t0) / 1400, 1);
      const value = Math.round(end * (1 - Math.pow(1 - p, 3)));
      this.el.textContent = p === 1 ? this.format(end) : value.toLocaleString('es-AR');
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  private format(n: number): string {
    return n.toLocaleString('es-AR') + this.suffix();
  }

  ngOnDestroy(): void {
    this.io?.disconnect();
  }
}

/** Se mueve a otra velocidad que el scroll (efecto de profundidad); con fade además se desvanece al subir. */
@Directive({ selector: '[appParallax]', standalone: true })
export class ParallaxDirective implements OnInit, OnDestroy {
  appParallax = input(0.3);
  fade = input(false);
  private el: HTMLElement = inject(ElementRef).nativeElement;
  private ticking = false;
  private onScroll = () => {
    if (this.ticking) return;
    this.ticking = true;
    requestAnimationFrame(() => {
      this.ticking = false;
      this.update();
    });
  };

  ngOnInit(): void {
    if (reduceMotion()) return;
    window.addEventListener('scroll', this.onScroll, { passive: true });
    this.update();
  }

  private update(): void {
    const y = window.scrollY;
    // Sólo mientras el bloque puede estar a la vista (los encabezados están arriba de todo).
    if (y > window.innerHeight * 1.5) return;
    this.el.style.transform = `translate3d(0, ${y * this.appParallax()}px, 0)`;
    if (this.fade()) this.el.style.opacity = String(Math.max(0.15, 1 - y / 500));
  }

  ngOnDestroy(): void {
    window.removeEventListener('scroll', this.onScroll);
  }
}

/** Moto de avance: una línea roja debajo del menú que la motito recorre mientras se baja la página. */
@Component({
  selector: 'app-scroll-ride',
  standalone: true,
  imports: [MotoIconComponent],
  template: `
    <div class="ride__fill"></div>
    <span class="ride__moto"><app-moto-icon width="34" height="20" color="#FFFFFF" [strokeWidth]="7" [detailed]="false" /></span>
  `,
  styles: [`
    :host { position: fixed; left: 0; right: 0; top: 0; height: 3px; z-index: 21; pointer-events: none; }
    .ride__fill { position: absolute; inset: 0; background: var(--r-red); transform-origin: left center; transform: scaleX(var(--p, 0)); }
    .ride__moto { position: absolute; bottom: 3px; left: calc(var(--p, 0) * (100% - 34px)); width: 34px; height: 20px; display: block; line-height: 0; }
    @media (prefers-reduced-motion: reduce) { :host { display: none; } }
  `],
  host: { 'aria-hidden': 'true' },
})
export class ScrollRideComponent implements OnInit, OnDestroy {
  private el: HTMLElement = inject(ElementRef).nativeElement;
  private ticking = false;
  private onScroll = () => {
    if (this.ticking) return;
    this.ticking = true;
    requestAnimationFrame(() => {
      this.ticking = false;
      this.update();
    });
  };
  private resizeObserver?: ResizeObserver;

  ngOnInit(): void {
    if (reduceMotion()) return;
    window.addEventListener('scroll', this.onScroll, { passive: true });
    window.addEventListener('resize', this.onScroll);
    // Al cambiar de página o cargar datos cambia el alto: se recalcula sin esperar al scroll.
    if (typeof ResizeObserver === 'function') {
      this.resizeObserver = new ResizeObserver(this.onScroll);
      this.resizeObserver.observe(document.body);
    }
    this.update();
  }

  private update(): void {
    const header = document.querySelector<HTMLElement>('app-navbar .header');
    this.el.style.top = `${Math.max(0, header?.getBoundingClientRect().bottom ?? 0)}px`;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    this.el.style.setProperty('--p', String(max > 0 ? Math.min(window.scrollY / max, 1) : 0));
  }

  ngOnDestroy(): void {
    window.removeEventListener('scroll', this.onScroll);
    window.removeEventListener('resize', this.onScroll);
    this.resizeObserver?.disconnect();
  }
}
