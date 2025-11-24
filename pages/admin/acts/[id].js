// pages/admin/act/[id].js
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabaseClient'

export default function ActEdit() {
  const router = useRouter()
  const { id } = router.query

  const [user, setUser] = useState(null)

  const [act, setAct] = useState(null)
  const [items, setItems] = useState([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  // форма нового товару
  const [newItem, setNewItem] = useState({
    product_name: '',
    category: '',
    quantity: '',
    amount: '',
  })

  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data?.user ?? null))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => listener?.subscription?.unsubscribe?.()
  }, [])

  useEffect(() => {
    if (!user || !id) return
    loadAct()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, id])

  async function loadAct() {
    setLoading(true)
    setError(null)

    try {
      const { data: actData, error: actError } = await supabase
        .from('acts')
        .select('*')
        .eq('id', id)
        .single()

      if (actError) throw actError

      const { data: itemsData, error: itemsError } = await supabase
        .from('act_items')
        .select('*')
        .eq('act_id', id)
        .order('created_at', { ascending: true })

      if (itemsError) throw itemsError

      setAct(actData)
      setItems(itemsData || [])
    } catch (err) {
      console.error(err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function saveAct(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const { error } = await supabase
        .from('acts')
        .update({
          act_date: act.act_date,
          act_number: act.act_number,
          receiver: act.receiver,
        })
        .eq('id', id)

      if (error) throw error
      await loadAct()
    } catch (err) {
      console.error(err)
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function addItem(e) {
    e.preventDefault()
    setError(null)

    if (!newItem.product_name || !newItem.quantity || !newItem.amount) {
      setError('Заповніть назву, кількість і суму для товару')
      return
    }

    try {
      const payload = {
        act_id: id,
        product_name: newItem.product_name,
        category: newItem.category || null,
        quantity: Number(newItem.quantity),
        amount: Number(newItem.amount),
      }

      const { error } = await supabase.from('act_items').insert(payload)
      if (error) throw error

      setNewItem({ product_name: '', category: '', quantity: '', amount: '' })
      await loadAct()
    } catch (err) {
      console.error(err)
      setError(err.message)
    }
  }

  async function deleteItem(itemId) {
    if (!confirm('Видалити товар?')) return

    try {
      const { error } = await supabase
        .from('act_items')
        .delete()
        .eq('id', itemId)

      if (error) throw error
      await loadAct()
    } catch (err) {
      console.error(err)
      setError(err.message)
    }
  }

  async function handlePhotoUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!id) return

    setUploadingPhoto(true)
    setError(null)

    try {
      const ext = file.name.split('.').pop()
      const fileName = `${id}-${Date.now()}.${ext}`
      const filePath = `${id}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('acts-files')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data } = supabase.storage
        .from('acts-files')
        .getPublicUrl(filePath)

      const publicUrl = data.publicUrl

      const { error: updateError } = await supabase
        .from('acts')
        .update({ photo_url: publicUrl })
        .eq('id', id)

      if (updateError) throw updateError

      await loadAct()
    } catch (err) {
      console.error(err)
      setError(err.message)
    } finally {
      setUploadingPhoto(false)
    }
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-lg">
          Please sign in on{' '}
          <a href="/" className="text-blue-500 underline">
            login
          </a>
        </p>
      </div>
    )
  }

  if (loading || !act) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <button className="mb-4 underline" onClick={() => router.back()}>
          ← Назад
        </button>
        <p>Завантаження...</p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <button className="mb-4 underline" onClick={() => router.back()}>
        ← Назад
      </button>

      <h1 className="text-2xl font-bold mb-4">Редагування акту</h1>

      {error && <p className="text-red-500 mb-2">Помилка: {error}</p>}

      <form onSubmit={saveAct} className="space-y-3 mb-6">
        <div>
          <label className="block mb-1 text-sm">Дата</label>
          <input
            type="date"
            value={act.act_date || ''}
            onChange={e => setAct(a => ({ ...a, act_date: e.target.value }))}
            className="w-full border rounded px-2 py-1"
          />
        </div>
        <div>
          <label className="block mb-1 text-sm">Номер акту</label>
          <input
            type="text"
            value={act.act_number || ''}
            onChange={e => setAct(a => ({ ...a, act_number: e.target.value }))}
            className="w-full border rounded px-2 py-1"
          />
        </div>
        <div>
          <label className="block mb-1 text-sm">Отримувач</label>
          <input
            type="text"
            value={act.receiver || ''}
            onChange={e => setAct(a => ({ ...a, receiver: e.target.value }))}
            className="w-full border rounded px-2 py-1"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          {saving ? 'Збереження...' : 'Зберегти акт'}
        </button>
      </form>

      {/* Фото */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Фото акту</h2>
        {act.photo_url ? (
          <div className="mb-2">
            <a href={act.photo_url} target="_blank" rel="noreferrer">
              <img
                src={act.photo_url}
                alt="Фото акту"
                className="max-h-48 border rounded"
              />
            </a>
          </div>
        ) : (
          <p className="text-sm text-gray-600 mb-2">Фото ще не завантажено</p>
        )}

        <label className="block">
          <span className="text-sm mb-1 block">Завантажити нове фото / PDF</span>
          <input
            type="file"
            accept="image/*,application/pdf"
            onChange={handlePhotoUpload}
            disabled={uploadingPhoto}
          />
        </label>
      </div>

      {/* Товари */}
      <div>
        <h2 className="text-lg font-semibold mb-2">Товари акту</h2>

        {items.length === 0 ? (
          <p className="text-sm text-gray-600 mb-2">Немає товарів</p>
        ) : (
          <table className="w-full text-sm border mb-3">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-2 py-1 text-left">Назва</th>
                <th className="px-2 py-1 text-left">Категорія</th>
                <th className="px-2 py-1 text-right">Кількість</th>
                <th className="px-2 py-1 text-right">Сума</th>
                <th className="px-2 py-1 text-right">Дії</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id} className="border-t">
                  <td className="px-2 py-1">{item.product_name}</td>
                  <td className="px-2 py-1">{item.category}</td>
                  <td className="px-2 py-1 text-right">{item.quantity}</td>
                  <td className="px-2 py-1 text-right">{item.amount}</td>
                  <td className="px-2 py-1 text-right">
                    <button
                      className="text-red-500 underline text-xs"
                      onClick={() => deleteItem(item.id)}
                    >
                      Видалити
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Додати товар */}
        <form onSubmit={addItem} className="grid grid-cols-1 md:grid-cols-5 gap-2 items-end">
          <div>
            <label className="block text-sm mb-1">Назва</label>
            <input
              type="text"
              value={newItem.product_name}
              onChange={e => setNewItem(i => ({ ...i, product_name: e.target.value }))}
              className="w-full border rounded px-2 py-1"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Категорія</label>
            <input
              type="text"
              value={newItem.category}
              onChange={e => setNewItem(i => ({ ...i, category: e.target.value }))}
              className="w-full border rounded px-2 py-1"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Кількість</label>
            <input
              type="number"
              step="0.01"
              value={newItem.quantity}
              onChange={e => setNewItem(i => ({ ...i, quantity: e.target.value }))}
              className="w-full border rounded px-2 py-1"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Сума</label>
            <input
              type="number"
              step="0.01"
              value={newItem.amount}
              onChange={e => setNewItem(i => ({ ...i, amount: e.target.value }))}
              className="w-full border rounded px-2 py-1"
            />
          </div>
          <div>
            <button
              type="submit"
              className="w-full bg-green-500 text-white px-3 py-2 rounded"
            >
              Додати товар
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
