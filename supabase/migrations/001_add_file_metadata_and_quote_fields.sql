-- =============================================================
-- Migration 001: 파일 메타데이터 + 견적 항목 필드 추가
-- 대상: product_files, send_log_files, proposal_items
-- 실행: Supabase 대시보드 > SQL Editor에 붙여넣기 후 실행
-- 안전: ADD COLUMN IF NOT EXISTS — 중복 실행해도 오류 없음
-- =============================================================


-- -------------------------------------------------------------
-- A. product_files — 파일 메타데이터 컬럼 추가
-- -------------------------------------------------------------
alter table product_files
  add column if not exists file_stage     text,
  add column if not exists language       text,
  add column if not exists version_label  text,
  add column if not exists is_current     boolean not null default true,
  add column if not exists source         text;


-- -------------------------------------------------------------
-- B. send_log_files — 파일 메타데이터 컬럼 추가
-- -------------------------------------------------------------
alter table send_log_files
  add column if not exists file_stage     text,
  add column if not exists language       text,
  add column if not exists version_label  text,
  add column if not exists is_current     boolean not null default true,
  add column if not exists source         text;


-- -------------------------------------------------------------
-- C. proposal_items — 거래조건 + 수량/총액 컬럼 추가
-- -------------------------------------------------------------
alter table proposal_items
  add column if not exists supplier_incoterm  text,
  add column if not exists buyer_incoterm     text,
  add column if not exists cost_notes         text,
  add column if not exists quantity           numeric(12,2),
  add column if not exists total_price        numeric(14,2);
