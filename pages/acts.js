import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import Head from "next/head";

export default function ActsPage() {
  const [acts, setActs] = useState([]);
  const [selectedAct, setSelectedAct] = useState(null);

  useEffect(() => {
    fetchActs();
  }, []);

  async function fetchActs() {
    const { data, error } = await supabase.from("acts").select(`
      *,
      acts_files(*)  // якщо є окрема таблиця для файлів
    `);
    if (error) console.error(error);
    else setActs(data);
  }

  // --------------------
  // Видалення файлу
  // --------------------
  async function handleDeleteFile(file) {
    // 1️⃣ Видаляємо з бакету
    const { error: storageError } = await supabase
      .storage
      .from("acts-files")
      .remove([file.path]);

    if (storageError) {
      console.error("Помилка при видаленні з бакету:", storageError.message);
      return;
    }

    // 2️⃣ Видаляємо запис у таблиці
    const { error: dbError } = await supabase
      .from("acts_files")
      .delete()
      .eq("id", file.id);

    if (dbError) {
      console.error("Помилка при видаленні з таблиці:", dbError.message);
      return;
    }

    // 3️⃣ Оновлюємо стан на сторінці
    setActs((prev) =>
      prev.map((act) => {
        if (act.id === file.act_id) {
          return {
            ...act,
            acts_files: act.acts_files.filter((f) => f.id !== file.id),
          };
        }
        return act;
      })
    );
  }

  // --------------------
  // Оновлення інформації про акт
  // --------------------
  async function handleUpdateAct(updatedAct) {
    const { data, error } = await supabase
      .from("acts")
      .update({
        date: updatedAct.date,
        recipient: updatedAct.recipient,
        number: updatedAct.number,
        sum: updatedAct.sum,
      })
      .eq("id", updatedAct.id);

    if (error) {
      console.error("Помилка при оновленні акту:", error.message);
      return;
    }

    // Оновлюємо стан на сторінці
    setActs((prev) =>
      prev.map((act) => (act.id === updatedAct.id ? { ...act, ...updatedAct } : act))
    );
    setSelectedAct(null);
  }

  return (
    <div className="p-6">
      <Head>
        {/* Підключення Tailwind через Play CDN */}
        <script src="https://cdn.tailwindcss.com"></script>
      </Head>

      <h1 className="text-2xl font-bold mb-4">Акти</h1>

      {/* Таблиця актів */}
      <table className="table-auto w-full border border-gray-300">
        <thead>
          <tr>
            <th className="border px-2 py-1">№</th>
            <th className="border px-2 py-1">Дата</th>
            <th className="border px-2 py-1">Отримувач</th>
            <th className="border px-2 py-1">Файли</th>
            <th className="border px-2 py-1">Дії</th>
          </tr>
        </thead>
        <tbody>
          {acts.map((act, idx) => (
            <tr key={act.id}>
              <td className="border px-2 py-1">{idx + 1}</td>
              <td className="border px-2 py-1">{act.date}</td>
              <td className="border px-2 py-1">{act.recipient}</td>
              <td className="border px-2 py-1">
                {act.acts_files?.map((file) => (
                  <div key={file.id} className="flex items-center space-x-2">
                    <a
                      href={`https://YOUR_SUPABASE_BUCKET_URL/${file.path}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 underline"
                    >
                      {file.name}
                    </a>
                  </div>
                ))}
              </td>
              <td className="border px-2 py-1">
                <button
                  onClick={() => setSelectedAct(act)}
                  className="bg-blue-500 text-white px-3 py-1 rounded"
                >
                  Редагувати
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Модальне вікно */}
      {selectedAct && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-lg relative">
            <h2 className="text-xl font-bold mb-4">
              Акт №{selectedAct.number}
            </h2>

            {/* Поля редагування */}
            <div className="mb-2">
              <label className="block text-sm font-medium">Дата</label>
              <input
                type="date"
                value={selectedAct.date}
                onChange={(e) =>
                  setSelectedAct({ ...selectedAct, date: e.target.value })
                }
                className="border p-1 w-full"
              />
            </div>
            <div className="mb-2">
              <label className="block text-sm font-medium">Отримувач</label>
              <input
                type="text"
                value={selectedAct.recipient}
                onChange={(e) =>
                  setSelectedAct({ ...selectedAct, recipient: e.target.value })
                }
                className="border p-1 w-full"
              />
            </div>
            <div className="mb-2">
              <label className="block text-sm font-medium">Сума</label>
              <input
                type="number"
                value={selectedAct.sum}
                onChange={(e) =>
                  setSelectedAct({ ...selectedAct, sum: e.target.value })
                }
                className="border p-1 w-full"
              />
            </div>

            {/* Файли акту */}
            {selectedAct.acts_files?.map((file) => (
              <div key={file.id} className="flex items-center justify-between mb-2">
                <a
                  href={`https://YOUR_SUPABASE_BUCKET_URL/${file.path}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 underline"
                >
                  {file.name}
                </a>
                <button
                  onClick={() => handleDeleteFile(file)}
                  className="text-red-500 hover:text-red-700"
                >
                  Видалити
                </button>
              </div>
            ))}

            <div className="flex justify-end mt-4 space-x-2">
              <button
                onClick={() => setSelectedAct(null)}
                className="bg-gray-300 hover:bg-gray-400 px-4 py-2 rounded"
              >
                Закрити
              </button>
              <button
                onClick={() => handleUpdateAct(selectedAct)}
                className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
              >
                Зберегти
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
