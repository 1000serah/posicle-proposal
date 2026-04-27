'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

const CATEGORIES = [
  'Toner', 'Toner Pad', 'Ampoule / Serum', 'Cream', 'Mask Pack', 'Cleanser',
  'Sunscreen', 'Makeup Base', 'Cushion', 'Concealer', 'Lip', 'Hair Care',
  'Body Care', 'Food', 'Health Supplement', 'Device', 'OEM Option', 'Other',
]

const PRODUCT_TYPES = [
  'Live', 'Hold', 'GWP', 'Sample', 'Miniature', 'Tester',
  'Non-sale', 'Discontinued', 'OEM Option', 'Other',
]

const CURRENCIES = ['USD', 'KRW', 'EUR', 'TWD', 'CNY', 'JPY']

const TYPE_COLORS: Record<string, string> = {
  Live: 'bg-green-100 text-green-700',
  Hold: 'bg-yellow-100 text-yellow-700',
  Discontinued: 'bg-red-100 text-red-600',
  GWP: 'bg-purple-100 text-purple-700',
}

type Brand = { id: string; brand_name: string }

type Product = {
  id: string
  brand_id: string | null
  brands: { brand_name: string } | null
  sku_code: string | null
  product_name: string
  product_name_kr: string | null
  product_type: string
  category: string | null
  supply_price: number | null
  currency: string
  is_active: boolean
  // 수정용 추가 필드
  old_sku_code: string | null
  barcode: string | null
  hs_code: string | null
  positioning: string | null
  moq_quantity: number | null
  moq: string | null
  lead_time: string | null
  has_ingredient_list: boolean
  has_regulatory_docs: boolean
  unit_spec: string | null
  pcs_per_carton: number | null
  outbox_weight_kg: number | null
  outbox_size_mm: string | null
  cbm: number | null
  notes: string | null
}

const emptyForm = {
  brand_id: '',
  sku_code: '',
  old_sku_code: '',
  barcode: '',
  hs_code: '',
  product_name: '',
  product_name_kr: '',
  product_type: 'Live',
  category: '',
  positioning: '',
  supply_price: '',
  currency: 'USD',
  moq_quantity: '',
  moq: '',
  lead_time: '',
  has_ingredient_list: false,
  has_regulatory_docs: false,
  unit_spec: '',
  pcs_per_carton: '',
  outbox_weight_kg: '',
  outbox_size_mm: '',
  cbm: '',
  notes: '',
}

type FormState = typeof emptyForm
type Message = { type: 'success' | 'error'; text: string }

type ParsedRow = {
  sku_code: string
  product_name: string
  product_name_kr: string
  product_type: string
  category: string
  supply_price: string
  currency: string
  moq_quantity: string
  moq: string
  lead_time: string
  errors: string[]
}

function toNum(v: string) { const n = parseFloat(v); return isNaN(n) ? null : n }

