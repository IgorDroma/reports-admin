// pages/admin/acts/index.js
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../../lib/supabaseClient'

export default function ActsList() {
  const router = useRouter()
  const [user, setUser] = useState(null)

  const [acts, setActs] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const [page, setPage] = useState(0)
  const pageSize = 50

  // Filters
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [receiver, setReceiver] = useState('')
  const [actId, setActId] = useState('')

  // Items modal
  const [itemsModalOpen, setItemsModalOpen] = useState(false)
  const [itemsModalAct, setItemsModalAct] = useState(null)
  const [itemsModalItems, setItemsModalItems] = useState([])
  const [itemsModalLoading, setItemsModalLoading] = useState(false)

  // Photos modal
  const [photoModalOpen, setPhotoModalOpen] = useState(false)
  const [photoModalImages, setPhotoModalImages] = useState([])

  // AUTH
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data?.user ?? null))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) =>
      setUser(session?.user ?? null)
    )
    return () => listener?.subscription?.unsubscribe?.()
  }, [])

  // Load acts
  useEffect(() => {
    if (!user) return
    loadActs()
  }, [user, page])

  async function loadActs() {
    setLoading(true)
    setError(null)

    try {
      let query = supabase
        .from('acts')
        .select('*', { count: 'exact' })
        .order('act_date', { ascending: false })
        .range(page * pageSize, page * pageSize + pageSize - 1)

      if (dateFrom) query = query.gte('act_date', dateFrom)
      if (dateTo) query = query.lte('act_date', dateTo + ' 23:59:59')
      if (receiver) query = query.ilike('receiver', `%${receiver}%`)
      if (actId) query = query.ilike('id', `%${actId}%`)

      const { data, error } = await query
      if (error) throw error

      setActs(data || [])

    } catch (err) {
      console.error(err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function openPhotoModal(images) {
    setPhotoModalImages(images || [])
    setPhotoModalOpen(true)
  }

  async function openItemsModal(act) {
    setItemsModalAct(act)
    setItemsModalItems([])
    setItemsModalLoading(true)
    setItemsModalOpen(true)

    const { data, error } = await supabase
      .from('act_items')
      .select(`
        id,
        qty,
        price,
        sum,
        products (
          name,
          product_categories (name)
        )
      `)
      .eq('act_id', act.id)
      .order('created_at')

    if (error) {
      console.error(error)
      setItemsModalItems([])
    } else {
      const mapped = data.map(row => ({
        id: row.id,
        qty: row.qty,
        price: row.price,
        sum: row.sum,
        product_name: row.products?.name || '',
        category: row.products?.product_categories?.name || ''
      }))
      setItemsModalItems(mapped)
    }

    setItemsModalLoading(false)
  }

  async function deleteAct(act) {
    if (!confirm(`Видалити акт ${act.id}?`)) return

    await supabase.from("acts").delete().eq("id", act.id)
    await loadActs()
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Please sign in → <a href="/" className="underline text-blue-600">Login</a></p>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto p-6">

      {/* HEADER */}
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Акти</h1>
        <button
          className="bg-gray-200 px-3 py-1 rounded"
          onClick={() => router.push('/admin/acts/import')}
        >
          Імпорт JSON
        </button>
      </div>

      {/* FILTERS */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
        <div>
          <label className="block text-sm mb-1">Дата від</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-full border rounded px-2 py-1" />
        </div>
        <div>
          <label className="block text-sm mb-1">Дата до</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-full border rounded px-2 py-1" />
        </div>
        <div>
          <label className="block text-sm mb-1">Отримувач</label>
          <input type="text" value={receiver} onChange={e => setReceiver(e.target.value)} className="w-full border rounded px-2 py-1" />
        </div>
        <div>
          <label className="block text-sm mb-1">ID акту</label>
          <input type="text" value={actId} onChange={e => setActId(e.target.value)} className="w-full border rounded px-2 py-1" />
        </div>
        <div className="flex items-end">
          <button className="bg-blue-500 text-white px-3 py-2 rounded w-full" onClick={() => { setPage(0); loadActs() }}>
            Застосувати
          </button>
        </div>
      </div>

      {/* TABLE */}
      <div className="overflow-x-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-2 py-2 text-left">Дата</th>
              <th className="px-2 py-2 text-left">ID акту</th>
              <th className="px-2 py-2 text-left">Отримувач</th>
              <th className="px-2 py-2 text-left">Фото</th>
              <th className="px-2 py-2 text-left">Дії</th>
            </tr>
          </thead>
          <tbody>

          {loading ? (
            <tr><td colSpan={5} className="text-center py-3">Завантаження...</td></tr>
          ) : acts.length === 0 ? (
            <tr><td colSpan={5} className="text-center py-3">Немає актів</td></tr>
          ) : (
            acts.map(act => (
              <tr key={act.id} className="border-t">

                <td className="px-2 py-1">{act.act_date ? new Date(act.act_date).toLocaleDateString("uk-UA") : ""}</td>
                <td className="px-2 py-1">{act.id}</td>
                <td className="px-2 py-1">{act.receiver}</td>

                <td className="px-2 py-1">
                  {Array.isArray(act.photo_urls) && act.photo_urls.length > 0 ? (
                    <button className="underline text-blue-600" onClick={() => openPhotoModal(act.photo_urls)}>
                      🖼️ {act.photo_urls.length > 1 ? `x${act.photo_urls.length}` : ""}
                    </button>
                  ) : ""}
                </td>

                <td className="px-2 py-1 space-x-2">
                  <button className="text-blue-600 underline" onClick={() => openItemsModal(act)}>
                    Товари
                  </button>

                  <button className="text-red-600 underline" onClick={() => deleteAct(act)}>
                    Видалити
                  </button>
                </td>

              </tr>
            ))
          )}

          </tbody>
        </table>
      </div>

      {/* PAGINATION */}
      <div className="flex justify-between items-center mt-4">
        <button disabled={page===0} onClick={() => setPage(p => Math.max(0, p-1))} className="px-3 py-1 border rounded disabled:opacity-40">
          ← Назад
        </button>
        <span>Сторінка {page+1}</span>
        <button onClick={() => setPage(p => p+1)} className="px-3 py-1 border rounded">
          Вперед →
        </button>
      </div>

      {/* ITEMS MODAL */}
      {itemsModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-4 max-w-3xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-lg font-bold">Товари акту {itemsModalAct?.id}</h2>
              <button className="text-red-500 text-xl" onClick={() => setItemsModalOpen(false)}>✕</button>
            </div>

            {itemsModalLoading ? (
              <p>Завантаження...</p>
            ) : itemsModalItems.length === 0 ? (
              <p>Немає товарів</p>
            ) : (
              <table className="min-w-full text-sm border">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-2 py-1 text-left">Назва</th>
                    <th className="px-2 py-1 text-left">Категорія</th>
                    <th className="px-2 py-1 text-right">Кількість</th>
                    <th className="px-2 py-1 text-right">Сума</th>
                  </tr>
                </thead>
                <tbody>
                  {itemsModalItems.map(it => (
                    <tr key={it.id} className="border-t">
                      <td className="px-2 py-1">{it.product_name}</td>
                      <td className="px-2 py-1">{it.category}</td>
                      <td className="px-2 py-1 text-right">{it.qty}</td>
                      <td className="px-2 py-1 text-right">{it.sum.toLocaleString("uk-UA")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* PHOTO MODAL */}
      {photoModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-4 rounded-lg max-w-3xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-xl font-bold">Фото акту</h2>
              <button className="text-red-500 text-lg" onClick={() => setPhotoModalOpen(false)}>✕</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {photoModalImages.map((url, index) => (
                <a key={index} href={url} target="_blank">
                  <img src={url} className="w-full max-h-64 object-cover rounded border" />
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
