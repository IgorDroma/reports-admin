import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

export default function EditAct() {
  const router = useRouter()
  const { id } = router.query

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [file, setFile] = useState(null)

  // Завантажити існуючий запис
  useEffect(() => {
    if (!id) return
    loadRecord()
  }, [id])

  async function loadRecord() {
    setLoading(true)
    const { data, error } = await supabase
      .from('acts')
      .select('*')
      .eq('id', id)
      .single()

    if (error) console.error(error)
    else setData(data)
    setLoading(false)
  }

  async function updateRecord(e) {
    e.preventDefault()
    setLoading(true)

    let updated = { ...data }

    // Якщо вибрано новий файл — завантажити його
    if (file) {
      const fileName = `${Date.now()}-${file.name}`
      const { error: uploadError } = await supabase.storage
        .from('acts-files')
        .upload(fileName, file)

      if (uploadError) {
        alert('Помилка завантаження файлу')
        setLoading(false)
        return
      }

      updated.file_url = fileName
    }

    const { error } = await supabase
      .from('acts')
      .update(updated)
      .eq('id', id)

    if (error) alert('Помилка оновлення')
    else router.push('/acts')

    setLoading(false)
  }

  async function deleteRecord() {
    if (!confirm('Точно видалити запис?')) return

    const { error } = await supabase
      .from('acts')
      .delete()
      .eq('id', id)

    if (error) alert('Помилка видалення')
    else router.push('/acts')
  }

  if (loading || !data) return <div>Loading...</div>

  return (
    <div style={{ maxWidth: 600, margin: '40px auto' }}>
      <h1>Редагувати запис #{id}</h1>

      <form onSubmit={updateRecord}>
        <label>Назва</label>
        <input
          value={data.title}
          onChange={(e) => setData({ ...data, title: e.target.value })}
        />

        <label>Опис</label>
        <textarea
          value={data.description}
          onChange={(e) => setData({ ...data, description: e.target.value })}
        />

        <label>Новий файл (опційно)</label>
        <input type="file" onChange={(e) => setFile(e.target.files[0])} />

        <button type="submit">Оновити</button>
      </form>

      <hr />

      <button
        onClick={deleteRecord}
        style={{ background: 'red', color: 'white', marginTop: 20 }}
      >
        Видалити запис
      </button>
    </div>
  )
}
