-- =============================================================
-- Migration 005: products 테이블 RLS 정책 추가
-- 실행: Supabase 대시보드 > SQL Editor에 붙여넣기 후 실행
-- 안전: DROP POLICY IF EXISTS + CREATE POLICY
--       중복 실행해도 오류 없음
-- =============================================================

-- RLS 활성화
alter table products enable row level security;

-- 기존 정책 삭제 (중복 방지)
drop policy if exists "authenticated users can select products" on products;
drop policy if exists "authenticated users can insert products" on products;
drop policy if exists "authenticated users can update products" on products;

-- SELECT: 로그인한 사용자만 조회
create policy "authenticated users can select products"
  on products for select
  to authenticated
  using (true);

-- INSERT: 로그인한 사용자만 등록
create policy "authenticated users can insert products"
  on products for insert
  to authenticated
  with check (true);

-- UPDATE: 로그인한 사용자만 수정 (soft-delete 포함)
create policy "authenticated users can update products"
  on products for update
  to authenticated
  using (true)
  with check (true);

-- DELETE 정책 없음 (is_active=false soft-delete 방식 사용)
