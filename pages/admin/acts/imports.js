import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { useRouter } from "next/router";

export default function ActsImports() {
  const router = useRouter();
  
  const [imports, setImports] = useState([]);
  const [loading, setLoading] = useState(true);

  async function loadImports() {
    setLoading(true);
    const { data } = await supabase
      .from("acts_imports")
      .select("*")
      .order("created_at", { ascending: false });

    setImports(data || []);
    setLoading(false);
  }

  async function rollbackImport(batchId) {
    if (!confirm("Видалити всі акти цього імпорту?")) return;

    const { error } = await supabase.rpc("delete_act_import", {
      target: batchId,
    });

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
          onClick={() => router.push("/admin/acts")}
        >До актів
        </button>
        <div className="title">Імпорти актів</div>
      </div>

      {loading ? (
        <p>Завантаження...</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Дата</th>
              <th>Файл</th>
              <th>Успішні</th>
              <th>Пропущені</th>
              <th></th>
            </tr>
          </thead>

          <tbody>
            {imports.map((row) => (
              <tr key={row.batch_id}>
                <td>{new Date(row.created_at).toLocaleString("uk-UA")}</td>
                <td>{row.file_name}</td>
                <td>{row.inserted_count}</td>
                <td>{row.skipped_count}</td>
                <td className="text-right">
                  <button
                    className="danger"
                    onClick={() => rollbackImport(row.batch_id)}
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
