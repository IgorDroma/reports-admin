// pages/admin/acts/import.js
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../../lib/supabaseClient'

function mapReceiver(rec, recGroup) {
  switch (recGroup) {
    case 'Отримувачі благодійної допомоги юр. лица':
      return { allowed: true, receiver: rec }

    case 'Індивідуальні ВЧ':
      return { allowed: true, receiver: 'Військовослужбовець індивідуально' }

    case 'Дети и мед. гражданские, старики':
      return { allowed: true, receiver: 'Допомога цивільним' }

    default:
      return { allowed: false, receiver: null }
  }
}

export default function ActsImport() {
  const router = useRouter()
  const [user, setUser] = useState(null)

  const [fileName, setFileName] = useState('')
  const [jsonData, setJsonData] = useState(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  // -------------------------------
  // AUTH
  // -------------------------------
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data?.user ?? null))

    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) =>
      setUser(session?.user ?? null)
    )

    return () => listener?.subscription?.unsubscribe?.()
  }, [])

  if (!user) {
    return (
      <div className="page">
        <p>Будь ласка, увійдіть у систему.</p>
      </div>
    )
  }

  // -------------------------------
  // FILE LOAD
  // -------------------------------
  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    setError('')
    setResult(null)

    if (!file) {
      setFileName('')
      setJsonData(null)
      return
    }

    setFileName(file.name)

    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      const arr = Array.isArray(parsed) ? parsed : [parsed]
      setJsonData(arr)
    } catch (err) {
      console.error(err)
      setError('Не вдалося прочитати JSON: ' + err.message)
      setJsonData(null)
    }
  }

  // -------------------------------
  // CATEGORY
  // -------------------------------
  async function findOrCreateCategory(name) {
    if (!name || !name.trim()) return null

    const trimmed = name.trim()

    let { data, error } = await supabase
      .from('product_categories')
      .select('id')
      .eq('name', trimmed)
      .limit(1)

    if (error) throw error
    if (data?.[0]) return data[0].id

    const { data: created, error: createErr } = await supabase
      .from('product_categories')
      .insert({ name: trimmed })
      .select()
      .single()

    if (createErr) throw createErr
    return created.id
  }

  // -------------------------------
  // PRODUCT (FIXED!)
  // -------------------------------
  async function findOrCreateProduct(item) {
    let { data, error } = await supabase
      .from('products')
      .select('id')
      .eq('product_id', item.product_id) // ← ГОЛОВНЕ ВИПРАВЛЕННЯ
      .limit(1)

    if (error) throw error

    if (data?.[0]) return data[0].id

    let categoryId = null
    if (item.product_cat?.trim()) {
      categoryId = await findOrCreateCategory(item.product_cat)
    }

    const { data: created, error: createErr } = await supabase
      .from('products')
      .insert({
        product_id: item.product_id,   // ← ГОЛОВНЕ ВИПРАВЛЕННЯ
        name: item.product_name,
        category_id: categoryId
      })
      .select()
      .single()

    if (createErr) throw createErr
    return created.id
  }

  // -------------------------------
  // IMPORT ONE ACT
  // -------------------------------
  async function importAct(actJson, batchId) {
    const mapped = mapReceiver(actJson.receiver, actJson.receiver_group)
    if (!mapped.allowed) return { skipped: true }

    const receiverFinal = mapped.receiver
    const items = actJson.items || []

    const total_sum = actJson.total_sum ?? items.reduce((s, it) => s + Number(it.sum || 0), 0)
    const items_count = items.length

    // Перевіряємо, чи існує акт
    const { data: existingRows, error: selectErr } = await supabase
      .from('acts')
      .select('id')
      .eq('id', actJson.id)
      .limit(1)

    if (selectErr) throw selectErr

    const exists = existingRows?.[0]

    const actPayload = {
      id: actJson.id,
      act_date: actJson.date,
      receiver: receiverFinal,
      total_sum,
      items_count,
      imported_batch_id: batchId // ← ВАЖЛИВО
    }

    if (!exists) {
      const { error: insertErr } = await supabase.from('acts').insert(actPayload)
      if (insertErr) throw insertErr
    } else {
      // update
      const { error: updateErr } = await supabase
        .from('acts')
        .update(actPayload)
        .eq('id', actJson.id)

      if (updateErr) throw updateErr

      // delete old items
      const { error: delErr } = await supabase
        .from('act_items')
        .delete()
        .eq('act_id', actJson.id)

      if (delErr) throw delErr
    }

    // Add items
    for (const item of items) {
      const productId = await findOrCreateProduct(item)

      const qty = Number(item.qty || 0)
      const sum = Number(item.sum || 0)
      const price = qty ? sum / qty : 0

      const { error: itemErr } = await supabase.from('act_items').insert({
        act_id: actJson.id,
        product_id: productId,
        qty,
        price,
        sum
      })

      if (itemErr) throw itemErr
    }

    return { skipped: false }
  }

  // -------------------------------
  // IMPORT ALL
  // -------------------------------
  async function handleImport() {
    setError('')
    setResult(null)

    if (!jsonData?.length) {
      setError('Спочатку завантаж файл JSON')
      return
    }

    setImporting(true)

    const batchId = crypto.randomUUID()
    let imported = 0
    let skipped = []

    try {
      for (const act of jsonData) {
        const res = await importAct(act, batchId)

        if (res.skipped) skipped.push(act.id)
        else imported++
      }

      // LOG IMPORT
      await supabase.from('acts_imports').insert({
        batch_id: batchId,
        file_name: fileName,
        user_id: user.id,
        inserted_count: imported,
        skipped_count: skipped.length
      })

      setResult({
        imported,
        skipped,
        skipped_count: skipped.length
      })
    } catch (err) {
      console.error(err)
      setError('Помилка імпорту: ' + err.message)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="page">

      <button className="underline mb-3" onClick={() => router.back()}>
        ← Назад
      </button>

      <h1 className="title mb-4">Імпорт актів (JSON)</h1>

      {error && <p className="text-red-600 mb-4">Помилка: {error}</p>}

      <div className="mb-4">
        <label className="label">Файл JSON</label>
        <input type="file" accept=".json" onChange={handleFileChange} />

        {fileName && <p className="text-sm mt-1">Обраний файл: {fileName}</p>}
        {jsonData && <p className="text-sm">Актів у файлі: {jsonData.length}</p>}
      </div>

      <button
        className="btn-primary"
        disabled={importing || !jsonData}
        onClick={handleImport}
      >
        {importing ? 'Імпорт...' : 'Імпортувати'}
      </button>

      {result && (
        <div className="totals-box mt-4">
          <h2 className="text-lg font-bold mb-2">Результат імпорту</h2>

          <p>Імпортовано актів: {result.imported}</p>
          <p>Пропущено актів: {result.skipped_count}</p>

          {result.skipped_count > 0 && (
            <pre className="mt-2 p-2 bg-gray-100 rounded" style={{ maxHeight: 200, overflow: 'auto' }}>
              {result.skipped.join('\n')}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}
