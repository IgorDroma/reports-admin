// pages/admin/acts/import.js
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../../lib/supabaseClient'

function mapReceiver(rec, recGroup) {
  switch (recGroup) {
    case 'Отримувачі благодійної допомоги юр. лица':
      return { allowed: true, receiver: rec }

    case 'Індивідуальні ВЧ':
      return { allowed: true, receiver: 'Військово службовець індивідуально' }

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

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data?.user ?? null))
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
    })
    return () => listener?.subscription?.unsubscribe?.()
  }, [])

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-lg">
          Please sign in on{' '}
          <a href="/" className="text-blue-500 underline">login</a>
        </p>
      </div>
    )
  }

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

  async function findOrCreateCategory(name) {
    if (!name || !name.trim()) return null

    let { data, error } = await supabase
      .from('product_categories')
      .select('id')
      .eq('name', name.trim())
      .limit(1)

    if (error) throw error

    const existing = data?.[0]
    if (existing) return existing.id

    const { data: created, error: createError } = await supabase
      .from('product_categories')
      .insert({ name: name.trim() })
      .select()
      .single()

    if (createError) throw createError
    return created.id
  }

  async function findOrCreateProduct(item) {
    // item: { product_id, product_name, product_cat, ... }
    let { data, error } = await supabase
      .from('products')
      .select('id')
      .eq('id', item.product_id)
      .limit(1)

    if (error) throw error

    const existing = data?.[0]
    if (existing) return existing.id

    let categoryId = null
    if (item.product_cat && item.product_cat.trim()) {
      categoryId = await findOrCreateCategory(item.product_cat)
    }

    const { data: created, error: createError } = await supabase
      .from('products')
      .insert({
        id: item.product_id,
        name: item.product_name,
        category_id: categoryId
      })
      .select()
      .single()

    if (createError) throw createError
    return created.id
  }

  async function importAct(actJson) {
    const mapped = mapReceiver(actJson.receiver, actJson.receiver_group)

    if (!mapped.allowed) {
      return { skipped: true }
    }

    const receiverFinal = mapped.receiver
    const items = actJson.items || []

    // суму беремо з total_sum або рахуємо з items
    const itemsSum = items.reduce((s, it) => s + Number(it.sum || 0), 0)
    const total_sum = actJson.total_sum != null ? actJson.total_sum : itemsSum
    const items_count = items.length

    // чи існує акт з таким id
    let { data: actRows, error: actSelectError } = await supabase
      .from('acts')
      .select('id')
      .eq('id', actJson.id)
      .limit(1)

    if (actSelectError) throw actSelectError

    const existingAct = actRows?.[0]

    const actPayload = {
      id: actJson.id,
      act_date: actJson.date, // рядок ISO, PG сам розпарсить
      receiver: receiverFinal,
      total_sum,
      items_count
    }

    if (!existingAct) {
      const { error: insertError } = await supabase
        .from('acts')
        .insert(actPayload)

      if (insertError) throw insertError
    } else {
      // оновлюємо акт
      const { error: updateError } = await supabase
        .from('acts')
        .update(actPayload)
        .eq('id', actJson.id)

      if (updateError) throw updateError

      // чистимо старі позиції
      const { error: delError } = await supabase
        .from('act_items')
        .delete()
        .eq('act_id', actJson.id)

      if (delError) throw delError
    }

    // тепер додаємо позиції
    for (const item of items) {
      const productId = await findOrCreateProduct(item)

      const qty = Number(item.qty || 0)
      const sum = Number(item.sum || 0)
      const price = qty !== 0 ? sum / qty : Number(item.price || 0)

      const { error: itemError } = await supabase.from('act_items').insert({
        act_id: actJson.id,
        product_id: productId,
        qty,
        price,
        sum
      })

      if (itemError) throw itemError
    }

    return { skipped: false }
  }

  async function handleImport() {
    setError('')
    setResult(null)

    if (!jsonData || jsonData.length === 0) {
      setError('Спочатку завантаж файл JSON')
      return
    }

    setImporting(true)

    try {
      const skipped = []
      let imported = 0

      for (const act of jsonData) {
        const res = await importAct(act)
        if (res.skipped) {
          skipped.push(act.id)
        } else {
          imported++
        }
      }

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
    <div className="max-w-3xl mx-auto p-6">
      <button className="mb-4 underline" onClick={() => router.back()}>
        ← Назад
      </button>

      <h1 className="text-2xl font-bold mb-4">Імпорт актів (JSON)</h1>

      {error && <p className="mb-3 text-red-600">Помилка: {error}</p>}

      <div className="mb-4 space-y-2">
        <div>
          <label className="block mb-1 font-medium">Файл JSON</label>
          <input type="file" accept=".json,application/json" onChange={handleFileChange} />
          {fileName && (
            <p className="text-sm text-gray-600 mt-1">Обраний файл: {fileName}</p>
          )}
        </div>
        {jsonData && (
          <p className="text-sm text-gray-700">
            Виявлено записів актів у файлі: {jsonData.length}
          </p>
        )}
      </div>

      <button
        className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-60"
        disabled={importing || !jsonData}
        onClick={handleImport}
      >
        {importing ? 'Імпорт...' : 'Імпортувати'}
      </button>

      {result && (
        <div className="mt-6 border rounded p-4 bg-gray-50">
          <h2 className="text-lg font-semibold mb-2">Результат</h2>
          <p>Імпортовано актів: {result.imported}</p>
          <p>Пропущено актів: {result.skipped_count}</p>

          {result.skipped_count > 0 && (
            <div className="mt-2">
              <p className="font-medium text-sm">ID пропущених актів:</p>
              <pre className="text-xs bg-white border rounded p-2 mt-1 max-h-40 overflow-auto">
                {result.skipped.join('\n')}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
