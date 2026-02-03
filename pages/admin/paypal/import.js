import { useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import * as XLSX from "xlsx";
import { useRouter } from "next/router";

export default function PaypalImport() {
  const router = useRouter();
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);

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
  let y, m, d;

  // 1️⃣ Формат M/D/YY або M/D/YYYY
  if (typeof dateCell === "string" && dateCell.includes("/")) {
    const parts = dateCell.split("/");
    if (parts.length !== 3) {
      throw new Error("Невалідний формат дати: " + dateCell);
    }

    m = Number(parts[0]) - 1;
    d = Number(parts[1]);
    y = Number(parts[2]);

    // YY → YYYY
    if (y < 100) y += 2000;
  }

  // 2️⃣ Формат DD.MM.YYYY (на майбутнє)
  else if (typeof dateCell === "string" && dateCell.includes(".")) {
    const parts = dateCell.split(".");
    d = Number(parts[0]);
    m = Number(parts[1]) - 1;
    y = Number(parts[2]);
  }

  // 3️⃣ Excel serial date
  else if (typeof dateCell === "number") {
    const ex = XLSX.SSF.parse_date_code(dateCell);
    y = ex.y;
    m = ex.m - 1;
    d = ex.d;
  }

  else {
    throw new Error("Невідома дата: " + dateCell);
  }

  const dateObj = new Date(y, m, d);

  // ---- TIME ----
  if (typeof timeCell === "string") {
    const t = timeCell.split(":");
    dateObj.setHours(
      Number(t[0] || 0),
      Number(t[1] || 0),
      Number(t[2] || 0),
      0
    );
  }

  return dateObj.toISOString();
}






  async function handleImport() {
  if (!rows.length) return;

  setLoading(true);
  setReport(null);

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

  let valid = [];
  let skipped = [];

  // 2. валідація рядків
  rows.forEach((r, index) => {
    try {
      const paid_at = parseDateTime(r[0], r[1]);
      const amount = Number(String(r[2]).replace(",", "."));
      const currency = String(r[3] || "").trim();

      if (!paid_at || isNaN(amount) || !currency) {
        throw new Error("Порожні або некоректні дані");
      }

      valid.push({
        paid_at,
        amount,
        currency,
        import_batch_id: batch.id
      });
    } catch (e) {
      skipped.push({
        row: index + 1,
        data: r,
        reason: e.message
      });
    }
  });
console.log("ROW:", rows[0]);
console.log("PARSED:", parseDateTime(rows[0][0], rows[0][1]));

  // 3. вставка валідних
  let insertedCount = 0;
    
  if (valid.length) {
    const { error: insertError } = await supabase
      .from("paypal_donations")
      .insert(valid);

    if (insertError) {
      alert("Помилка вставки донатів: " + insertError.message);
      setLoading(false);
      return;
    }

    insertedCount = valid.length;
  }

  // 4. звіт
  setReport({
    total: rows.length,
    inserted: insertedCount,
    skipped: skipped.length,
    skippedRows: skipped
  });

  setLoading(false);
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
            {report && (
  <div className="import-report mt-6">
    <h3>Результат імпорту</h3>

    <ul>
      <li>Всього рядків: <strong>{report.total}</strong></li>
      <li>Додано: <strong>{report.inserted}</strong></li>
      <li>Пропущено: <strong>{report.skipped}</strong></li>
    </ul>

    {report.skippedRows.length > 0 && (
      <>
        <h4 className="mt-4">Пропущені рядки</h4>
        <table className="admin-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Дані</th>
              <th>Причина</th>
            </tr>
          </thead>
          <tbody>
            {report.skippedRows.map((r, i) => (
              <tr key={i}>
                <td>{r.row}</td>
                <td>{JSON.stringify(r.data)}</td>
                <td>{r.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </>
    )}
  </div>
)}

        </>
      )}
    </div>
  );
}
