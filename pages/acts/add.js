import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
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

  if (!user)
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-lg">
          Please sign in on <a href="/" className="text-blue-500 underline">login</a>
        </p>
      </div>
    )

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
        photo_url: photoUrl,
        user_id: user.id
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
    <div className="max-w-lg mx-auto p-6 mt-10 bg-white shadow-lg rounded-lg">
      <h2 className="text-2xl font-bold mb-6 text-center">Add New Act</h2>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block font-medium mb-1">Date</label>
          <input
            name="date"
            type="date"
            value={form.date}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
            required
          />
        </div>
        <div>
          <label className="block font-medium mb-1">Amount</label>
          <input
            name="amount"
            type="number"
            value={form.amount}
            onChange={handleChange}
            placeholder="Amount"
            className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
            required
          />
        </div>
        <div>
          <label className="block font-medium mb-1">Receiver</label>
          <input
            name="receiver"
            type="text"
            value={form.receiver}
            onChange={handleChange}
            placeholder="Receiver"
            className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
            required
          />
        </div>
        <div>
          <label className="block font-medium mb-1">Act Number</label>
          <input
            name="act_number"
            type="text"
            value={form.act_number}
            onChange={handleChange}
            placeholder="Act Number"
            className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
            required
          />
        </div>
        <div>
          <label className="block font-medium mb-1">PDF File</label>
          <input
            name="pdf"
            type="file"
            accept="application/pdf"
            onChange={handleChange}
            className="w-full"
          />
        </div>
        <div>
          <label className="block font-medium mb-1">Photo</label>
          <input
            name="photo"
            type="file"
            accept="image/*"
            onChange={handleChange}
            className="w-full"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          {loading ? 'Uploading...' : 'Save'}
        </button>
      </form>
    </div>
  )
}
