-- =============================================================
-- Migration 003: brands 테이블 RLS 정책 추가
-- 대상: brands
-- 허용: 로그인한 사용자(authenticated) → SELECT / INSERT / UPDATE
-- 차단: DELETE (앱에서 삭제 대신 is_active = false로 처리)
-- 실행: Supabase 대시보드 > SQL Editor에 붙여넣기 후 실행
-- 안전: DROP POLICY IF EXISTS 후 CREATE — 중복 실행해도 오류 없음
-- =============================================================

-- RLS 활성화 (이미 켜져 있어도 오류 없음)
alter table brands enable row level security;

-- 기존 정책 제거 (중복 실행 안전 처리)
drop policy if exists "brands_select_authenticated" on brands;
drop policy if exists "brands_insert_authenticated" on brands;
drop policy if exists "brands_update_authenticated" on brands;

-- SELECT: 로그인한 사용자는 모든 브랜드 조회 가능
create policy "brands_select_authenticated"
  on brands for select
  to authenticated
  using (true);

-- INSERT: 로그인한 사용자는 브랜드 등록 가능
create policy "brands_insert_authenticated"
  on brands for insert
  to authenticated
  with check (true);

-- UPDATE: 로그인한 사용자는 브랜드 수정 가능 (숨기기/재활성화 포함)
create policy "brands_update_authenticated"
  on brands for update
  to authenticated
  using (true)
  with check (true);

-- DELETE: 정책 없음 → 차단 (앱에서 is_active = false로 대체)
