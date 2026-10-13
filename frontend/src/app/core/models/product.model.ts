export type ProductType = 'moto' | 'casco' | 'repuesto';

export interface BrandRef {
  id: number;
  name: string;
  slug: string;
  logo_path?: string | null;
}

export interface CategoryRef {
  id: number;
  name: string;
  slug: string;
  image_path?: string | null;
}

export interface ProductImage {
  id?: number;
  path: string;
  thumb_path: string | null;
  alt: string | null;
  is_main: boolean;
}

export interface TagRef {
  id: number;
  name: string;
  slug: string;
}

export interface ProductSpec {
  feature: string;
  unit: string | null;
  value: string | number;
}

export interface ProductPrice {
  final: number;
  offer: number | null;
  currency: string;
  visible: boolean;
  is_offer: boolean;
}

export interface Product {
  id: number;
  type: ProductType;
  code: string;
  name: string;
  slug: string;
  brand?: BrandRef;
  category?: CategoryRef;
  short_description: string | null;
  description: string | null;
  price: ProductPrice;
  availability: string;
  featured: boolean;
  is_new: boolean;
  images?: ProductImage[];
  tags?: TagRef[];
  specs?: ProductSpec[];
  moto?: Record<string, unknown>;
  casco?: Record<string, unknown>;
  repuesto?: Record<string, unknown>;
  /** Motos con las que va el repuesto (sólo en la ficha). */
  compatibility?: string[];
  public_videos?: { title: string | null; url: string; is_file: boolean }[];
  public_documents?: { title: string; kind: string; url: string }[];
  views: number;
  created_at: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  links: {
    first: string | null;
    last: string | null;
    prev: string | null;
    next: string | null;
  };
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

export interface CatalogFilters {
  condicion?: 'nueva' | 'usada';
  marca?: string;
  categoria?: string;
  precio_min?: number;
  precio_max?: number;
  ofertas?: boolean;
  orden?: 'recientes' | 'precio_asc' | 'precio_desc' | 'nombre';
  por_pagina?: number;
  page?: number;
}
