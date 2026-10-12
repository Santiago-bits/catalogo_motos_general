# Catálogo Motos

Catálogo web de motos 0 km, usadas, cascos y repuestos, con panel de administración.
Las consultas de los clientes se hacen por WhatsApp.

## Stack

- **Backend:** Laravel 13 (API REST + Sanctum) — [`backend/`](backend/)
- **Frontend:** Angular 18 (sitio público + panel en `/admin`) — [`frontend/`](frontend/)
- **Base de datos:** MySQL
- **Deploy:** paquete para Hostinger — [`deploy/`](deploy/)

## Desarrollo local (XAMPP)

### 1. Base de datos

```sql
CREATE DATABASE IF NOT EXISTS catalogo_motos CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 2. Backend

```bash
cd backend
cp .env.example .env        # completar DB_* (XAMPP: root sin contraseña)
composer install
php artisan key:generate
php artisan migrate --seed
php artisan storage:link
php artisan serve
```

La API queda en `http://127.0.0.1:8000/api`.

### 3. Frontend

```bash
cd frontend
npm install
npm start
```

El sitio queda en `http://localhost:4200` y el panel en `http://localhost:4200/admin`.

## Publicar en Hostinger (se actualiza solo con git)

Cada push a `main` dispara la GitHub Action [`deploy.yml`](.github/workflows/deploy.yml): compila
el sitio Angular, instala el backend sin dependencias de desarrollo y publica el resultado en la
rama **`produccion`**. Hostinger clona esa rama dentro de `public_html` y se actualiza solo.

```
public_html/                 (rama produccion)
├── index.html, *.js, *.css  sitio Angular
├── index.php, .htaccess     /api va a Laravel, el resto al sitio
├── laravel/                 backend (bloqueado desde la web)
│   └── .env                 sólo en el servidor, git no lo toca
└── storage/                 imágenes subidas desde el panel, git no lo toca
```

### Primera vez

**1. En la PC** — generar el `.env`, la base y las imágenes:

```powershell
powershell -ExecutionPolicy Bypass -File deploy\preparar-servidor.ps1 -DbName u404079745_motos -DbUser u404079745_motos
```

Deja en `deploy/out/`: `.env`, `database.sql` y `storage.zip`.

**2. En hPanel:**

1. **PHP:** *Avanzado → Configuración de PHP* → PHP **8.4**.
   En *Opciones de PHP* subir `upload_max_filesize` y `post_max_size` (ej. 64M).
2. **Base de datos:** en phpMyAdmin de la base creada → *Importar* → `database.sql`.
3. **Vaciar `public_html`** desde el *Administrador de archivos* (Git necesita la carpeta vacía).
4. **Git:** *Avanzado → Git* → repositorio `https://github.com/Santiago-bits/catalogo_motos_general.git`,
   rama **`produccion`**, directorio vacío (= `public_html`) → *Crear* y después *Implementar*.
5. **Implementación automática:** en la misma pantalla activarla y copiar la URL del webhook.
   En GitHub: *Settings → Webhooks → Add webhook* → pegar la URL → *Add webhook*.
6. **Archivos del servidor** (Administrador de archivos):
   - subir `.env` a `public_html/laravel/` y completar `DB_PASSWORD`;
   - subir `storage.zip` a `public_html/` y descomprimirlo (queda `public_html/storage/`).
7. **SSL:** *Seguridad → SSL* (el `.htaccess` fuerza HTTPS).

Entrar a `https://tu-dominio.com/admin` y cambiar la contraseña del administrador desde el perfil.

### Después

`git push` a `main` y listo: en 2-3 minutos la Action actualiza `produccion` y Hostinger la baja.
El avance se ve en la pestaña *Actions* del repo.

Si un cambio trae migraciones nuevas, correrlas una vez por SSH:
`cd public_html/laravel && php artisan migrate --force`.

### Login con Google

Cargar el *Client ID* en el panel (*Configuración → Acceso*) y en Google Cloud Console agregar
`https://tu-dominio.com` como origen autorizado de JavaScript.
