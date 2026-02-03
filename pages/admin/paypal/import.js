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
        raw: true
      });

      // очікуємо: [Дата, Час, Сума, Валюта]
      const clean = data.filter(
        r => r && r.length >= 4 && r[0]
      );

      setRows(clean);
    };

    reader.readAsBinaryString(file);
  }

  function parseDateTime(dateCell, timeCell) {
  let dateObj = null;

  // Excel Date object
  if (dateCell instanceof Date) {
    dateObj = new Date(dateCell);
  }

  // Excel serial number
  else if (typeof dateCell === "number") {
    const d = XLSX.SSF.parse_date_code(dateCell);
    dateObj = new Date(d.y, d.m - 1, d.d);
  }

  // String
  else if (typeof dateCell === "string") {
    // DD.MM.YYYY
    if (/^\d{2}\.\d{2}\.\d{4}$/.test(dateCell)) {
      const [d, m, y] = dateCell.split(".");
      dateObj = new Date(Number(y), Number(m) - 1, Number(d));
    }
    // M/D/YY або M/D/YYYY
    else if (dateCell.includes("/")) {
      const parsed = Date.parse(dateCell);
      if (!isNaN(parsed)) {
        dateObj = new Date(parsed);
      }
    }
  }

  if (!dateObj || isNaN(dateObj.getTime())) {
    throw new Error("Невалідна дата: " + dateCell);
  }

  // ---- TIME ----
  let h = 0, m = 0, s = 0;
  if (typeof timeCell === "string") {
    const parts = timeCell.split(":");
    h = Number(parts[0] || 0);
    m = Number(parts[1] || 0);
    s = Number(parts[2] || 0);
  }

  dateObj.setHours(h, m, s, 0);

  return dateObj.toISOString(); // Postgres OK
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
    const payload = rows.map(r => {
  try {
    return {
      paid_at: parseDateTime(r[0], r[1]),
      amount: Number(String(r[2]).replace(",", ".")),
      currency: String(r[3]).trim(),
      import_batch_id: batch.id
    };
  } catch (e) {
    console.error("Пропущено рядок:", r, e.message);
    return null;
  }
}).filter(Boolean);


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
