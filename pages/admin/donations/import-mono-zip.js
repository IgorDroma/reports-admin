// pages/admin/donations/import-mono-zip.js

import { useEffect, useState } from "react"
import { useRouter } from "next/router"
import { supabase } from "../../../lib/supabaseClient"

/**
 * ЖОРСТКО зафіксований source_id для Mono
 */
const MONO_SOURCE_ID = "1f977e3c-f740-421f-8c4f-e60bd255bd66"

export default function ImportMonoZip() {
  const router = useRouter()

  const [user, setUser] = useState(null)
  const [loadingUser, setLoadingUser] = useState(true)

  const [fileNames, setFileNames] = useState([])
  const [rows, setRows] = useState([])

  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)

  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  /* ---------- AUTH ---------- */
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data?.user ?? null)
      setLoadingUser(false)
    })
  }, [])

  /* ---------- HELPERS ---------- */

  function parseDateTime(dateRaw, timeRaw) {
    if (!dateRaw || !timeRaw) return null

    const d = String(dateRaw).trim()
    const t = String(timeRaw).trim()

    // Очікуємо DD.MM.YYYY + HH:MM(:SS)
    if (!/^\d{2}\.\d{2}\.\d{4}$/.test(d)) return null

    let time = t
    if (/^\d{2}:\d{2}$/.test(time)) {
      time = `${time}:00`
    }
    if (!/^\d{2}:\d{2}:\d{2}$/.test(time)) return null

    const [dd, mm, yyyy] = d.split(".")
    return `${yyyy}-${mm}-${dd} ${time}`
  }

  function parseNumber(raw) {
    if (raw == null) return null
    const s = String(raw).replace(/\s+/g, "").replace(",", ".")
    const n = parseFloat(s)
    return Number.isNaN(n) ? null : n
  }

  /* ---------- ZIP → CSV ---------- */

  async function handleFileChange(e) {
  const files = Array.from(e.target.files || [])
  if (!files.length) return

  setParsing(true)
  setError("")
  setSuccess("")
  setRows([])
  setFileNames(files.map(f => f.name))

  try {
    const JSZip = (await import("jszip")).default
    const Papa = (await import("papaparse")).default

    const collected = []

    for (const file of files) {
      const zip = await JSZip.loadAsync(file)

      const csvNames = Object.keys(zip.files).filter(name =>
        name.toLowerCase().endsWith(".csv")
      )

      for (const csvName of csvNames) {
        const csvText = await zip.files[csvName].async("string")

        const parsed = await new Promise((resolve, reject) => {
          Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            complete: res => resolve(res.data),
            error: reject,
          })
        })

        for (const r of parsed) {
          const dateRaw = r["Дата платежу"]
          const timeRaw = r["Час платежу"]
          const sumRaw = r["Сума платежу"]

          const donated_at = parseDateTime(dateRaw, timeRaw)
          if (!donated_at) continue

          const amount_uah = parseNumber(sumRaw)
          if (amount_uah == null) continue

          collected.push({
            donated_at,
            amount_uah,
            currency: "UAH",
            amount_currency: null,
            purpose: "",
            is_incassation: false,
          })
        }
      }
    }

    setRows(collected)
  } catch (err) {
    console.error(err)
    setError("Помилка обробки ZIP: " + err.message)
  } finally {
    setParsing(false)
  }
}


  /* ---------- IMPORT ---------- */

  async function handleImport() {
    if (!rows.length) {
      setError("Немає даних для імпорту")
      return
    }

    setImporting(true)
    setError("")
    setSuccess("")

    const batchId = crypto.randomUUID()

    try {
      const payload = rows.map(r => ({
        ...r,
        source_id: MONO_SOURCE_ID,
        imported_batch_id: batchId,
      }))

      const chunkSize = 500
      for (let i = 0; i < payload.length; i += chunkSize) {
        const chunk = payload.slice(i, i + chunkSize)
        const { error } = await supabase.from("donations").insert(chunk)
        if (error) throw error
      }

      await supabase.from("donations_imports").insert({
        batch_id: batchId,
        file_name: fileNames.join(", "),
        success_count: payload.length,
        failed_count: 0,
        source_id: MONO_SOURCE_ID,
      })

      setSuccess(`Успішно імпортовано ${payload.length} донатів (Mono)`)
      setRows([])
      setFileNames([])
    } catch (err) {
      console.error(err)
      setError("Помилка імпорту: " + err.message)
    } finally {
      setImporting(false)
    }
  }

  /* ---------- RENDER ---------- */

  if (loadingUser) return <p>Перевірка авторизації…</p>
  if (!user) return <p>Будь ласка, увійдіть у систему</p>

  return (
    <div className="max-w-3xl mx-auto p-6">
      <button className="underline mb-4" onClick={() => router.back()}>
        ← Назад
      </button>

      <h1 className="text-2xl font-bold mb-4">
        Імпорт донатів (Mono · CSV ZIP)
      </h1>

      {error && <p style={{ color: "red" }}>{error}</p>}
      {success && <p style={{ color: "green" }}>{success}</p>}

      <input
        type="file"
        accept=".zip"
        multiple
        onChange={handleFileChange}
      />

      {fileNames.length > 0 && (
        <p className="mt-2 text-sm">
          Обрано ZIP-файлів: <b>{fileNames.length}</b>
        </p>
      )}

      {rows.length > 0 && (
        <>
          <p className="mt-3 text-sm">
            Готово до імпорту: <b>{rows.length}</b> рядків
          </p>

          <button
            className="bg-blue-600 text-white px-4 py-2 rounded mt-3"
            disabled={importing}
            onClick={handleImport}
          >
            {importing ? "Імпорт..." : "Імпортувати в базу"}
          </button>
        </>
      )}

      {parsing && <p className="mt-3">Обробка ZIP…</p>}
    </div>
  )
}
