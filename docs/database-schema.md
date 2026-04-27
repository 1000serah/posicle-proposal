# Posicle Proposal — DB 스키마 설계

> 기준 문서: `docs/PRD.md`
> 대상 DB: Supabase PostgreSQL (MVP)

---

## 테이블 관계 요약

```
brands ──< products ──< product_files
                  │
buyers ──< proposals ──< proposal_items >── products
      │
      └──< send_logs ──< send_log_files
      │         │
      └──< followups
                └── (proposal 연결 가능)
```

---

## 공통 필드 (모든 테이블)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | uuid | PK, 자동 생성 |
| `created_at` | timestamptz | 생성일시 |
| `updated_at` | timestamptz | 수정일시 (트리거로 자동 갱신) |
| `created_by` | uuid (nullable) | 작성자 — MVP에서는 저장만, 2차에서 `auth.users.id`와 연결해 권한 제어 |

---

## 테이블별 상세 설계

### 1. `brands` — 브랜드/공급사

> MVP에서는 브랜드와 공급사를 이 테이블 하나로 통합 관리.
> 공급사 1곳이 여러 브랜드를 가지는 구조가 필요해지면 `suppliers` 테이블로 분리.

| 컬럼 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `brand_name` | text | ✅ | 브랜드명 |
| `supplier_name` | text | | 공급사명 (브랜드 본사, 제조사, 총판 등) |
| `country` | text | | 공급사 국가 (기본값: `Korea`) |
| `category` | text | | 카테고리 — 선택식, DB에 영어값 저장 (추천 값 아래 참조) |
| `contact_person` | text | | 담당자 이름 |
| `contact_info` | text | | 연락처 (전화, 이메일 등) |
| `is_active` | boolean | ✅ | 활성 여부 (기본: true) — 삭제 대신 비활성화로 관리 |
| `file_links` | jsonb | | 관련 자료 링크 배열 — 다음 단계에서 별도 기능으로 구현 |
| `notes` | text | | 메모 |

**category 선택 값 (DB 저장 기준):**
`Skincare`, `Makeup`, `Haircare`, `Bodycare`, `Food`, `Health Supplement`, `Kids`, `Clinic / Aesthetic`, `Lifestyle`, `Other`

---

### 2. `products` — 제품

| 컬럼 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `brand_id` | uuid | | `brands.id` FK |
| `product_name` | text | ✅ | 제품명 |
| `category` | text | | 제품 카테고리 (스킨케어, 선케어, 건기식 등) |
| `positioning` | text | | 주요 효능/포지션 (예: 미백 앰플, 저자극 선크림) |
| `supply_price` | numeric(12,2) | | 현재 공급가 |
| `currency` | text | ✅ | 공급가 통화 (기본값: `USD`) — 견적 통화와 별도 관리 |
| `moq` | text | | 최소 주문 수량 (예: 300ea, 1 carton) |
| `lead_time` | text | | 리드타임 (예: 30일, 4~6주) |
| `certifications` | jsonb | | 인증 목록. 예: `[{"type":"CPNP","status":"완료"},{"type":"FDA","status":"진행중"}]` |
| `has_ingredient_list` | boolean | ✅ | 성분표 보유 여부 (기본: false) |
| `has_regulatory_docs` | boolean | ✅ | 인허가 자료 보유 여부 (기본: false) |
| `is_active` | boolean | ✅ | 활성 여부 (기본: true) |
| `notes` | text | | 메모 (공급가 변경 이유 등 기록) |

**certifications 추천 type 값:** `CPNP`, `CPSR`, `FDA`, `TFDA`, `HALAL`, `ISO`, `기타`
**certifications 추천 status 값:** `없음`, `진행중`, `완료`

---

### 3. `product_files` — 제품 자료 링크

MVP에서는 Google Drive URL + 메타데이터 저장 방식으로 관리한다.

| 컬럼 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `product_id` | uuid | ✅ | `products.id` FK (삭제 시 cascade) |
| `file_type` | text | | 자료 종류 |
| `file_stage` | text | | 파일 단계 |
| `language` | text | | 언어 |
| `version_label` | text | | 버전 (자유 입력) |
| `is_current` | boolean | ✅ | 최신본 여부 (기본: true) |
| `source` | text | | 출처 |
| `file_name` | text | | 파일/자료 이름 |
| `file_url` | text | ✅ | Google Drive 링크 또는 URL |
| `notes` | text | | 메모 |

