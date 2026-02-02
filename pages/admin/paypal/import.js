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
      const data = XLSX.utils.sheet_to_json(sheet);

      setRows(data);
    };
    reader.readAsBinaryString(file);
  }

  async function handleImport() {
    if (!rows.length) return;

    setLoading(true);

    const { data: batch } = await supabase
      .from("paypal_import_batches")
      .insert({
        filename: fileName,
        rows_count: rows.length
      })
      .select()
      .single();

    const payload = rows.map(r => ({
      paid_at: `${r["Дата"]} ${r["Час"]}`,
      amount: Number(r["Сума"]),
      currency: r["Валюта"],
      batch_id: batch.id
    }));

    await supabase.from("paypal_donations").insert(payload);

    router.push("/admin/paypal/imports");
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
            Імпортувати
          </button>
        </>
      )}
    </div>
  );
}
