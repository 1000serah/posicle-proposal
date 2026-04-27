'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

const CATEGORIES = [
  'Skincare',
  'Makeup',
  'Haircare',
  'Bodycare',
  'Food',
  'Health Supplement',
  'Kids',
  'Clinic / Aesthetic',
  'Lifestyle',
  'Other',
]

type Brand = {
  id: string
  brand_name: string
  supplier_name: string | null
  country: string
  category: string | null
  contact_person: string | null
  contact_info: string | null
  notes: string | null
  is_active: boolean
}

const emptyForm = {
  brand_name: '',
  supplier_name: '',
  country: 'Korea',
  category: '',
  contact_person: '',
  contact_info: '',
  notes: '',
}

type Message = { type: 'success' | 'error'; text: string }

export default function BrandsPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [pageLoading, setPageLoading] = useState(true)

  const [brands, setBrands] = useState<Brand[]>([])
  const [showHidden, setShowHidden] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<Message | null>(null)

  // 다중 선택
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace('/login')
      } else {
        setUser(session.user)
        setPageLoading(false)
        fetchBrands()
      }
    })
  }, [router])

  async function fetchBrands() {
    const { data } = await supabase
      .from('brands')
      .select('id, brand_name, supplier_name, country, category, contact_person, contact_info, notes, is_active')
      .order('brand_name', { ascending: true })
    if (data) setBrands(data)
  }

  const visibleBrands = brands.filter(b => showHidden ? !b.is_active : b.is_active)
  const allSelected = visibleBrands.length > 0 && visibleBrands.every(b => selectedIds.has(b.id))

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(visibleBrands.map(b => b.id)))
    }
  }

  function clearSelection() {
    setSelectedIds(new Set())
  }

  function switchView(hidden: boolean) {
    setShowHidden(hidden)
    cancelForm()
    clearSelection()
  }

  function startCreate() {
    setEditingId(null)
    setIsCreating(true)
    setForm(emptyForm)
    setMessage(null)
  }

  function startEdit(brand: Brand) {
    setIsCreating(false)
    setEditingId(brand.id)
    setForm({
      brand_name: brand.brand_name,
      supplier_name: brand.supplier_name ?? '',
      country: brand.country,
      category: brand.category ?? '',
      contact_person: brand.contact_person ?? '',
      contact_info: brand.contact_info ?? '',
      notes: brand.notes ?? '',
    })
    setMessage(null)
  }

  function cancelForm() {
    setEditingId(null)
    setIsCreating(false)
    setForm(emptyForm)
    setMessage(null)
  }

  function setField(key: keyof typeof emptyForm) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage(null)

    const payload = {
      brand_name: form.brand_name.trim(),
      supplier_name: form.supplier_name.trim() || null,
      country: form.country.trim() || 'Korea',
      category: form.category || null,
      contact_person: form.contact_person.trim() || null,
      contact_info: form.contact_info.trim() || null,
      notes: form.notes.trim() || null,
    }

    if (isCreating) {
      const { error } = await supabase
        .from('brands')
        .insert({ ...payload, created_by: user?.id, is_active: true })
      if (error) {
        setMessage({ type: 'error', text: '저장에 실패했습니다.' })
      } else {
        setMessage({ type: 'success', text: '브랜드가 등록됐습니다.' })
        cancelForm()
        fetchBrands()
      }
    } else if (editingId) {
      const { error } = await supabase
        .from('brands')
        .update(payload)
        .eq('id', editingId)
      if (error) {
        setMessage({ type: 'error', text: '수정에 실패했습니다.' })
      } else {
        setMessage({ type: 'success', text: '수정됐습니다.' })
        cancelForm()
        fetchBrands()
      }
    }

    setSaving(false)
  }

  async function handleHide(id: string) {
    const { error } = await supabase
      .from('brands')
      .update({ is_active: false })
      .eq('id', id)
    if (!error) {
      if (editingId === id) cancelForm()
      setSelectedIds(prev => { const next = new Set(prev); next.delete(id); return next })
      fetchBrands()
    }
  }

  async function handleActivate(id: string) {
    const { error } = await supabase
      .from('brands')
      .update({ is_active: true })
      .eq('id', id)
    if (!error) {
      setSelectedIds(prev => { const next = new Set(prev); next.delete(id); return next })
      fetchBrands()
    }
  }

  async function handleBulkHide() {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    const { error } = await supabase
      .from('brands')
      .update({ is_active: false })
      .in('id', ids)
    if (error) {
      setMessage({ type: 'error', text: '일괄 처리에 실패했습니다.' })
    } else {
      if (editingId && ids.includes(editingId)) cancelForm()
      setMessage({ type: 'success', text: `${ids.length}개 브랜드를 숨겼습니다.` })
      clearSelection()
      fetchBrands()
    }
  }

  async function handleBulkActivate() {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    const { error } = await supabase
      .from('brands')
      .update({ is_active: true })
      .in('id', ids)
    if (error) {
      setMessage({ type: 'error', text: '일괄 처리에 실패했습니다.' })
    } else {
      setMessage({ type: 'success', text: `${ids.length}개 브랜드를 활성화했습니다.` })
      clearSelection()
      fetchBrands()
    }
  }

  if (pageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-400">로딩 중...</p>
      </div>
    )
  }

  const showForm = isCreating || editingId !== null

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <a href="/" className="text-gray-500 hover:text-gray-900">대시보드</a>
          <span className="text-gray-300">/</span>
          <span className="font-semibold text-gray-900">브랜드/공급사</span>
        </div>
        <span className="text-sm text-gray-500">{user?.email}</span>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-6 flex gap-6 items-start">

        {/* Left: List */}
        <div className="flex-1 min-w-0">

          {/* List header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-semibold text-gray-900">
                {showHidden ? '숨긴 브랜드' : '브랜드 목록'}
              </h2>
              <button
                onClick={() => switchView(!showHidden)}
                className="text-xs text-gray-400 underline hover:text-gray-700"
              >
                {showHidden ? '활성 브랜드 보기' : '숨긴 브랜드 보기'}
              </button>
            </div>
            {!showHidden && (
              <button
                onClick={startCreate}
                className="rounded-lg bg-black text-white text-sm px-4 py-2 hover:bg-gray-800 transition-colors"
              >
                + 새 브랜드 등록
              </button>
            )}
          </div>

          {/* 메시지 */}
          {message && (
            <div className={`mb-3 rounded-lg px-4 py-2 text-sm ${
              message.type === 'success'
                ? 'bg-green-50 text-green-700'
                : 'bg-red-50 text-red-700'
            }`}>
              {message.text}
            </div>
          )}

          {/* 일괄 처리 바 */}
          {selectedIds.size > 0 && (
            <div className="mb-3 flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
              <span className="text-sm text-blue-700 font-medium">
                {selectedIds.size}개 선택됨
              </span>
              <button
                onClick={showHidden ? handleBulkActivate : handleBulkHide}
                className={`text-sm font-medium px-3 py-1 rounded-lg transition-colors ${
                  showHidden
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-800 text-white hover:bg-black'
                }`}
              >
                {showHidden ? '일괄 재활성화' : '일괄 숨기기'}
              </button>
              <button
                onClick={clearSelection}
                className="text-xs text-blue-500 hover:text-blue-700"
              >
                선택 해제
              </button>
            </div>
          )}

          {/* 목록 */}
          {visibleBrands.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 px-6 py-12 text-center">
              <p className="text-sm text-gray-400">
                {showHidden ? '숨긴 브랜드가 없습니다.' : '등록된 브랜드가 없습니다.'}
              </p>
            </div>
          ) : (
            <>
              {/* 전체 선택 */}
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
                {visibleBrands.map(brand => (
                  <div
                    key={brand.id}
                    className={`bg-white rounded-xl border px-4 py-4 flex items-start gap-3 transition-colors ${
                      editingId === brand.id
                        ? 'border-black ring-1 ring-black'
                        : selectedIds.has(brand.id)
                          ? 'border-blue-300 bg-blue-50/30'
                          : 'border-gray-200'
                    }`}
                  >
                    {/* 체크박스 */}
                    <input
                      type="checkbox"
                      checked={selectedIds.has(brand.id)}
                      onChange={() => toggleSelect(brand.id)}
                      className="mt-0.5 w-4 h-4 accent-black cursor-pointer shrink-0"
                    />

                    {/* 브랜드 정보 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm text-gray-900">
                          {brand.brand_name}
                        </span>
                        {brand.category && (
                          <span className="text-xs bg-gray-100 text-gray-600 rounded px-2 py-0.5">
                            {brand.category}
                          </span>
                        )}
                      </div>
                      {brand.supplier_name && (
                        <p className="text-xs text-gray-500 mt-0.5">{brand.supplier_name}</p>
                      )}
                      {brand.country !== 'Korea' && (
                        <p className="text-xs text-gray-400 mt-0.5">{brand.country}</p>
                      )}
                      {brand.contact_person && (
                        <p className="text-xs text-gray-400 mt-0.5">담당: {brand.contact_person}</p>
                      )}
                    </div>

                    {/* 액션 버튼 */}
                    <div className="flex items-center gap-3 shrink-0">
                      {showHidden ? (
                        <button
                          onClick={() => handleActivate(brand.id)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                          다시 활성화
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => startEdit(brand)}
                            className="text-xs text-gray-600 hover:text-gray-900"
                          >
                            수정
                          </button>
                          <button
                            onClick={() => handleHide(brand.id)}
                            className="text-xs text-gray-400 hover:text-red-500"
                          >
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

        {/* Right: Form */}
        {showForm && (
          <div className="w-80 shrink-0">
            <div className="bg-white rounded-xl border border-gray-200 p-5 sticky top-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-1">
                {isCreating ? '새 브랜드 등록' : '브랜드 수정'}
              </h3>
              {editingId && (
                <p className="text-xs text-gray-400 mb-4">수정 중: {form.brand_name}</p>
              )}
              {isCreating && <div className="mb-4" />}

              <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    브랜드명 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.brand_name}
                    onChange={setField('brand_name')}
                    required
                    placeholder="예: ANGELS LIQUID"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">공급사명</label>
                  <input
                    type="text"
                    value={form.supplier_name}
                    onChange={setField('supplier_name')}
                    placeholder="예: (주)엔젤스리퀴드"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">카테고리</label>
                  <select
                    value={form.category}
                    onChange={setField('category')}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white"
                  >
                    <option value="">선택 안 함</option>
                    {CATEGORIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">국가</label>
                  <input
                    type="text"
                    value={form.country}
                    onChange={setField('country')}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">담당자</label>
                  <input
                    type="text"
                    value={form.contact_person}
                    onChange={setField('contact_person')}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">연락처</label>
                  <input
                    type="text"
                    value={form.contact_info}
                    onChange={setField('contact_info')}
                    placeholder="이메일 또는 전화번호"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">메모</label>
                  <textarea
                    value={form.notes}
                    onChange={setField('notes')}
                    rows={3}
                    placeholder="한국어명, 내부 별칭, 참고사항 등"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none"
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 rounded-lg bg-black text-white py-2 text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors"
                  >
                    {saving ? '저장 중...' : '저장'}
                  </button>
                  <button
                    type="button"
                    onClick={cancelForm}
                    className="flex-1 rounded-lg border border-gray-300 text-gray-700 py-2 text-sm hover:bg-gray-50 transition-colors"
                  >
                    취소
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
