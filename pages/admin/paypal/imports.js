import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

export default function PaypalImports() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data } = await supabase
      .from("paypal_import_batches")
      .select("*")
      .order("imported_at", { ascending: false });

    setItems(data || []);
  }

  async function handleDelete(id) {
    if (!confirm("Видалити імпорт?")) return;

    await supabase
      .from("paypal_import_batches")
      .delete()
      .eq("id", id);

    load();
  }

  return (
    <div className="admin-container">
      <h1>Імпорти PAYPAL</h1>

      <table className="admin-table">
        <thead>
          <tr>
            <th>Дата</th>
            <th>Файл</th>
            <th>Рядків</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map(r => (
            <tr key={r.id}>
              <td>{new Date(r.imported_at).toLocaleString("uk-UA")}</td>
              <td>{r.filename}</td>
              <td>{r.rows_count}</td>
              <td>
                <button onClick={() => handleDelete(r.id)}>🗑</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
