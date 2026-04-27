-- =============================================================
-- Posicle Proposal — Supabase PostgreSQL Schema (MVP)
-- 기준: docs/database-schema.md
-- 실행: Supabase 대시보드 > SQL Editor에 전체 복사 후 실행
-- =============================================================

-- UUID 확장 활성화
create extension if not exists "uuid-ossp";

-- updated_at 자동 갱신 트리거 함수
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;


-- =============================================================
-- 1. brands (브랜드/공급사)
-- =============================================================
create table brands (
  id            uuid        primary key default uuid_generate_v4(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid,                         -- 나중에 auth.users.id와 연결

  brand_name     text        not null,
  supplier_name  text,
  country        text        not null default 'Korea',
  category       text,       -- 선택식: Skincare, Makeup, Haircare, Bodycare, Food,
                             --         Health Supplement, Kids, Clinic / Aesthetic, Lifestyle, Other
  contact_person text,
  contact_info   text,
  is_active      boolean     not null default true,
  file_links     jsonb       not null default '[]', -- [{"name":"브랜드소개서","url":"https://..."}]
  notes          text
);

create trigger trg_brands_updated_at
  before update on brands
  for each row execute function update_updated_at();


-- =============================================================
-- 2. products (제품)
-- =============================================================
create table products (
  id                   uuid          primary key default uuid_generate_v4(),
  created_at           timestamptz   not null default now(),
  updated_at           timestamptz   not null default now(),
  created_by           uuid,

  brand_id             uuid          references brands(id) on delete set null,
  product_name         text          not null,
  category             text,
  positioning          text,         -- 주요 효능/포지션
  supply_price         numeric(12,2),
  currency             text          not null default 'USD',
  moq                  text,         -- 최소 주문 수량 (예: "300ea", "1 carton")
  lead_time            text,         -- 리드타임 (예: "30일")
  certifications       jsonb         not null default '[]',
                                     -- [{"type":"CPNP","status":"완료"},{"type":"FDA","status":"진행중"}]
                                     -- type 추천: CPNP, CPSR, FDA, TFDA, HALAL, ISO, 기타
                                     -- status 추천: 없음, 진행중, 완료
  has_ingredient_list  boolean       not null default false,
  has_regulatory_docs  boolean       not null default false,
  is_active            boolean       not null default true,
  notes                text
);

create trigger trg_products_updated_at
  before update on products
  for each row execute function update_updated_at();


-- =============================================================
-- 3. product_files (제품 자료 링크)
-- =============================================================
create table product_files (
  id          uuid        primary key default uuid_generate_v4(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid,

  product_id     uuid        not null references products(id) on delete cascade,
  file_type      text,       -- 추천: 브랜드소개서, 제품소개서, 가격표, 성분표, 인증자료,
                             --       수권서, 상표, 디자인자료, 패키지/칼선, 기타
  file_stage     text,       -- 추천: supplier_original, internal_working, buyer_sent, final
  language       text,       -- 추천: KR, EN, TC, CN, JP, 기타
  version_label  text,       -- 자유 입력: v1, v2, 2026-04 등
  is_current     boolean     not null default true,
  source         text,       -- 추천: supplier, posicle, buyer, agency, other
  file_name      text,
  file_url       text        not null,
  notes          text
);

create trigger trg_product_files_updated_at
  before update on product_files
  for each row execute function update_updated_at();


-- =============================================================
-- 4. buyers (바이어)
-- =============================================================
create table buyers (
  id                   uuid        primary key default uuid_generate_v4(),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  created_by           uuid,

  company_name         text        not null,
  country              text,
  contact_person       text,
  email                text,
  whatsapp             text,
  line_id              text,
  alibaba_url          text,
  interest_categories  jsonb       not null default '[]', -- ["스킨케어","선케어"]
  price_range          text,       -- 예: "USD 3~10", "저가 대량"
  channel_type         text,       -- 추천: 리테일, 이커머스, 라이브커머스, 총판, 클리닉, 에스테틱, 기타
  notes                text
);

create trigger trg_buyers_updated_at
  before update on buyers
  for each row execute function update_updated_at();


-- =============================================================
-- 5. proposals (견적 헤더)
-- =============================================================
create table proposals (
  id          uuid        primary key default uuid_generate_v4(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid,

  buyer_id    uuid        not null references buyers(id) on delete restrict,
  title       text,       -- 예: "대만 A사 미백 앰플 견적 2025-04"
  currency    text        not null default 'USD',
  status      text        not null default '초안',
                          -- 추천: 초안, 발송완료, 검토중, 협의중, 성사, 보류, 취소
  notes       text
);

create trigger trg_proposals_updated_at
  before update on proposals
  for each row execute function update_updated_at();


-- =============================================================
-- 6. proposal_items (견적 항목 — 가격 스냅샷 포함)
-- =============================================================
-- 가격 스냅샷: 나중에 공급가가 바뀌어도 이 견적의 금액은 그대로 유지됨
create table proposal_items (
  id                     uuid          primary key default uuid_generate_v4(),
  created_at             timestamptz   not null default now(),
  updated_at             timestamptz   not null default now(),
  created_by             uuid,

  proposal_id            uuid          not null references proposals(id) on delete cascade,
  product_id             uuid          references products(id) on delete set null,
                                       -- 제품 삭제되어도 견적 기록은 유지 (set null)

  -- 가격 스냅샷 (견적 생성 당시 값)
  product_name_snapshot  text          not null,
  supply_price_snapshot  numeric(12,2) not null,
  currency_snapshot      text          not null default 'USD',
  moq_snapshot           text,

  -- 거래조건
  supplier_incoterm      text,                              -- 공급사 기준: EXW, FOB, CIF, DDP
  buyer_incoterm         text,                              -- 바이어 제안 기준: EXW, FOB, CIF, DDP
  cost_notes             text,                              -- 물류비·운송비·부대비용 메모

  -- 마진 계산 (A방식: 공급가 기준 마크업)
  margin_rate            numeric(5,2)  not null default 0,  -- 마진율 (%)
  buyer_price            numeric(12,2) not null,            -- 바이어 단가 = supply_price_snapshot × (1 + margin_rate / 100)

  -- 수량/총액 (선택값 — 초기 제안 단계에서는 미입력 가능)
  quantity               numeric(12,2),                     -- 수량 (입력 시 total_price 계산 가능)
  total_price            numeric(14,2),                     -- 총액 = buyer_price × quantity

  notes                  text
);

create trigger trg_proposal_items_updated_at
  before update on proposal_items
  for each row execute function update_updated_at();


-- =============================================================
-- 7. send_logs (발송 기록)
-- =============================================================
create table send_logs (
  id           uuid        primary key default uuid_generate_v4(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid,

  buyer_id     uuid        not null references buyers(id) on delete restrict,
  proposal_id  uuid        references proposals(id) on delete set null, -- 견적 없이 발송 가능
  brand_id     uuid        references brands(id) on delete set null,    -- 어떤 브랜드 자료를 보냈는지
  sent_at      timestamptz not null default now(),
  channel      text,       -- 추천: 이메일, WhatsApp, Line, Alibaba, 기타
  notes        text        -- 발송한 제품/자료 등 자유 기록
);

create trigger trg_send_logs_updated_at
  before update on send_logs
  for each row execute function update_updated_at();


-- =============================================================
-- 8. send_log_files (발송 첨부 자료)
-- =============================================================
create table send_log_files (
  id           uuid        primary key default uuid_generate_v4(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid,

  send_log_id    uuid        not null references send_logs(id) on delete cascade,
  file_type      text,       -- 추천: 브랜드소개서, 제품소개서, 가격표, 성분표, 인증자료,
                             --       수권서, 상표, 디자인자료, 패키지/칼선, 기타
  file_stage     text,       -- 추천: supplier_original, internal_working, buyer_sent, final
  language       text,       -- 추천: KR, EN, TC, CN, JP, 기타
  version_label  text,       -- 자유 입력: v1, v2, 2026-04 등
  is_current     boolean     not null default true,
  source         text,       -- 추천: supplier, posicle, buyer, agency, other
  file_name      text,
  file_url       text        not null,
  notes          text
);

create trigger trg_send_log_files_updated_at
  before update on send_log_files
  for each row execute function update_updated_at();


-- =============================================================
-- 9. followups (후속 연락 일정)
-- =============================================================
create table followups (
  id           uuid        primary key default uuid_generate_v4(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid,

  buyer_id     uuid        not null references buyers(id) on delete restrict,
  send_log_id  uuid        references send_logs(id) on delete set null,
  proposal_id  uuid        references proposals(id) on delete set null,
  due_date     date        not null,
  status       text        not null default '예정',
                           -- 추천: 예정, 완료, 보류, 무응답, 관심 있음, 샘플 요청, 견적 재요청
  notes        text
);

create trigger trg_followups_updated_at
  before update on followups
  for each row execute function update_updated_at();


-- =============================================================
-- 인덱스 (조회 성능)
-- =============================================================
create index idx_products_brand_id       on products(brand_id);
create index idx_products_is_active      on products(is_active);
create index idx_product_files_product_id on product_files(product_id);
create index idx_proposals_buyer_id      on proposals(buyer_id);
create index idx_proposal_items_proposal_id on proposal_items(proposal_id);
create index idx_proposal_items_product_id  on proposal_items(product_id);
create index idx_send_logs_buyer_id      on send_logs(buyer_id);
create index idx_send_logs_sent_at       on send_logs(sent_at desc);
create index idx_send_log_files_send_log_id on send_log_files(send_log_id);
create index idx_followups_buyer_id      on followups(buyer_id);
create index idx_followups_due_date      on followups(due_date);
create index idx_followups_status        on followups(status);
