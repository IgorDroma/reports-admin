import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { useRouter } from "next/router";

export default function PropertyActsImports() {
  const router = useRouter();

  const [imports, setImports] = useState([]);
  const [loading, setLoading] = useState(true);

  async function loadImports() {
    setLoading(true);

    const { data, error } = await supabase
      .from("property_import_batches")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setImports([]);
    } else {
      setImports(data || []);
    }

    setLoading(false);
  }

  async function rollbackImport(batchId) {
    if (!confirm("Видалити всі акти цього імпорту?")) return;

    const { error } = await supabase
      .from("property_import_batches")
      .delete()
      .eq("id", batchId);

    if (error) {
      alert("Помилка: " + error.message);
      return;
    }

    loadImports();
  }

  useEffect(() => {
    loadImports();
  }, []);

  return (
    <div className="page">
      <div className="header">
        <button
          className="secondary"
          onClick={() => router.push("/admin/property-acts")}
        >
          До актів
        </button>

        <div className="title">Імпорти майнових актів</div>
      </div>

      {loading ? (
        <p>Завантаження...</p>
      ) : imports.length === 0 ? (
        <p>Імпортів ще немає</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Дата</th>
              <th>Файл</th>
              <th>Актів</th>
              <th>Сума</th>
              <th></th>
            </tr>
          </thead>

          <tbody>
            {imports.map((row) => (
              <tr key={row.id}>
                <td>{new Date(row.created_at).toLocaleString("uk-UA")}</td>
                <td>{row.original_filename}</td>
                <td>{row.total_acts}</td>
                <td>
                  {Number(row.total_amount).toLocaleString("uk-UA")} грн
                </td>
                <td className="text-right">
                  <button
                    className="danger"
                    onClick={() => rollbackImport(row.id)}
                  >
                    Відкотити
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
