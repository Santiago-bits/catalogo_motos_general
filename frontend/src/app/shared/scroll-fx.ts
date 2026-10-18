import { Directive, ElementRef, OnDestroy, OnInit, effect, inject, input } from '@angular/core';

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
