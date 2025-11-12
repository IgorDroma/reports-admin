import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useRouter } from 'next/router'

export default function Add() {
  const [user, setUser] = useState(null)
  const [form, setForm] = useState({ date:'', amount:'', receiver:'', act_number:'', pdf:null, photo:null })
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data?.user ?? null))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => listener?.subscription?.unsubscribe?.()
  }, [])

  if (!user) return <div className="container"><p>Please sign in on <a href="/">login</a></p></div>

  const handleChange = (e) => {
    const { name, value, files } = e.target
    setForm(prev => ({ ...prev, [name]: files ? files[0] : value }))
  }

  const uploadFile = async (file, folder) => {
    const fileName = `${folder}/${Date.now()}_${file.name.replaceAll(' ','_')}`
    const { data, error } = await supabase.storage.from('acts-files').upload(fileName, file)
    if (error) throw error
    const { data: publicUrl } = supabase.storage.from('acts-files').getPublicUrl(fileName)
    return publicUrl.publicUrl
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const pdfUrl = form.pdf ? await uploadFile(form.pdf, 'pdfs') : null
      const photoUrl = form.photo ? await uploadFile(form.photo, 'photos') : null
      const { error } = await supabase.from('acts').insert([{
        date: form.date,
        amount: form.amount,
        receiver: form.receiver,
        act_number: form.act_number,
        pdf_url: pdfUrl,
        photo_url: photoUrl
      }])
      if (error) throw error
      alert('Act added')
      router.push('/acts')
    } catch (err) {
      alert('Error: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container">
      <h2>Add act</h2>
      <form onSubmit={onSubmit} style={{display:'grid', gap:10, marginTop:10}}>
        <input name="date" type="date" value={form.date} onChange={handleChange} required />
        <input name="amount" type="number" value={form.amount} onChange={handleChange} placeholder="Amount" required />
        <input name="receiver" type="text" value={form.receiver} onChange={handleChange} placeholder="Receiver" required />
        <input name="act_number" type="text" value={form.act_number} onChange={handleChange} placeholder="Act number" required />
        <div>
          <label className="small">PDF file</label><br/>
          <input name="pdf" type="file" accept="application/pdf" onChange={handleChange} />
        </div>
        <div>
          <label className="small">Photo</label><br/>
          <input name="photo" type="file" accept="image/*" onChange={handleChange} />
        </div>
        <button disabled={loading}>{loading ? 'Uploading...' : 'Save'}</button>
      </form>
    </div>
  )
}
