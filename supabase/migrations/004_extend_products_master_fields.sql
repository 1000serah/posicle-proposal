-- =============================================================
-- Migration 004: products 테이블 마스터 필드 확장
-- 실행: Supabase 대시보드 > SQL Editor에 붙여넣기 후 실행
-- 안전: ADD COLUMN IF NOT EXISTS + CREATE INDEX IF NOT EXISTS
--       중복 실행해도 오류 없음
-- =============================================================

-- 식별 정보
alter table products
  add column if not exists sku_code         text,
  add column if not exists old_sku_code     text,
  add column if not exists barcode          text,
  add column if not exists hs_code          text;

-- 제품명
alter table products
  add column if not exists product_name_kr  text;

-- 분류
alter table products
  add column if not exists product_type     text not null default 'Live';

-- MOQ (숫자)
alter table products
  add column if not exists moq_quantity     numeric(12,2);

-- 물류 정보
alter table products
  add column if not exists unit_spec        text,
  add column if not exists pcs_per_carton   numeric(12,2),
  add column if not exists outbox_weight_kg numeric(12,2),
  add column if not exists outbox_size_mm   text,
  add column if not exists cbm              numeric(12,4);

-- sku_code unique index (중복 SKU 방지)
create unique index if not exists idx_products_sku_code_unique
  on products (sku_code)
  where sku_code is not null;  -- null은 unique 제외 (미입력 허용)
