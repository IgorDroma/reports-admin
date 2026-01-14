import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../../../lib/supabaseClient";

const MONO_SOURCE_ID = "1f977e3c-f740-421f-8c4f-e60bd255bd66";

export default function ImportMonoZip() {
  const router = useRouter();

  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const [filesInfo, setFilesInfo] = useState([]);
  const [rows, setRows] = useState([]);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  /* ================= AUTH ================= */

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data?.user ?? null);
      setLoadingUser(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });

    return () => listener?.subscription?.unsubscribe?.();
  }, []);

  /* ================= HELPERS ================= */

  function parseDateTime(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;

  // Mono CSV: YYYY-MM-DD + HH:MM
  const date = String(dateStr).trim();
  const time = String(timeStr).trim();

  // Дозволяємо HH:MM → HH:MM:00
  const timeFixed = /^\d{2}:\d{2}$/.test(time) ? `${time}:00` : time;

  // Валідація
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (!/^\d{2}:\d{2}:\d{2}$/.test(timeFixed)) return null;

  return `${date} ${timeFixed}`;
}


  function parseNumber(v) {
    if (v == null) return null;
    const n = parseFloat(String(v).replace(",", ".").replace(/\s+/g, ""));
    return Number.isNaN(n) ? null : n;
  }

  /* ================= FILE HANDLER ================= */

  async function handleFileChange(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setError("");
    setSuccess("");
    setRows([]);
    setFilesInfo(files.map(f => f.name));
    setParsing(true);

    try {
      const JSZip = (await import("jszip")).default;
      const Papa = (await import("papaparse")).default;

      const allRows = [];

      for (const zipFile of files) {
        const zip = await JSZip.loadAsync(zipFile);

        const csvFiles = Object.values(zip.files).filter(f =>
          f.name.toLowerCase().endsWith(".csv")
        );

        for (const csv of csvFiles) {
          const text = await csv.async("string");

          const parsed = Papa.parse(text, {
            header: true,
            skipEmptyLines: true,
          });

          console.log("CSV headers:", Object.keys(parsed.data[0] || {}));

          for (const r of parsed.data) {
            const donated_at = parseDateTime(
              r["Дата платежу"],
              r["Час платежу"]
            );

            const amount = parseNumber(r["Сума платежу"]);

            if (!donated_at || amount === null) continue;

            allRows.push({
              donated_at,
              amount_uah: amount,
              currency: "UAH",
              amount_currency: null,
              source_id: MONO_SOURCE_ID,
            });
          }
        }
      }

      setRows(allRows);
    } catch (err) {
      console.error(err);
      setError("Помилка обробки ZIP/CSV: " + err.message);
    } finally {
      setParsing(false);
    }
  }

  /* ================= IMPORT ================= */

  async function handleImport() {
    if (!rows.length) return;

    setError("");
    setSuccess("");
    setImporting(true);

    const batchId = crypto.randomUUID();

    try {
      const payload = rows.map(r => ({
        ...r,
        imported_batch_id: batchId,
      }));

      const chunkSize = 500;
      for (let i = 0; i < payload.length; i += chunkSize) {
        const chunk = payload.slice(i, i + chunkSize);
        const { error } = await supabase.from("donations").insert(chunk);
        if (error) throw error;
      }

      await supabase.from("donations_imports").insert({
        batch_id: batchId,
        file_name: filesInfo.join(", "),
        success_count: payload.length,
        failed_count: 0,
        source_id: MONO_SOURCE_ID,
      });

      setSuccess(`Успішно імпортовано ${payload.length} записів`);
      setRows([]);
      setFilesInfo([]);
    } catch (err) {
      console.error(err);
      setError("Помилка імпорту: " + err.message);
    } finally {
      setImporting(false);
    }
  }

  /* ================= RENDER ================= */

  if (loadingUser) return <p>Перевірка доступу…</p>;

  if (!user) {
    return (
      <div className="p-6">
        <p>Будь ласка, увійдіть у систему.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <button className="underline mb-4" onClick={() => router.back()}>
        ← Назад
      </button>

      <h1 className="text-2xl font-bold mb-4">
        Імпорт донатів (Mono · ZIP → CSV)
      </h1>

      {error && <p style={{ color: "red" }}>{error}</p>}
      {success && <p style={{ color: "green" }}>{success}</p>}

      <input
        type="file"
        accept=".zip"
        multiple
        onChange={handleFileChange}
      />

      {filesInfo.length > 0 && (
        <p className="text-sm mt-2">
          Обрано файлів: {filesInfo.length}
        </p>
      )}

      {parsing && <p className="mt-3">Обробка ZIP/CSV…</p>}

      {rows.length > 0 && (
        <>
          <p className="mt-3">
            Підготовлено записів: <b>{rows.length}</b>
          </p>

          <button
            className="mt-4 bg-blue-600 text-white px-4 py-2 rounded"
            disabled={importing}
            onClick={handleImport}
          >
            {importing ? "Імпорт…" : "Імпортувати"}
          </button>
        </>
      )}
    </div>
  );
}
