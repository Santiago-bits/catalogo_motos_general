import { Component, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { FooterComponent } from './shared/layout/footer.component';
import { NavbarComponent } from './shared/layout/navbar.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, FooterComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  title = 'Catálogo Motos';
  isAdminRoute = signal(false);

  constructor(router: Router) {
    router.events.pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd)).subscribe((event) => {
      this.isAdminRoute.set(event.urlAfterRedirects.startsWith('/admin'));
    });
  }
}
