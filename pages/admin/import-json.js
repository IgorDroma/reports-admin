// pages/admin/import-json.js
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../..//lib/supabaseClient'

export default function ImportJsonPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)

  const [fileContent, setFileContent] = useState(null)
  const [preview, setPreview] = useState(null)
  const [importing, setImporting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data?.user ?? null))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => listener?.subscription?.unsubscribe?.()
  }, [])

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

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const text = ev.target.result
        const json = JSON.parse(text)
        setFileContent(json)
        setPreview(Array.isArray(json) ? json.slice(0, 3) : null)
        setMessage('')
        setError('')
      } catch (err) {
        console.error(err)
        setError('Файл не є валідним JSON')
      }
    }
    reader.readAsText(file)
  }

  async function handleImport() {
    if (!fileContent) {
      setError('Спочатку виберіть JSON-файл')
      return
    }

    setImporting(true)
    setError('')
    setMessage('')

    try {
      const res = await fetch('/api/import-acts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fileContent),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Помилка імпорту')
      }

      setMessage(`Імпортовано: ${data.insertedActs} актів, ${data.insertedItems} товарів`)
    } catch (err) {
      console.error(err)
      setError(err.message)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <button className="mb-4 underline" onClick={() => router.push('/admin/acts')}>
        ← До актів
      </button>

      <h1 className="text-2xl font-bold mb-4">Імпорт JSON</h1>

      {error && <p className="text-red-500 mb-2">Помилка: {error}</p>}
      {message && <p className="text-green-600 mb-2">{message}</p>}

      <div className="mb-4">
        <input type="file" accept="application/json" onChange={handleFileChange} />
      </div>

      {preview && (
        <div className="mb-4">
          <p className="font-semibold mb-1">Перші акти у файлі:</p>
          <pre className="bg-gray-100 p-2 text-xs rounded max-h-60 overflow-auto">
            {JSON.stringify(preview, null, 2)}
          </pre>
        </div>
      )}

      <button
        className="bg-blue-500 text-white px-4 py-2 rounded"
        disabled={importing || !fileContent}
        onClick={handleImport}
      >
        {importing ? 'Імпортую...' : 'Імпортувати'}
      </button>
    </div>
  )
}
