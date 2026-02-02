import { useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import * as XLSX from "xlsx";
import { useRouter } from "next/router";

export default function PaypalImport() {
  const router = useRouter();
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = evt => {
      const wb = XLSX.read(evt.target.result, { type: "binary" });
      const sheet = wb.Sheets[wb.SheetNames[0]];

      const data = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        raw: false
      });

      // очікуємо: [Дата, Час, Сума, Валюта]
      const clean = data.filter(
        r => r && r.length >= 4 && r[0]
      );

      setRows(clean);
    };

    reader.readAsBinaryString(file);
  }

  function parseDateTime(date, time) {
    // DD.MM.YYYY + HH:mm:ss → YYYY-MM-DD HH:mm:ss
    const [d, m, y] = String(date).split(".");
    return `${y}-${m}-${d} ${time || "00:00:00"}`;
  }

  async function handleImport() {
    if (!rows.length) return;

    setLoading(true);

    // 1. створюємо batch
    const { data: batch, error: batchError } = await supabase
      .from("paypal_import_batches")
      .insert({
        filename: fileName,
        rows_count: rows.length
      })
      .select()
      .single();

    if (batchError) {
      alert("Помилка створення імпорту: " + batchError.message);
      setLoading(false);
      return;
    }

    // 2. формуємо payload
    const payload = rows.map(r => ({
      paid_at: parseDateTime(r[0], r[1]),
      amount: Number(String(r[2]).replace(",", ".")),
      currency: String(r[3]).trim(),
      batch_id: batch.id
    }));

    // 3. вставка донатів
    const { error: insertError } = await supabase
      .from("paypal_donations")
      .insert(payload);

    if (insertError) {
      console.error(insertError);
      alert("Помилка імпорту донатів: " + insertError.message);
      setLoading(false);
      return;
    }
  }

  return (
    <div className="admin-container">
      <button className="mb-4 underline" onClick={() => router.back()}>
        ← Назад
      </button>

      <h1>Імпорт PAYPAL</h1>

      <input type="file" accept=".xlsx" onChange={handleFile} />

      {rows.length > 0 && (
        <>
          <p>Рядків: {rows.length}</p>
          <button onClick={handleImport} disabled={loading}>
            {loading ? "Імпорт…" : "Імпортувати"}
          </button>
        </>
      )}
    </div>
  );
}
