-- =============================================================
-- Migration 002: brands 테이블에 is_active 컬럼 추가
-- 이유: 실제 delete 대신 비활성화로 브랜드를 숨김 처리
-- 실행: Supabase 대시보드 > SQL Editor에 붙여넣기 후 실행
-- 안전: ADD COLUMN IF NOT EXISTS — 중복 실행해도 오류 없음
-- =============================================================

alter table brands
  add column if not exists is_active boolean not null default true;