**file_type 추천 값:** `브랜드소개서`, `제품소개서`, `가격표`, `성분표`, `인증자료`, `수권서`, `상표`, `디자인자료`, `패키지/칼선`, `기타`
**file_stage 추천 값:** `supplier_original`, `internal_working`, `buyer_sent`, `final`
**language 추천 값:** `KR`, `EN`, `TC`, `CN`, `JP`, `기타`
**source 추천 값:** `supplier`, `posicle`, `buyer`, `agency`, `other`

**파일명 추천 규칙:**
```
[브랜드명]_[자료종류]_[언어]_[단계]_[버전]_[날짜]

예:
ANGELS_LIQUID_BrandDeck_EN_supplier_original_v1_20260427
ONCLO_PriceList_USD_internal_working_v2_20260427
HEALIC_IngredientList_TC_buyer_sent_v1_20260427
```

---

### 4. `buyers` — 바이어

> 회사 단위로 관리. MVP에서는 대표 담당자 1명만 저장. 2차 개발에서 `buyer_contacts` 테이블로 확장.

| 컬럼 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `company_name` | text | ✅ | 바이어 회사명 |
| `country` | text | | 국가 |
| `contact_person` | text | | 대표 담당자 이름 |
| `email` | text | | 이메일 |
| `whatsapp` | text | | WhatsApp 번호 |
| `line_id` | text | | Line ID |
| `alibaba_url` | text | | Alibaba 프로필 링크 |
| `interest_categories` | jsonb | | 관심 카테고리 배열. 예: `["스킨케어","선케어"]` |
| `price_range` | text | | 선호 가격대 (예: USD 3~10, 저가 대량) |
| `channel_type` | text | | 판매 채널 유형 |
| `notes` | text | | 메모 |

**channel_type 추천 값:** `리테일`, `이커머스`, `라이브커머스`, `총판`, `클리닉`, `에스테틱`, `기타`

---

### 5. `proposals` — 견적 (헤더)

| 컬럼 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `buyer_id` | uuid | ✅ | `buyers.id` FK |
| `title` | text | | 견적 제목 (예: 대만 A사 미백 앰플 견적) |
| `currency` | text | ✅ | 견적 통화 (기본값: `USD`) — 제품 공급가 통화와 별도 관리 가능 |
| `status` | text | ✅ | 상태 (기본값: `초안`) |
| `notes` | text | | 메모 (환율 정보 등 수동 기록) |

**status 추천 값:** `초안`, `발송완료`, `검토중`, `협의중`, `성사`, `보류`, `취소`

---

### 6. `proposal_items` — 견적 항목 (제품별)

> **단가 중심 설계**: 초기 제안 단계에서 발주 수량이 미확정인 경우가 많으므로, `buyer_price`(단가)를 핵심값으로 두고 `quantity`·`total_price`는 선택값으로 처리한다.
> **가격 스냅샷**: 나중에 공급가가 바뀌어도 과거 견적이 유지된다.
> **마진 계산 A방식**: `buyer_price = supply_price_snapshot × (1 + margin_rate / 100)`

| 컬럼 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `proposal_id` | uuid | ✅ | `proposals.id` FK (삭제 시 cascade) |
| `product_id` | uuid | | `products.id` FK (제품 삭제되어도 기록 유지 → set null) |
| `product_name_snapshot` | text | ✅ | 견적 당시 제품명 (스냅샷) |
| `supply_price_snapshot` | numeric(12,2) | ✅ | 견적 당시 공급가 (스냅샷) |
| `currency_snapshot` | text | ✅ | 견적 당시 공급가 통화 (스냅샷) |
| `moq_snapshot` | text | | 견적 당시 MOQ (스냅샷) |
| `supplier_incoterm` | text | | 공급사 기준 거래조건 (`EXW`, `FOB`, `CIF`, `DDP`) |
| `buyer_incoterm` | text | | 바이어 제안 기준 거래조건 (`EXW`, `FOB`, `CIF`, `DDP`) |
| `cost_notes` | text | | 물류비·운송비·부대비용 메모 |
| `margin_rate` | numeric(5,2) | ✅ | 마진율 (%, 기본값: 0) |
| `buyer_price` | numeric(12,2) | ✅ | 바이어 단가 — 핵심값 (A방식: supply_price_snapshot × (1 + margin_rate / 100)) |
| `quantity` | integer | | 수량 — **선택값** (입력 시 total_price 계산 가능) |
| `total_price` | numeric(14,2) | | 총액 — **선택값** (= buyer_price × quantity, 수량 입력 시에만 의미 있음) |
| `notes` | text | | 항목별 메모 |

