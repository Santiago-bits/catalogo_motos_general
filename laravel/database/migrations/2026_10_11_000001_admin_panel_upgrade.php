<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Panel administrativo con las mecánicas del panel de SH Servicios:
 * roles y permisos, documentos y videos por producto, gestión de
 * consultas (asignado / nota interna) y auditoría con detalle de cambios.
 */
return new class extends Migration
{
    /** Permisos del panel: clave => [módulo, etiqueta]. */
    public const PERMISSIONS = [
        'dashboard.view' => ['General', 'Ver el inicio del panel'],
        'products.view' => ['Catálogo', 'Ver productos'],
        'products.create' => ['Catálogo', 'Cargar productos'],
        'products.edit' => ['Catálogo', 'Editar productos'],
        'products.delete' => ['Catálogo', 'Eliminar productos'],
        'categories.manage' => ['Catálogo', 'Administrar categorías'],
        'brands.manage' => ['Catálogo', 'Administrar marcas'],
        'tags.manage' => ['Catálogo', 'Administrar etiquetas'],
        'features.manage' => ['Catálogo', 'Administrar características'],
        'services.manage' => ['Catálogo', 'Administrar servicios'],
        'inquiries.view' => ['Gestión', 'Ver consultas'],
        'inquiries.manage' => ['Gestión', 'Responder y eliminar consultas'],
        'quotes.view' => ['Gestión', 'Ver cotizaciones'],
        'quotes.manage' => ['Gestión', 'Gestionar cotizaciones'],
        'data.import' => ['Gestión', 'Importar productos'],
        'data.export' => ['Gestión', 'Exportar datos'],
        'settings.manage' => ['Gestión', 'Cambiar la configuración'],
        'users.view' => ['Seguridad', 'Ver usuarios'],
        'users.manage' => ['Seguridad', 'Crear y editar usuarios'],
        'roles.manage' => ['Seguridad', 'Administrar roles'],
        'audit.view' => ['Seguridad', 'Ver la auditoría'],
    ];

    public function up(): void
    {
        Schema::create('roles', function (Blueprint $table) {
            $table->id();
            $table->string('name', 60);
            $table->string('slug', 60)->unique();
            $table->string('description')->nullable();
            $table->boolean('is_system')->default(false);
            $table->boolean('active')->default(true);
            $table->timestamps();
        });

        Schema::create('permissions', function (Blueprint $table) {
            $table->id();
            $table->string('key', 60)->unique();
            $table->string('module', 60);
            $table->string('label', 120);
            $table->unsignedSmallInteger('sort_order')->default(0);
        });

        Schema::create('permission_role', function (Blueprint $table) {
            $table->foreignId('role_id')->constrained()->cascadeOnDelete();
            $table->foreignId('permission_id')->constrained()->cascadeOnDelete();
            $table->primary(['role_id', 'permission_id']);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('role_id')->nullable()->after('role')->constrained()->nullOnDelete();
            $table->string('phone', 40)->nullable()->after('email');
            $table->string('position', 120)->nullable()->after('phone');
            $table->boolean('must_change_password')->default(false)->after('active');
            $table->timestamp('last_login_at')->nullable()->after('must_change_password');
        });

        // Estados de consulta como en SH: nueva → en proceso → respondida → cerrada.
        DB::statement("ALTER TABLE inquiries MODIFY status ENUM('nueva','contactado','en_proceso','respondida','cerrada') NOT NULL DEFAULT 'nueva'");
        DB::table('inquiries')->where('status', 'contactado')->update(['status' => 'respondida']);
        DB::statement("ALTER TABLE inquiries MODIFY status ENUM('nueva','en_proceso','respondida','cerrada') NOT NULL DEFAULT 'nueva'");

        Schema::table('inquiries', function (Blueprint $table) {
            $table->foreignId('assigned_to')->nullable()->after('source')->constrained('users')->nullOnDelete();
            $table->text('internal_note')->nullable()->after('assigned_to');
            $table->timestamp('replied_at')->nullable()->after('internal_note');
        });

        Schema::table('activity_logs', function (Blueprint $table) {
            $table->string('module', 40)->nullable()->after('action');
            $table->json('changes')->nullable()->after('description');
            $table->string('ip', 45)->nullable()->after('changes');
            $table->index('module');
            $table->index('action');
        });

        Schema::table('tags', function (Blueprint $table) {
            $table->string('color', 20)->default('red')->after('slug');
        });

        Schema::table('services', function (Blueprint $table) {
            $table->string('image_path')->nullable()->after('icon');
        });

        Schema::create('product_documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->string('title', 160);
            $table->string('kind', 30)->default('ficha');
            $table->string('path');
            $table->string('original_name')->nullable();
            $table->unsignedInteger('size')->nullable();
            $table->boolean('is_public')->default(true);
            $table->timestamps();
        });

        Schema::create('product_videos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->string('title', 160)->nullable();
            $table->string('url')->nullable();
            $table->string('path')->nullable();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
        });

        $this->seedRoles();
    }

    private function seedRoles(): void
    {
        $now = now();
        $order = 0;
        foreach (self::PERMISSIONS as $key => [$module, $label]) {
            DB::table('permissions')->insert(['key' => $key, 'module' => $module, 'label' => $label, 'sort_order' => $order++]);
        }

        $adminId = DB::table('roles')->insertGetId([
            'name' => 'Administrador', 'slug' => 'admin', 'is_system' => true, 'active' => true,
            'description' => 'Acceso total al panel.', 'created_at' => $now, 'updated_at' => $now,
        ]);
        $editorId = DB::table('roles')->insertGetId([
            'name' => 'Editor', 'slug' => 'editor', 'is_system' => false, 'active' => true,
            'description' => 'Carga y edita el catálogo y responde consultas.', 'created_at' => $now, 'updated_at' => $now,
        ]);
        $sellerId = DB::table('roles')->insertGetId([
            'name' => 'Vendedor', 'slug' => 'vendedor', 'is_system' => false, 'active' => true,
            'description' => 'Ve el catálogo y gestiona consultas y cotizaciones.', 'created_at' => $now, 'updated_at' => $now,
        ]);

        $ids = DB::table('permissions')->pluck('id', 'key');
        $grant = function (int $roleId, array $keys) use ($ids) {
            foreach ($keys as $key) {
                DB::table('permission_role')->insert(['role_id' => $roleId, 'permission_id' => $ids[$key]]);
            }
        };

        $grant($adminId, array_keys(self::PERMISSIONS));
        $grant($editorId, [
            'dashboard.view', 'products.view', 'products.create', 'products.edit', 'products.delete',
            'categories.manage', 'brands.manage', 'tags.manage', 'features.manage', 'services.manage',
            'inquiries.view', 'inquiries.manage', 'quotes.view', 'quotes.manage', 'data.import', 'data.export',
        ]);
        $grant($sellerId, ['dashboard.view', 'products.view', 'inquiries.view', 'inquiries.manage', 'quotes.view', 'quotes.manage', 'data.export']);

        DB::table('users')->where('role', 'admin')->update(['role_id' => $adminId]);
        DB::table('users')->where('role', 'editor')->update(['role_id' => $editorId]);
    }

    public function down(): void
    {
        Schema::dropIfExists('product_videos');
        Schema::dropIfExists('product_documents');

        Schema::table('services', fn (Blueprint $table) => $table->dropColumn('image_path'));
        Schema::table('tags', fn (Blueprint $table) => $table->dropColumn('color'));

        Schema::table('activity_logs', function (Blueprint $table) {
            $table->dropIndex(['module']);
            $table->dropIndex(['action']);
            $table->dropColumn(['module', 'changes', 'ip']);
        });

        Schema::table('inquiries', function (Blueprint $table) {
            $table->dropConstrainedForeignId('assigned_to');
            $table->dropColumn(['internal_note', 'replied_at']);
        });
        DB::statement("ALTER TABLE inquiries MODIFY status ENUM('nueva','contactado','en_proceso','respondida','cerrada') NOT NULL DEFAULT 'nueva'");
        DB::table('inquiries')->whereIn('status', ['en_proceso', 'respondida'])->update(['status' => 'contactado']);
        DB::statement("ALTER TABLE inquiries MODIFY status ENUM('nueva','contactado','cerrada') NOT NULL DEFAULT 'nueva'");

        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('role_id');
            $table->dropColumn(['phone', 'position', 'must_change_password', 'last_login_at']);
        });

        Schema::dropIfExists('permission_role');
        Schema::dropIfExists('permissions');
        Schema::dropIfExists('roles');
    }
};
