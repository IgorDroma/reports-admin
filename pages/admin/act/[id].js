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

  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  const [newItem, setNewItem] = useState({
    product_name: '',
    category: '',
    quantity: '',
    amount: '',
  })

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

      // photo_url — масив
      actData.photo_url = actData.photo_url || []

      setAct(actData)
      setItems(itemsData || [])
    } catch (err) {
      console.error(err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // -------------------------
  //   ВИДАЛИТИ АКТ
  // -------------------------
  async function deleteAct() {
    if (!confirm("Видалити акт разом з усіма товарами та фото?")) return;

    const { error } = await supabase
      .from("acts")
      .delete()
      .eq("id", id);

    if (error) {
      alert("Помилка видалення");
      return;
    }

    alert("Акт видалено");
    router.push("/admin/acts");
  }

  // -------------------------
  //   ЗБЕРЕГТИ АКТ
  // -------------------------
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
          photo_url: act.photo_url
        })
        .eq('id', id)

      if (error) throw error
      await loadAct()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // -------------------------
  //   ДОДАТИ КІЛЬКА ФОТО
  // -------------------------
  async function handleMultiPhotoUpload(e) {
    const files = e.target.files
    if (!files || files.length === 0) return

    setUploadingPhoto(true)
    setError(null)

    try {
      let newUrls = [...(act.photo_url || [])]

      for (const file of files) {
        const ext = file.name.split('.').pop()
        const fileName = `${id}-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const filePath = `${id}/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('acts-files')
          .upload(filePath, file)

        if (uploadError) throw uploadError

        const { data } = supabase.storage
          .from('acts-files')
          .getPublicUrl(filePath)

        newUrls.push(data.publicUrl)
      }

      const { error } = await supabase
        .from('acts')
        .update({ photo_url: newUrls })
        .eq('id', id)

      if (error) throw error

      await loadAct()
    } catch (err) {
      setError(err.message)
    } finally {
      setUploadingPhoto(false)
    }
  }

  // -------------------------
  //    ВИДАЛИТИ ФОТО
  // -------------------------
  async function deletePhoto(url) {
    if (!confirm("Видалити це фото?")) return

    const path = url.split("/storage/v1/object/public/acts-files/")[1]

    await supabase.storage
      .from("acts-files")
      .remove([path])

    const newUrls = act.photo_url.filter(u => u !== url)

    await supabase
      .from("acts")
      .update({ photo_url: newUrls })
      .eq("id", id)

    await loadAct()
  }

  // -------------------------
  //   ДОДАТИ ТОВАР
  // -------------------------
  async function addItem(e) {
    e.preventDefault()

    if (!newItem.product_name || !newItem.quantity || !newItem.amount) {
      setError("Заповніть назву, кількість і суму")
      return
    }

    const payload = {
      act_id: id,
      product_name: newItem.product_name,
      category: newItem.category || null,
      quantity: Number(newItem.quantity),
      amount: Number(newItem.amount),
    }

    const { error } = await supabase.from("act_items").insert(payload)
    if (error) {
      setError(error.message)
      return
    }

    setNewItem({ product_name: "", category: "", quantity: "", amount: "" })
    await loadAct()
  }

  async function deleteItem(itemId) {
    if (!confirm("Видалити товар?")) return
    await supabase.from("act_items").delete().eq("id", itemId)
    await loadAct()
  }

  if (!user) {
    return <div className="flex items-center justify-center h-screen">Авторизуйтесь</div>
  }

  if (loading || !act) {
    return <div className="p-6">Завантаження...</div>
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <button className="mb-4 underline" onClick={() => router.back()}>
        ← Назад
      </button>

      <h1 className="text-2xl font-bold mb-4">Редагування акту</h1>

      {/* DELETE ACT */}
      <button
        className="bg-red-500 text-white px-4 py-2 rounded mb-6"
        onClick={deleteAct}
      >
        Видалити акт
      </button>

      {error && <p className="text-red-500 mb-2">{error}</p>}

      {/* FORM */}
      <form onSubmit={saveAct} className="space-y-3 mb-6">
        <div>
          <label className="block">Дата</label>
          <input
            type="date"
            value={act.act_date || ''}
            onChange={e => setAct(a => ({ ...a, act_date: e.target.value }))}
            className="w-full border px-2 py-1 rounded"
          />
        </div>

        <div>
          <label>Номер акту</label>
          <input
            type="text"
            value={act.act_number}
            onChange={e => setAct(a => ({ ...a, act_number: e.target.value }))}
            className="w-full border px-2 py-1 rounded"
          />
        </div>

        <div>
          <label>Отримувач</label>
          <input
            type="text"
            value={act.receiver}
            onChange={e => setAct(a => ({ ...a, receiver: e.target.value }))}
            className="w-full border px-2 py-1 rounded"
          />
        </div>

        <button className="bg-blue-500 text-white px-4 py-2 rounded">
          {saving ? "Збереження..." : "Зберегти"}
        </button>
      </form>

      {/* MULTI PHOTO */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Фото акту</h2>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
          {act.photo_url?.map((url, i) => (
            <div key={i} className="border rounded p-2">
              <a href={url} target="_blank">
                <img src={url} className="max-h-40 w-full object-cover" />
              </a>
              <button
                className="text-red-500 text-sm mt-2 underline"
                onClick={() => deletePhoto(url)}
              >
                Видалити
              </button>
            </div>
          ))}
        </div>

        <label className="block">
          <span>Додати фото</span>
          <input
            type="file"
            multiple
            accept="image/*,application/pdf"
            onChange={handleMultiPhotoUpload}
            disabled={uploadingPhoto}
          />
        </label>
      </div>

      {/* ITEMS TABLE */}
      <h2 className="text-lg font-semibold mb-2">Товари</h2>

      <table className="w-full text-sm border mb-3">
        <thead>
          <tr className="bg-gray-100">
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

      {/* ADD ITEM FORM */}
      <form onSubmit={addItem} className="grid grid-cols-1 md:grid-cols-5 gap-2">
        <div>
          <label>Назва</label>
          <input
            type="text"
            value={newItem.product_name}
            onChange={e => setNewItem(p => ({ ...p, product_name: e.target.value }))}
            className="w-full border px-2 py-1 rounded"
          />
        </div>
        <div>
          <label>Категорія</label>
          <input
            type="text"
            value={newItem.category}
            onChange={e => setNewItem(p => ({ ...p, category: e.target.value }))}
            className="w-full border px-2 py-1 rounded"
          />
        </div>
        <div>
          <label>Кількість</label>
          <input
            type="number"
            value={newItem.quantity}
            onChange={e => setNewItem(p => ({ ...p, quantity: e.target.value }))}
            className="w-full border px-2 py-1 rounded"
          />
        </div>
        <div>
          <label>Сума</label>
          <input
            type="number"
            value={newItem.amount}
            onChange={e => setNewItem(p => ({ ...p, amount: e.target.value }))}
            className="w-full border px-2 py-1 rounded"
          />
        </div>
        <div>
          <button className="bg-green-500 text-white px-4 py-2 rounded">
            Додати
          </button>
        </div>
      </form>
    </div>
  )
}