---

### 7. `send_logs` — 발송 기록

| 컬럼 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `buyer_id` | uuid | ✅ | `buyers.id` FK |
| `proposal_id` | uuid | | `proposals.id` FK (선택 — 견적 없이 발송 가능) |
| `brand_id` | uuid | | `brands.id` FK (선택 — 어떤 브랜드 자료를 보냈는지) |
| `sent_at` | timestamptz | ✅ | 발송일시 (기본: now()) |
| `channel` | text | | 발송 채널 |
| `notes` | text | | 메모 (발송한 제품, 특이사항 등) |

**channel 추천 값:** `이메일`, `WhatsApp`, `Line`, `Alibaba`, `기타`

---

### 8. `send_log_files` — 발송 첨부 자료

`product_files`와 동일한 메타데이터 구조를 사용한다.

| 컬럼 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `send_log_id` | uuid | ✅ | `send_logs.id` FK (삭제 시 cascade) |
| `file_type` | text | | 자료 종류 (product_files와 동일 추천 값) |
| `file_stage` | text | | 파일 단계 (`supplier_original`, `internal_working`, `buyer_sent`, `final`) |
| `language` | text | | 언어 (`KR`, `EN`, `TC`, `CN`, `JP`, `기타`) |
| `version_label` | text | | 버전 (자유 입력) |
| `is_current` | boolean | ✅ | 최신본 여부 (기본: true) |
| `source` | text | | 출처 (`supplier`, `posicle`, `buyer`, `agency`, `other`) |
| `file_name` | text | | 파일/자료 이름 |
| `file_url` | text | ✅ | Google Drive 링크 또는 URL |
| `notes` | text | | 메모 |

---

### 9. `followups` — 후속 연락 일정

| 컬럼 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `buyer_id` | uuid | ✅ | `buyers.id` FK |
| `send_log_id` | uuid | | `send_logs.id` FK (선택) |
| `proposal_id` | uuid | | `proposals.id` FK (선택) |
| `due_date` | date | ✅ | follow-up 예정일 |
| `status` | text | ✅ | 상태 (기본값: `예정`) |
| `notes` | text | | 메모 |

**status 추천 값:** `예정`, `완료`, `보류`, `무응답`, `관심 있음`, `샘플 요청`, `견적 재요청`

---

## SQL 변경 필요 사항 (미반영 — 승인 후 적용)

현재 `supabase/schema.sql`에 반영되지 않은 변경 내용:

| 대상 | 변경 내용 |
|------|-----------|
| `product_files` | `file_stage`, `language`, `version_label`, `is_current`, `source` 컬럼 추가 |
| `send_log_files` | `file_stage`, `language`, `version_label`, `is_current`, `source` 컬럼 추가 |
| `proposal_items` | `supplier_incoterm`, `buyer_incoterm`, `cost_notes`, `quantity`, `total_price` 컬럼 추가 |

> 승인 시 `supabase/schema.sql` 수정 + Supabase 마이그레이션 SQL 제공

---

## 향후 연결 포인트 (2차 개발)

| 항목 | 연결 방법 |
|------|-----------|
| 사용자 권한 관리 | `user_profiles` 테이블 추가 (`user_id`, `role`: admin/manager/viewer) |
| 바이어 접근 제어 | `buyer_access` 테이블 추가 (`user_id` + `buyer_id` 매핑) + RLS 정책 적용 |
| 바이어 담당자 다중 관리 | `buyer_contacts` 테이블 추가 (`buyer_id` FK, 이름, 이메일, WhatsApp 등) |
| Google Drive 연동 | `file_url` 컬럼을 Drive API로 대체, 파일명 자동 추천 기능 추가 |
| PDF 견적서 생성 | `proposals` + `proposal_items` 데이터 그대로 사용 |
| 견적 비용 세분화 | `proposal_cost_items` 테이블 추가 (국내운송비, 국제배송비, 포장비, 인증비, 샘플비 등) |
| PO/주문 전환 | `orders`, `order_items` 테이블 추가 — `proposal_id` FK로 견적→주문 전환 구조 |
| 가격 버전 관리 | `product_price_history` 테이블 추가 |
| 환율 자동 연동 | 외부 환율 API 연동, `exchange_rates` 테이블 추가 |
| 마진 계산 B방식 | `proposal_items`에 `margin_method` 컬럼 추가 (`markup` / `target_margin`) |
