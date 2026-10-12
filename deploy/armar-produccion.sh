#!/usr/bin/env bash
# Arma en $1 (por defecto build/) el contenido de public_html para Hostinger:
# sitio Angular compilado + index.php/.htaccess + laravel/ con vendor de producción.
# Requiere el build de Angular ya hecho (frontend/dist/frontend/browser).
# Lo usa .github/workflows/deploy.yml, que después lo publica en la rama "produccion".
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-$ROOT/build}"
BROWSER="$ROOT/frontend/dist/frontend/browser"

[ -f "$BROWSER/index.html" ] || { echo "Falta el build del sitio en $BROWSER" >&2; exit 1; }

# Se vacía todo menos .git (la carpeta puede ser un worktree de la rama produccion).
mkdir -p "$OUT"
find "$OUT" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +

# Sitio y ruteo
cp -r "$BROWSER"/. "$OUT"/
cp "$ROOT/backend/public/robots.txt" "$OUT"/
cp "$ROOT/deploy/hostinger/index.php" "$ROOT/deploy/hostinger/.htaccess" "$ROOT/deploy/hostinger/.gitignore" "$OUT"/

# Backend
rsync -a \
  --exclude '/vendor/' --exclude '/node_modules/' --exclude '/tests/' --exclude '/public/' \
  --exclude '/.env' --exclude '/.env.*' --exclude '/*.md' --exclude '/.gitignore' \
  --exclude '/storage/logs/*.log' --exclude '/bootstrap/cache/*.php' \
  "$ROOT/backend/" "$OUT/laravel/"
cp "$ROOT/deploy/hostinger/laravel.htaccess" "$OUT/laravel/.htaccess"

(cd "$OUT/laravel" && composer install --no-dev --optimize-autoloader --no-interaction --no-progress)

# El manifiesto de paquetes generado por composer viaja con el deploy.
rm -f "$OUT/laravel/bootstrap/cache/.gitignore"

echo "public_html armado en $OUT"
