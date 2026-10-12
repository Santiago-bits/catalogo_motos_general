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

## Publicar en Hostinger

En Hostinger el sitio y la API quedan en el mismo dominio:

```
domains/tu-dominio.com/
├── laravel/       backend (fuera del alcance de la web)
└── public_html/   sitio Angular + index.php + .htaccess + imágenes (storage/)
```

`public_html/.htaccess` manda `/api/*` a Laravel y el resto de las rutas al sitio Angular.
Las imágenes que se suben desde el panel se guardan directo en `public_html/storage`
(variable `PUBLIC_PATH`), así que no hace falta `storage:link`.

### 1. Armar el paquete (en la PC)

```powershell
powershell -ExecutionPolicy Bypass -File deploy\build-hostinger.ps1 -Url https://tu-dominio.com
```

Deja en `deploy/out/`:

| Archivo | Qué es |
|---|---|
| `hostinger.zip` | carpetas `laravel/` y `public_html/` listas para subir |
| `database.sql` | copia de la base local, con las URLs de imágenes ya apuntando al dominio |

Opciones: `-SkipDatabase` (no exporta la base) y `-SkipFrontend` (usa el último build de Angular).

### 2. En hPanel

1. **PHP:** en *Avanzado → Configuración de PHP* elegir PHP **8.3 o superior**.
   En *Opciones de PHP* subir `upload_max_filesize` y `post_max_size` (ej. 64M) para manuales y videos.
2. **Base de datos:** en *Bases de datos → MySQL* crear base y usuario, y en phpMyAdmin importar `database.sql`.
3. **Archivos:** en el *Administrador de archivos* abrir `domains/tu-dominio.com/`, borrar el contenido
   de `public_html` (el `default.php` de Hostinger), subir `hostinger.zip` y descomprimirlo ahí.
4. **Configuración:** editar `laravel/.env` y completar `DB_DATABASE`, `DB_USERNAME` y `DB_PASSWORD`.
   `APP_URL` y `APP_KEY` ya vienen cargados por el script.
5. **SSL:** activar el certificado en *Seguridad → SSL* (el `.htaccess` fuerza HTTPS).

Entrar a `https://tu-dominio.com/admin` y cambiar la contraseña del administrador desde el perfil.

### Actualizar el sitio

Volver a correr el script con `-SkipDatabase` y subir solo lo que cambió:

- Cambios en el sitio/panel → reemplazar los archivos de `public_html` **sin borrar `public_html/storage`**.
- Cambios en el backend → reemplazar `laravel/` **sin pisar `laravel/.env` ni `laravel/storage`**.
- Si hay migraciones nuevas, por SSH: `cd domains/tu-dominio.com/laravel && php artisan migrate --force`.

### Login con Google

Cargar el *Client ID* en el panel (*Configuración → Acceso*) y en Google Cloud Console agregar
`https://tu-dominio.com` como origen autorizado de JavaScript.
