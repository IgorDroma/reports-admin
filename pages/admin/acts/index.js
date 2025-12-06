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

  // Modals
  const [itemsModalOpen, setItemsModalOpen] = useState(false)
  const [itemsModalAct, setItemsModalAct] = useState(null)
  const [itemsModalItems, setItemsModalItems] = useState([])
  const [itemsModalLoading, setItemsModalLoading] = useState(false)
  
  const [photoModalActId, setPhotoModalActId] = useState(null)
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
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }


  function openPhotoModal(images, actId) {
  setPhotoModalImages(images);
  setPhotoModalActId(actId);
  setPhotoModalOpen(true);
}

  async function handlePhotoUpload(e) {
  const files = e.target.files;
  if (!files || files.length === 0) return;

  const actId = photoModalActId;
  let newUrls = [...photoModalImages];

  for (const file of files) {
    const ext = file.name.split('.').pop();
    const fileName = `${actId}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.${ext}`;

    const filePath = `${actId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("acts-files")
      .upload(filePath, file);

    if (uploadError) {
      alert("Помилка завантаження");
      return;
    }

    const { data } = supabase.storage
      .from("acts-files")
      .getPublicUrl(filePath);

    newUrls.push(data.publicUrl);
  }

  // update DB
  await supabase
    .from("acts")
    .update({ photo_urls: newUrls })
    .eq("id", actId);

  // update modal state
  setPhotoModalImages(newUrls);
}

  async function handleDeletePhoto(url) {
  if (!confirm("Видалити фото?")) return;

  const actId = photoModalActId;

  // Extract actual path from public URL
  const path = url.split("/storage/v1/object/public/acts-files/")[1];

  await supabase.storage
    .from("acts-files")
    .remove([path]);

  const newList = photoModalImages.filter(u => u !== url);

  await supabase
    .from("acts")
    .update({ photo_urls: newList })
    .eq("id", actId);

  setPhotoModalImages(newList);
}


  async function openItemsModal(act) {
    setItemsModalAct(act)
    setItemsModalLoading(true)
    setItemsModalOpen(true)

    const { data, error } = await supabase
      .from('act_items')
      .select(`
        id,
        qty,
        sum,
        products (
          name,
          product_categories(name)
        )
      `)
      .eq('act_id', act.id)

    if (!error) {
      setItemsModalItems(
        (data || []).map(item => ({
          id: item.id,
          qty: item.qty,
          sum: item.sum,
          product_name: item.products?.name,
          category: item.products?.product_categories?.name || ''
        }))
      )
    }

    setItemsModalLoading(false)
  }


  // ========== RENDER ==========
  return (
    <div className="min-h-screen bg-gray-100 p-6">

      {/* Card */}
      <div className="max-w-7xl mx-auto bg-white shadow-lg rounded-xl p-6">

        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">Акти</h1>

          <button
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"
            onClick={() => router.push('/admin/import-json')}
          >
            Імпорт JSON
          </button>
        </div>


        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          
          <div>
            <label className="text-sm font-medium text-gray-700">Дата від</label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Дата до</label>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Отримувач</label>
            <input
              type="text"
              value={receiver}
              onChange={e => setReceiver(e.target.value)}
              placeholder="Пошук..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">ID Акту</label>
            <input
              type="text"
              value={actId}
              onChange={e => setActId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={() => { setPage(0); loadActs() }}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"
            >
              Застосувати
            </button>
          </div>
        </div>


        {/* Table */}
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-700 uppercase text-xs">
              <tr>
                <th className="px-4 py-3">Дата</th>
                <th className="px-4 py-3">ID акту</th>
                <th className="px-4 py-3">Отримувач</th>
                <th className="px-4 py-3">Фото</th>
                <th className="px-4 py-3">Дії</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="text-center py-4">Завантаження…</td></tr>
              ) : acts.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-4">Немає актів</td></tr>
              ) : (
                acts.map(act => (
                  <tr key={act.id} className="border-t hover:bg-gray-50 transition">
                    <td className="px-4 py-2">{new Date(act.act_date).toLocaleDateString('uk-UA')}</td>
                    <td className="px-4 py-2 font-mono">{act.id}</td>
                    <td className="px-4 py-2">{act.receiver}</td>

                    <td className="px-4 py-2">
                      {Array.isArray(act.photo_urls) && act.photo_urls.length > 0 ? (
                        <button
                          className="text-blue-600 underline hover:text-blue-800"
                          onClick={() => openPhotoModal(act.photo_urls, act.id)}
                        >
                          🖼️ {act.photo_urls.length > 1 ? `x${act.photo_urls.length}` : ""}
                        </button>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>

                    <td className="px-4 py-2">
                      <button
                        className="text-blue-600 underline hover:text-blue-800 mr-3"
                        onClick={() => openItemsModal(act)}
                      >
                        Товари
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>


        {/* Pagination */}
        <div className="flex justify-between items-center mt-6">
          <button
            disabled={page === 0}
            onClick={() => setPage(p => Math.max(0, p - 1))}
            className="px-4 py-2 border rounded-lg disabled:opacity-40 bg-white hover:bg-gray-50 transition"
          >
            ← Назад
          </button>

          <span className="text-gray-600">Сторінка {page + 1}</span>

          <button
            onClick={() => setPage(p => p + 1)}
            className="px-4 py-2 border rounded-lg bg-white hover:bg-gray-50 transition"
          >
            Вперед →
          </button>
        </div>

      </div>



      {/* ============================
          MODAL — ITEMS
      ============================ */}
      {itemsModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-3xl w-full max-h-[80vh] overflow-auto">

            <div className="flex justify-between mb-4">
              <h2 className="text-xl font-semibold">
                Товари акту {itemsModalAct?.id}
              </h2>
              <button onClick={() => setItemsModalOpen(false)} className="text-red-500 text-2xl">✕</button>
            </div>

            {itemsModalLoading ? (
              <p>Завантаження...</p>
            ) : itemsModalItems.length === 0 ? (
              <p>Немає товарів</p>
            ) : (
              <table className="w-full text-sm border rounded">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-3 py-2 text-left">Назва</th>
                    <th className="px-3 py-2 text-left">Категорія</th>
                    <th className="px-3 py-2 text-right">Кількість</th>
                    <th className="px-3 py-2 text-right">Сума</th>
                  </tr>
                </thead>
                <tbody>
                  {itemsModalItems.map(item => (
                    <tr key={item.id} className="border-t">
                      <td className="px-3 py-1">{item.product_name}</td>
                      <td className="px-3 py-1">{item.category}</td>
                      <td className="px-3 py-1 text-right">{item.qty}</td>
                      <td className="px-3 py-1 text-right">{item.sum.toLocaleString('uk-UA')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

          </div>
        </div>
      )}


      {/* ============================
    MODAL — PHOTOS (with upload & delete)
============================ */}
{photoModalOpen && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-white rounded-xl shadow-xl p-6 max-w-3xl w-full max-h-[90vh] overflow-auto">

      {/* Header */}
      <div className="flex justify-between mb-4">
        <h2 className="text-xl font-bold">Фото акту {photoModalActId}</h2>
        <button
          onClick={() => setPhotoModalOpen(false)}
          className="text-red-500 text-2xl hover:text-red-700"
        >
          ✕
        </button>
      </div>

      {/* PHOTO UPLOAD */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2 text-gray-700">
          Додати фото
        </label>
        <input
          type="file"
          multiple
          accept="image/*,application/pdf"
          className="border rounded px-3 py-2 w-full"
          onChange={handlePhotoUpload}
        />
      </div>

      {/* PHOTO GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {photoModalImages.map((url, i) => (
          <div key={i} className="border p-2 rounded-lg">
            <a href={url} target="_blank" rel="noreferrer">
              <img
                src={url}
                className="w-full max-h-64 object-cover rounded-lg"
              />
            </a>

            <button
              onClick={() => handleDeletePhoto(url)}
              className="mt-2 w-full bg-red-500 hover:bg-red-600 text-white text-sm py-1 rounded"
            >
              Видалити
            </button>
          </div>
        ))}
      </div>

    </div>
  </div>
)}


    </div>
  )
}