export default function ProductsPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [pageLoading, setPageLoading] = useState(true)

  const [brands, setBrands] = useState<Brand[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [showHidden, setShowHidden] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [isCopying, setIsCopying] = useState(false)
  const [submitMode, setSubmitMode] = useState<'save' | 'continue'>('save')
  const [form, setForm] = useState<FormState>(emptyForm)
  const [showLogistics, setShowLogistics] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<Message | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkMode, setBulkMode] = useState(false)
  const [bulkBrandId, setBulkBrandId] = useState('')
  const [pasteText, setPasteText] = useState('')
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [bulkSaving, setBulkSaving] = useState(false)
  const [bulkMessage, setBulkMessage] = useState<Message | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace('/login')
      } else {
        setUser(session.user)
        setPageLoading(false)
        fetchBrands()
        fetchProducts()
      }
    })
  }, [router])

  async function fetchBrands() {
    const { data } = await supabase
      .from('brands')
      .select('id, brand_name')
      .eq('is_active', true)
      .order('brand_name', { ascending: true })
    if (data) setBrands(data)
  }

  async function fetchProducts() {
    const { data } = await supabase
      .from('products')
      .select(`
        id, brand_id, brands(brand_name),
        sku_code, old_sku_code, barcode, hs_code,
        product_name, product_name_kr,
        product_type, category, positioning,
        supply_price, currency,
        moq_quantity, moq, lead_time,
        has_ingredient_list, has_regulatory_docs,
        unit_spec, pcs_per_carton, outbox_weight_kg, outbox_size_mm, cbm,
        is_active, notes
      `)
      .order('product_name', { ascending: true })
    if (data) {
      const normalized: Product[] = data.map(row => {
        const brandsRaw = row.brands
        const brands = Array.isArray(brandsRaw)
          ? (brandsRaw[0] as { brand_name: string } | undefined) ?? null
          : (brandsRaw as { brand_name: string } | null) ?? null
        return { ...row, brands }
      })
      setProducts(normalized)
    }
  }

  const visibleProducts = products.filter(p => showHidden ? !p.is_active : p.is_active)
  const allSelected = visibleProducts.length > 0 && visibleProducts.every(p => selectedIds.has(p.id))

  function switchView(hidden: boolean) {
    setShowHidden(hidden)
    cancelForm()
    setSelectedIds(new Set())
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    setSelectedIds(allSelected ? new Set() : new Set(visibleProducts.map(p => p.id)))
  }

  function startCreate() {
    setEditingId(null)
    setIsCreating(true)
    setIsCopying(false)
    setForm(emptyForm)
    setShowLogistics(false)
    setMessage(null)
  }

  function startCopy(p: Product) {
    setEditingId(null)
    setIsCreating(true)
    setIsCopying(true)
    setForm({
      brand_id: p.brand_id ?? '',
      sku_code: '',
      old_sku_code: '',
      barcode: '',
      hs_code: p.hs_code ?? '',
      product_name: '',
      product_name_kr: '',
      product_type: p.product_type,
      category: p.category ?? '',
      positioning: p.positioning ?? '',
      supply_price: p.supply_price != null ? String(p.supply_price) : '',
      currency: p.currency,
      moq_quantity: p.moq_quantity != null ? String(p.moq_quantity) : '',
      moq: p.moq ?? '',
      lead_time: p.lead_time ?? '',
      has_ingredient_list: p.has_ingredient_list,
      has_regulatory_docs: p.has_regulatory_docs,
      unit_spec: p.unit_spec ?? '',
      pcs_per_carton: p.pcs_per_carton != null ? String(p.pcs_per_carton) : '',
      outbox_weight_kg: p.outbox_weight_kg != null ? String(p.outbox_weight_kg) : '',
      outbox_size_mm: p.outbox_size_mm ?? '',
      cbm: p.cbm != null ? String(p.cbm) : '',
      notes: p.notes ?? '',
    })
    setShowLogistics(false)
    setMessage(null)
  }

  function startEdit(p: Product) {
    setIsCreating(false)
    setEditingId(p.id)
    setForm({
      brand_id: p.brand_id ?? '',
      sku_code: p.sku_code ?? '',
      old_sku_code: p.old_sku_code ?? '',
      barcode: p.barcode ?? '',
      hs_code: p.hs_code ?? '',
      product_name: p.product_name,
      product_name_kr: p.product_name_kr ?? '',
      product_type: p.product_type,
      category: p.category ?? '',
      positioning: p.positioning ?? '',
      supply_price: p.supply_price != null ? String(p.supply_price) : '',
      currency: p.currency,
      moq_quantity: p.moq_quantity != null ? String(p.moq_quantity) : '',
      moq: p.moq ?? '',
      lead_time: p.lead_time ?? '',
      has_ingredient_list: p.has_ingredient_list,
      has_regulatory_docs: p.has_regulatory_docs,
      unit_spec: p.unit_spec ?? '',
      pcs_per_carton: p.pcs_per_carton != null ? String(p.pcs_per_carton) : '',
      outbox_weight_kg: p.outbox_weight_kg != null ? String(p.outbox_weight_kg) : '',
      outbox_size_mm: p.outbox_size_mm ?? '',
      cbm: p.cbm != null ? String(p.cbm) : '',
      notes: p.notes ?? '',
    })
    setShowLogistics(false)
    setMessage(null)
  }

  function cancelForm() {
    setEditingId(null)
    setIsCreating(false)
    setIsCopying(false)
    setForm(emptyForm)
    setShowLogistics(false)
    setMessage(null)
  }

  function setTextField(key: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value }))
  }

  function setCheckbox(key: 'has_ingredient_list' | 'has_regulatory_docs') {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(f => ({ ...f, [key]: e.target.checked }))
  }

  function skuErrorMessage(error: { code?: string; message?: string }) {
    if (error.code === '23505' || error.message?.toLowerCase().includes('sku')) {
      return '이미 등록된 SKU 코드입니다.'
    }
    return '저장에 실패했습니다.'
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const keepOpen = submitMode === 'continue'
    setSaving(true)
    setMessage(null)

    const payload = {
      brand_id: form.brand_id || null,
      sku_code: form.sku_code.trim() || null,
      old_sku_code: form.old_sku_code.trim() || null,
      barcode: form.barcode.trim() || null,
      hs_code: form.hs_code.trim() || null,
      product_name: form.product_name.trim(),
      product_name_kr: form.product_name_kr.trim() || null,
      product_type: form.product_type,
      category: form.category || null,
      positioning: form.positioning.trim() || null,
      supply_price: toNum(form.supply_price),
      currency: form.currency,
      moq_quantity: toNum(form.moq_quantity),
      moq: form.moq.trim() || null,
      lead_time: form.lead_time.trim() || null,
      has_ingredient_list: form.has_ingredient_list,
      has_regulatory_docs: form.has_regulatory_docs,
      unit_spec: form.unit_spec.trim() || null,
      pcs_per_carton: toNum(form.pcs_per_carton),
      outbox_weight_kg: toNum(form.outbox_weight_kg),
      outbox_size_mm: form.outbox_size_mm.trim() || null,
      cbm: toNum(form.cbm),
      notes: form.notes.trim() || null,
    }

    if (isCreating) {
      const { error } = await supabase
        .from('products')
        .insert({ ...payload, created_by: user?.id, is_active: true })
      if (error) {
        setMessage({ type: 'error', text: skuErrorMessage(error) })
      } else {
        await fetchProducts()
        if (keepOpen) {
          setMessage({ type: 'success', text: '제품이 등록됐습니다. 다음 제품을 계속 입력할 수 있습니다.' })
          setIsCopying(false)
          setForm(prev => ({
            ...emptyForm,
            brand_id: prev.brand_id,
            category: prev.category,
            product_type: prev.product_type,
            supply_price: prev.supply_price,
            currency: prev.currency,
            moq_quantity: prev.moq_quantity,
            moq: prev.moq,
            lead_time: prev.lead_time,
            has_ingredient_list: prev.has_ingredient_list,
            has_regulatory_docs: prev.has_regulatory_docs,
            unit_spec: prev.unit_spec,
            pcs_per_carton: prev.pcs_per_carton,
            outbox_weight_kg: prev.outbox_weight_kg,
            outbox_size_mm: prev.outbox_size_mm,
            cbm: prev.cbm,
          }))
        } else {
          setMessage({ type: 'success', text: '제품이 등록됐습니다.' })
          cancelForm()
        }
      }
    } else if (editingId) {
      const { error } = await supabase
        .from('products')
        .update(payload)
        .eq('id', editingId)
      if (error) {
        setMessage({ type: 'error', text: skuErrorMessage(error) })
      } else {
        setMessage({ type: 'success', text: '수정됐습니다.' })
        cancelForm()
        fetchProducts()
      }
    }

    setSaving(false)
  }

  async function handleHide(id: string) {
    const { error } = await supabase.from('products').update({ is_active: false }).eq('id', id)
    if (!error) {
      if (editingId === id) cancelForm()
      setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n })
      fetchProducts()
    }
  }

  async function handleActivate(id: string) {
    const { error } = await supabase.from('products').update({ is_active: true }).eq('id', id)
    if (!error) {
      setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n })
      fetchProducts()
    }
  }

  async function handleBulkHide() {
    const ids = Array.from(selectedIds)
    if (!ids.length) return
    const { error } = await supabase.from('products').update({ is_active: false }).in('id', ids)
    if (error) {
      setMessage({ type: 'error', text: '일괄 처리에 실패했습니다.' })
    } else {
      if (editingId && ids.includes(editingId)) cancelForm()
      setMessage({ type: 'success', text: `${ids.length}개 제품을 숨겼습니다.` })
      setSelectedIds(new Set())
      fetchProducts()
    }
  }

  async function handleBulkActivate() {
    const ids = Array.from(selectedIds)
    if (!ids.length) return
    const { error } = await supabase.from('products').update({ is_active: true }).in('id', ids)
    if (error) {
      setMessage({ type: 'error', text: '일괄 처리에 실패했습니다.' })
    } else {
      setMessage({ type: 'success', text: `${ids.length}개 제품을 활성화했습니다.` })
      setSelectedIds(new Set())
      fetchProducts()
    }
  }

  function startBulkMode() {
    cancelForm()
    setBulkMode(true)
    setBulkBrandId('')
    setPasteText('')
    setParsedRows([])
    setBulkMessage(null)
  }

  function cancelBulkMode() {
    setBulkMode(false)
    setBulkBrandId('')
    setPasteText('')
    setParsedRows([])
    setBulkMessage(null)
  }

  function parsePasteText() {
    const existingSkus = new Set(products.filter(p => p.sku_code).map(p => p.sku_code!))
    const lines = pasteText.trim().split('\n').filter(l => l.trim())
    const skusInBatch = new Set<string>()

    const rows: ParsedRow[] = lines.map(line => {
      const cols = line.split('\t')
      const sku_code = cols[0]?.trim() ?? ''
      const product_name = cols[1]?.trim() ?? ''
      const product_name_kr = cols[2]?.trim() ?? ''
      const rawType = cols[3]?.trim() ?? ''
      const product_type = PRODUCT_TYPES.includes(rawType) ? rawType : 'Live'
      const category = cols[4]?.trim() ?? ''
      const supply_price = cols[5]?.trim() ?? ''
      const rawCurrency = cols[6]?.trim() ?? ''
      const currency = CURRENCIES.includes(rawCurrency) ? rawCurrency : 'USD'
      const moq_quantity = cols[7]?.trim() ?? ''
      const moq = cols[8]?.trim() ?? ''
      const lead_time = cols[9]?.trim() ?? ''

      const errors: string[] = []
      if (!product_name) errors.push('영문명 필수')
      if (sku_code) {
        if (existingSkus.has(sku_code)) errors.push('SKU 이미 등록됨')
        else if (skusInBatch.has(sku_code)) errors.push('SKU 배치 내 중복')
        else skusInBatch.add(sku_code)
      }

      return { sku_code, product_name, product_name_kr, product_type, category, supply_price, currency, moq_quantity, moq, lead_time, errors }
    })
    setParsedRows(rows)
  }

  async function handleBulkSubmit() {
    const validRows = parsedRows.filter(r => r.errors.length === 0)
    if (!validRows.length) return
    setBulkSaving(true)
    setBulkMessage(null)

    const payloads = validRows.map(r => ({
      brand_id: bulkBrandId || null,
      sku_code: r.sku_code || null,
      product_name: r.product_name,
      product_name_kr: r.product_name_kr || null,
      product_type: r.product_type,
      category: r.category || null,
      supply_price: toNum(r.supply_price),
      currency: r.currency,
      moq_quantity: toNum(r.moq_quantity),
      moq: r.moq || null,
      lead_time: r.lead_time || null,
      created_by: user?.id,
      is_active: true,
    }))

    const { error } = await supabase.from('products').insert(payloads)
    if (error) {
      setBulkMessage({ type: 'error', text: '등록에 실패했습니다. SKU 중복이 있을 수 있습니다.' })
    } else {
      setBulkMessage({ type: 'success', text: `${validRows.length}개 제품이 등록됐습니다.` })
      setPasteText('')
      setParsedRows([])
      fetchProducts()
    }
    setBulkSaving(false)
  }

  if (pageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-400">로딩 중...</p>
      </div>
    )
  }

  const showForm = isCreating || editingId !== null
  const validCount = parsedRows.filter(r => r.errors.length === 0).length
  const errorCount = parsedRows.filter(r => r.errors.length > 0).length

  if (bulkMode) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <a href="/" className="text-gray-500 hover:text-gray-900">대시보드</a>
            <span className="text-gray-300">/</span>
            <button onClick={cancelBulkMode} className="text-gray-500 hover:text-gray-900">제품 마스터</button>
            <span className="text-gray-300">/</span>
            <span className="font-semibold text-gray-900">대량 붙여넣기 등록</span>
          </div>
          <span className="text-sm text-gray-500">{user?.email}</span>
        </header>

        <div className="max-w-4xl mx-auto px-6 py-6">
          {bulkMessage && (
            <div className={`mb-4 rounded-lg px-4 py-3 text-sm ${
              bulkMessage.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}>
              {bulkMessage.text}
            </div>
          )}

          {/* 1단계: 브랜드 선택 + 붙여넣기 */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
            <p className="text-sm font-semibold text-gray-900 mb-4">1단계 — 브랜드 선택 & 데이터 붙여넣기</p>

            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                브랜드 <span className="text-red-500">*</span>
                <span className="text-gray-400 font-normal ml-1">(모든 행에 동일하게 적용)</span>
              </label>
              <select value={bulkBrandId} onChange={e => setBulkBrandId(e.target.value)} className={selectCls}>
                <option value="">브랜드 선택</option>
                {brands.map(b => <option key={b.id} value={b.id}>{b.brand_name}</option>)}
              </select>
            </div>

            <div className="mb-4">
              <p className="text-xs font-medium text-gray-700 mb-2">엑셀/구글시트 열 순서</p>
              <div className="flex flex-wrap gap-1">
                {[
                  'A: SKU코드', 'B: 영문명*', 'C: 한글명', 'D: 제품유형',
                  'E: 카테고리', 'F: 공급가', 'G: 통화', 'H: MOQ수량', 'I: MOQ메모', 'J: 리드타임',
                ].map(col => (
                  <span key={col} className="text-xs bg-gray-100 text-gray-600 rounded px-2 py-0.5 font-mono">{col}</span>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-1.5">* 영문명 필수. D열 비우면 Live, G열 비우면 USD 자동 적용.</p>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-700 mb-1">데이터 붙여넣기</label>
              <textarea
                value={pasteText}
                onChange={e => { setPasteText(e.target.value); setParsedRows([]) }}
                rows={6}
                placeholder="엑셀/구글시트에서 셀 범위 선택 → Ctrl+C → 여기서 Ctrl+V"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none font-mono"
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={parsePasteText}
                disabled={!pasteText.trim()}
                className="rounded-lg bg-gray-800 text-white text-sm px-4 py-2 hover:bg-black disabled:opacity-40 transition-colors"
              >
                미리보기
              </button>
              <button type="button" onClick={cancelBulkMode} className="text-sm text-gray-500 hover:text-gray-900">
                취소
              </button>
            </div>
          </div>

          {/* 2단계: 미리보기 */}
          {parsedRows.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-sm font-semibold text-gray-900 mb-1">
                2단계 — 미리보기
                <span className="ml-2 text-xs font-normal text-gray-500">전체 {parsedRows.length}행</span>
                {validCount > 0 && <span className="ml-1 text-xs font-normal text-green-600">· 유효 {validCount}개</span>}
                {errorCount > 0 && <span className="ml-1 text-xs font-normal text-red-500">· 오류 {errorCount}개</span>}
              </p>
              <p className="text-xs text-gray-400 mb-4">오류 행은 등록하지 않습니다.</p>

              <div className="overflow-x-auto mb-5">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 text-left">
                      {['#', '상태', 'SKU', '영문명', '한글명', '유형', '카테고리', '공급가', '통화', 'MOQ수량'].map(h => (
                        <th key={h} className="pb-2 pr-3 text-gray-400 font-medium whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.map((row, i) => (
                      <tr key={i} className={`border-b border-gray-100 ${row.errors.length > 0 ? 'bg-red-50' : ''}`}>
                        <td className="py-2 pr-3 text-gray-400">{i + 1}</td>
                        <td className="py-2 pr-3">
                          {row.errors.length === 0 ? (
                            <span className="text-green-600 font-medium">✓</span>
                          ) : (
                            <div className="flex flex-col gap-0.5">
                              {row.errors.map((err, j) => (
                                <span key={j} className="bg-red-100 text-red-600 rounded px-1 whitespace-nowrap">{err}</span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="py-2 pr-3 font-mono text-gray-700">{row.sku_code || '—'}</td>
                        <td className="py-2 pr-3 text-gray-900">{row.product_name || <span className="text-gray-300">—</span>}</td>
                        <td className="py-2 pr-3 text-gray-600">{row.product_name_kr || '—'}</td>
                        <td className="py-2 pr-3 text-gray-600">{row.product_type}</td>
                        <td className="py-2 pr-3 text-gray-600">{row.category || '—'}</td>
                        <td className="py-2 pr-3 text-gray-600">{row.supply_price || '—'}</td>
                        <td className="py-2 pr-3 text-gray-600">{row.currency}</td>
                        <td className="py-2 pr-3 text-gray-600">{row.moq_quantity || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {validCount > 0 ? (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleBulkSubmit}
                    disabled={bulkSaving || !bulkBrandId}
                    className="rounded-lg bg-black text-white text-sm px-5 py-2 hover:bg-gray-800 disabled:opacity-40 transition-colors"
                  >
                    {bulkSaving ? '등록 중...' : `유효한 ${validCount}개 등록하기`}
                  </button>
                  {!bulkBrandId && <p className="text-xs text-red-500">브랜드를 먼저 선택해주세요.</p>}
                </div>
              ) : (
                <p className="text-sm text-red-500">유효한 행이 없습니다. 오류를 확인해주세요.</p>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <a href="/" className="text-gray-500 hover:text-gray-900">대시보드</a>
          <span className="text-gray-300">/</span>
          <span className="font-semibold text-gray-900">제품 마스터</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={startBulkMode}
            className="rounded-lg border border-gray-300 text-gray-700 text-sm px-3 py-1.5 hover:bg-gray-50 transition-colors"
          >
            대량 붙여넣기
          </button>
          <span className="text-sm text-gray-500">{user?.email}</span>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6 flex gap-6 items-start">

        {/* ── Left: List ── */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-semibold text-gray-900">
                {showHidden ? '숨긴 제품' : '제품 목록'}
              </h2>
              <button
                onClick={() => switchView(!showHidden)}
                className="text-xs text-gray-400 underline hover:text-gray-700"
              >
                {showHidden ? '활성 제품 보기' : '숨긴 제품 보기'}
              </button>
            </div>
            {!showHidden && (
              <button
                onClick={startCreate}
                className="rounded-lg bg-black text-white text-sm px-4 py-2 hover:bg-gray-800 transition-colors"
              >
                + 새 제품 등록
              </button>
            )}
          </div>

          {message && (
            <div className={`mb-3 rounded-lg px-4 py-2 text-sm ${
              message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}>
              {message.text}
            </div>
          )}

          {/* 일괄 처리 바 */}
          {selectedIds.size > 0 && (
            <div className="mb-3 flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
              <span className="text-sm text-blue-700 font-medium">{selectedIds.size}개 선택됨</span>
              <button
                onClick={showHidden ? handleBulkActivate : handleBulkHide}
                className={`text-sm font-medium px-3 py-1 rounded-lg transition-colors ${
                  showHidden ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-800 text-white hover:bg-black'
                }`}
              >
                {showHidden ? '일괄 재활성화' : '일괄 숨기기'}
              </button>
              <button onClick={() => setSelectedIds(new Set())} className="text-xs text-blue-500 hover:text-blue-700">
                선택 해제
              </button>
            </div>
          )}

          {visibleProducts.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 px-6 py-12 text-center">
              <p className="text-sm text-gray-400">
                {showHidden ? '숨긴 제품이 없습니다.' : '등록된 제품이 없습니다.'}
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-2 px-1">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 accent-black cursor-pointer"
                />
                <span className="text-xs text-gray-500">전체 선택</span>
              </div>

              <div className="flex flex-col gap-2">
                {visibleProducts.map(p => (
                  <div
                    key={p.id}
                    className={`bg-white rounded-xl border px-4 py-3 flex items-start gap-3 transition-colors ${
                      editingId === p.id
                        ? 'border-black ring-1 ring-black'
                        : selectedIds.has(p.id)
                          ? 'border-blue-300 bg-blue-50/30'
                          : 'border-gray-200'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(p.id)}
                      onChange={() => toggleSelect(p.id)}
                      className="mt-1 w-4 h-4 accent-black cursor-pointer shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      {/* 제품명 + 태그 */}
                      <div className="flex items-start gap-2 flex-wrap">
                        <span className="font-medium text-sm text-gray-900">{p.product_name}</span>
                        {p.product_name_kr && (
                          <span className="text-xs text-gray-500">{p.product_name_kr}</span>
                        )}
                      </div>
                      {/* 태그 행 */}
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {p.brands?.brand_name && (
                          <span className="text-xs bg-gray-100 text-gray-600 rounded px-2 py-0.5">
                            {p.brands.brand_name}
                          </span>
                        )}
                        {p.category && (
                          <span className="text-xs bg-gray-100 text-gray-600 rounded px-2 py-0.5">
                            {p.category}
                          </span>
                        )}
                        <span className={`text-xs rounded px-2 py-0.5 ${
                          TYPE_COLORS[p.product_type] ?? 'bg-gray-100 text-gray-500'
                        }`}>
                          {p.product_type}
                        </span>
                      </div>
                      {/* SKU + 가격 */}
                      <div className="flex items-center gap-3 mt-1">
                        {p.sku_code && (
                          <span className="text-xs text-gray-400 font-mono">{p.sku_code}</span>
                        )}
                        {p.supply_price != null && (
                          <span className="text-xs text-gray-600">
                            {p.currency} {p.supply_price.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 mt-0.5">
                      {showHidden ? (
                        <button
                          onClick={() => handleActivate(p.id)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                          다시 활성화
                        </button>
                      ) : (
                        <>
                          <button onClick={() => startCopy(p)} className="text-xs text-indigo-500 hover:text-indigo-700">
                            복사
                          </button>
                          <button onClick={() => startEdit(p)} className="text-xs text-gray-600 hover:text-gray-900">
                            수정
                          </button>
                          <button onClick={() => handleHide(p.id)} className="text-xs text-gray-400 hover:text-red-500">
                            숨기기
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* ── Right: Form ── */}
        {showForm && (
          <div className="w-96 shrink-0">
            <div className="bg-white rounded-xl border border-gray-200 p-5 sticky top-6 max-h-[calc(100vh-6rem)] overflow-y-auto">
              <h3 className="text-sm font-semibold text-gray-900 mb-1">
                {isCopying ? '복사 등록 중' : isCreating ? '새 제품 등록' : '제품 수정'}
              </h3>
              {isCopying && (
                <p className="text-xs text-indigo-500 mb-4">기존 제품 정보를 복사했습니다. SKU와 제품명을 입력하세요.</p>
              )}
              {editingId && (
                <p className="text-xs text-gray-400 mb-4">수정 중: {form.product_name}</p>
              )}
              {isCreating && !isCopying && <div className="mb-4" />}

              <form onSubmit={handleSubmit} className="flex flex-col gap-5">

                {/* ─ 기본 정보 ─ */}
                <section>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">기본 정보</p>
                  <div className="flex flex-col gap-3">
                    <Field label="브랜드" required>
                      <select
                        value={form.brand_id}
                        onChange={setTextField('brand_id')}
                        required
                        className={selectCls}
                      >
                        <option value="">브랜드 선택</option>
                        {brands.map(b => (
                          <option key={b.id} value={b.id}>{b.brand_name}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="SKU 코드" required>
                      <input type="text" value={form.sku_code} onChange={setTextField('sku_code')}
                        required placeholder="예: AL-AMPOULE-001" className={inputCls} />
                    </Field>
                    <Field label="이전 SKU">
                      <input type="text" value={form.old_sku_code} onChange={setTextField('old_sku_code')}
                        className={inputCls} />
                    </Field>
                    <Field label="영문 제품명" required>
                      <input type="text" value={form.product_name} onChange={setTextField('product_name')}
                        required placeholder="예: Vitamin C Ampoule" className={inputCls} />
                    </Field>
                    <Field label="한글 제품명" required>
                      <input type="text" value={form.product_name_kr} onChange={setTextField('product_name_kr')}
                        required placeholder="예: 비타민C 앰플" className={inputCls} />
                    </Field>
                    <Field label="제품 유형" required>
                      <select value={form.product_type} onChange={setTextField('product_type')}
                        required className={selectCls}>
                        {PRODUCT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </Field>
                    <Field label="카테고리" required>
                      <select value={form.category} onChange={setTextField('category')}
                        required className={selectCls}>
                        <option value="">선택</option>
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </Field>
                    <Field label="효능/포지션">
                      <input type="text" value={form.positioning} onChange={setTextField('positioning')}
                        placeholder="예: 미백 앰플, 저자극 선크림" className={inputCls} />
                    </Field>
                    <Field label="바코드">
                      <input type="text" value={form.barcode} onChange={setTextField('barcode')} className={inputCls} />
                    </Field>
                    <Field label="HS CODE">
                      <input type="text" value={form.hs_code} onChange={setTextField('hs_code')} className={inputCls} />
                    </Field>
                  </div>
                </section>

                {/* ─ 가격·MOQ ─ */}
                <section>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">가격 · MOQ</p>
                  <div className="flex flex-col gap-3">
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Field label="공급가 (매입가)" required>
                          <input type="number" value={form.supply_price} onChange={setTextField('supply_price')}
                            required min="0" step="0.01" placeholder="0.00" className={inputCls} />
                        </Field>
                      </div>
                      <div className="w-24">
                        <Field label="통화" required>
                          <select value={form.currency} onChange={setTextField('currency')}
                            required className={selectCls}>
                            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </Field>
                      </div>
                    </div>
                    <Field label="MOQ 수량 (ea)" required>
                      <input type="number" value={form.moq_quantity} onChange={setTextField('moq_quantity')}
                        required min="0" placeholder="예: 300" className={inputCls} />
                    </Field>
                    <Field label="MOQ 메모">
                      <input type="text" value={form.moq} onChange={setTextField('moq')}
                        placeholder="단위/조건 (예: 1 carton = 24ea)" className={inputCls} />
                    </Field>
                    <Field label="리드타임">
                      <input type="text" value={form.lead_time} onChange={setTextField('lead_time')}
                        placeholder="예: 30일, 4~6주" className={inputCls} />
                    </Field>
                  </div>
                </section>

                {/* ─ 자료 체크 ─ */}
                <section>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">자료 보유 현황</p>
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={form.has_ingredient_list}
                        onChange={setCheckbox('has_ingredient_list')} className="w-4 h-4 accent-black" />
                      <span className="text-sm text-gray-700">성분표 보유</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={form.has_regulatory_docs}
                        onChange={setCheckbox('has_regulatory_docs')} className="w-4 h-4 accent-black" />
                      <span className="text-sm text-gray-700">인허가 자료 보유</span>
                    </label>
                  </div>
                </section>

                {/* ─ 물류 정보 (접이식) ─ */}
                <section>
                  <button
                    type="button"
                    onClick={() => setShowLogistics(v => !v)}
                    className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1"
                  >
                    <span>물류 정보</span>
                    <span className="text-gray-300">{showLogistics ? '▲' : '▼'}</span>
                  </button>
                  {showLogistics && (
                    <div className="flex flex-col gap-3 mt-3">
                      <Field label="용량/단위 스펙">
                        <input type="text" value={form.unit_spec} onChange={setTextField('unit_spec')}
                          placeholder="예: 50ml, 30g" className={inputCls} />
                      </Field>
                      <Field label="카튼당 입수량 (pcs)">
                        <input type="number" value={form.pcs_per_carton} onChange={setTextField('pcs_per_carton')}
                          min="0" className={inputCls} />
                      </Field>
                      <Field label="카튼 중량 (kg)">
                        <input type="number" value={form.outbox_weight_kg} onChange={setTextField('outbox_weight_kg')}
                          min="0" step="0.01" className={inputCls} />
                      </Field>
                      <Field label="카튼 사이즈 (mm)">
                        <input type="text" value={form.outbox_size_mm} onChange={setTextField('outbox_size_mm')}
                          placeholder="예: 400x300x250" className={inputCls} />
                      </Field>
                      <Field label="CBM">
                        <input type="number" value={form.cbm} onChange={setTextField('cbm')}
                          min="0" step="0.0001" className={inputCls} />
                      </Field>
                    </div>
                  )}
                </section>

                {/* ─ 메모 ─ */}
                <section>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">메모</p>
                  <textarea
                    value={form.notes}
                    onChange={setTextField('notes')}
                    rows={3}
                    placeholder="공급가 변경 이유, 참고사항 등"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none"
                  />
                </section>

                <div className="flex flex-col gap-2 pt-1">
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={saving}
                      onClick={() => setSubmitMode('save')}
                      className="flex-1 rounded-lg bg-black text-white py-2 text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors"
                    >
                      {saving && submitMode === 'save' ? '저장 중...' : '저장'}
                    </button>
                    <button type="button" onClick={cancelForm}
                      className="flex-1 rounded-lg border border-gray-300 text-gray-700 py-2 text-sm hover:bg-gray-50 transition-colors">
                      취소
                    </button>
                  </div>
                  {isCreating && (
                    <button
                      type="submit"
                      disabled={saving}
                      onClick={() => setSubmitMode('continue')}
                      className="w-full rounded-lg border border-black text-black py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
                    >
                      {saving && submitMode === 'continue' ? '저장 중...' : '저장 후 계속 등록'}
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── 공통 스타일 ──
const inputCls = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black'
const selectCls = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white'

function Field({ label, required, children }: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}
