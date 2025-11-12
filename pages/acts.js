import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import Head from "next/head";

export default function ActsPage() {
  const [acts, setActs] = useState([]);
  const [selectedAct, setSelectedAct] = useState(null);
  const [newPdf, setNewPdf] = useState(null);
  const [newPhoto, setNewPhoto] = useState(null);

  useEffect(() => {
    fetchActs();
  }, []);

  async function fetchActs() {
    const { data, error } = await supabase
      .from("acts")
      .select("*")
      .order("id", { ascending: false });
    if (error) console.error(error);
    else setActs(data);
  }

  // --------------------
  // Видалення PDF або фото
  // --------------------
  async function handleDeleteFile(act, type) {
    const url = type === "pdf" ? act.pdf_url : act.photo_url;
    if (!url) return;

    const folder = type === "pdf" ? "pdfs" : "photos";

    const { error: storageError } = await supabase
      .storage
      .from("acts-files")
      .remove([url.replace(`${folder}/`, "")]);

    if (storageError) {
      console.error("Помилка видалення з бакету:", storageError.message);
      return;
    }

    // Оновлюємо поле у таблиці та локально
    const { error: dbError } = await supabase
      .from("acts")
      .update({ [type + "_url"]: null })
      .eq("id", act.id);

    if (dbError) console.error(dbError);
    else {
      setActs((prev) =>
        prev.map((a) =>
          a.id === act.id ? { ...a, [type + "_url"]: null } : a
        )
      );
      setSelectedAct((prev) =>
        prev ? { ...prev, [type + "_url"]: null } : null
      );
    }
  }

  // --------------------
  // Завантаження PDF або фото
  // --------------------
  async function handleUploadFile(act, type, file) {
    if (!file) return;
    const folder = type === "pdf" ? "pdfs" : "photos";
    const filePath = `${folder}/${act.id}-${file.name}`;

    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from("acts-files")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      console.error(uploadError);
      return;
    }

    const { error: dbError } = await supabase
      .from("acts")
      .update({ [type + "_url"]: filePath })
      .eq("id", act.id);

    if (dbError) console.error(dbError);
    else {
      setActs((prev) =>
        prev.map((a) =>
          a.id === act.id ? { ...a, [type + "_url"]: filePath } : a
        )
      );
      setSelectedAct((prev) =>
        prev ? { ...prev, [type + "_url"]: filePath } : null
      );
      if (type === "pdf") setNewPdf(null);
      else setNewPhoto(null);
    }
  }

  // --------------------
  // Оновлення акту
  // --------------------
  async function handleUpdateAct(updatedAct) {
    const { error } = await supabase
      .from("acts")
      .update({
        date: updatedAct.date,
        act_number: updatedAct.act_number,
        receiver: updatedAct.receiver,
        amount: updatedAct.amount,
      })
      .eq("id", updatedAct.id);

    if (error) console.error(error);
    else {
      setActs((prev) =>
        prev.map((act) => (act.id === updatedAct.id ? updatedAct : act))
      );
      setSelectedAct(null);
    }
  }

  return (
    <div className="p-6">

      <h1 className="text-2xl font-bold mb-4">Акти</h1>

      {/* Таблиця актів */}
      <table className="table-auto w-full border border-gray-300">
        <thead>
          <tr>
            <th className="border px-2 py-1">№</th>
            <th className="border px-2 py-1">Дата</th>
            <th className="border px-2 py-1">Номер акту</th>
            <th className="border px-2 py-1">Отримувач</th>
            <th className="border px-2 py-1">Сума</th>
            <th className="border px-2 py-1">PDF</th>
            <th className="border px-2 py-1">Фото</th>
            <th className="border px-2 py-1">Дії</th>
          </tr>
        </thead>
        <tbody>
          {acts.map((act, idx) => (
            <tr key={act.id}>
              <td className="border px-2 py-1">{idx + 1}</td>
              <td className="border px-2 py-1">{act.date}</td>
              <td className="border px-2 py-1">{act.act_number}</td>
              <td className="border px-2 py-1">{act.receiver}</td>
              <td className="border px-2 py-1">{act.amount}</td>
              <td className="border px-2 py-1">
                {act.pdf_url ? (
                  <a
                    href={act.pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 underline"
                  >
                    PDF
                  </a>
                ) : (
                  "-"
                )}
              </td>
              <td className="border px-2 py-1">
                {act.photo_url ? (
                  <a
                    href={act.photo_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 underline"
                  >
                    Фото
                  </a>
                ) : (
                  "-"
                )}
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
              Акт №{selectedAct.act_number}
            </h2>

            {/* Редагування даних */}
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
              <label className="block text-sm font-medium">Номер акту</label>
              <input
                type="text"
                value={selectedAct.act_number}
                onChange={(e) =>
                  setSelectedAct({ ...selectedAct, act_number: e.target.value })
                }
                className="border p-1 w-full"
              />
            </div>
            <div className="mb-2">
              <label className="block text-sm font-medium">Отримувач</label>
              <input
                type="text"
                value={selectedAct.receiver}
                onChange={(e) =>
                  setSelectedAct({ ...selectedAct, receiver: e.target.value })
                }
                className="border p-1 w-full"
              />
            </div>
            <div className="mb-2">
              <label className="block text-sm font-medium">Сума</label>
              <input
                type="number"
                value={selectedAct.amount}
                onChange={(e) =>
                  setSelectedAct({ ...selectedAct, amount: e.target.value })
                }
                className="border p-1 w-full"
              />
            </div>

            {/* PDF */}
            <div className="mb-2">
              <label className="block text-sm font-medium">PDF</label>
              {selectedAct.pdf_url && (
                <div className="flex items-center space-x-2 mb-1">
                  <a
                    href={selectedAct.pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 underline"
                  >
                    Поточний PDF
                  </a>
                  <button
                    onClick={() => handleDeleteFile(selectedAct, "pdf")}
                    className="text-red-500 hover:text-red-700"
                  >
                    Видалити
                  </button>
                </div>
              )}
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => setNewPdf(e.target.files[0])}
                className="border p-1 w-full"
              />
              <button
                onClick={() => handleUploadFile(selectedAct, "pdf", newPdf)}
                className="mt-1 bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded"
              >
                Завантажити PDF
              </button>
            </div>

            {/* Фото */}
            <div className="mb-2">
              <label className="block text-sm font-medium">Фото</label>
              {selectedAct.photo_url && (
                <div className="flex items-center space-x-2 mb-1">
                  <a
                    href={selectedAct.photo_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 underline"
                  >
                    Поточне фото
                  </a>
                  <button
                    onClick={() => handleDeleteFile(selectedAct, "photo")}
                    className="text-red-500 hover:text-red-700"
                  >
                    Видалити
                  </button>
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setNewPhoto(e.target.files[0])}
                className="border p-1 w-full"
              />
              <button
                onClick={() => handleUploadFile(selectedAct, "photo", newPhoto)}
                className="mt-1 bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded"
              >
                Завантажити фото
              </button>
            </div>

            {/* Кнопки закриття/збереження */}
            <div className="flex justify-end mt-4 space-x-2">
              <button
                onClick={() => setSelectedAct(null)}
                className="bg-gray-300 hover:bg-gray-400 px-4 py-2 rounded"
              >
                Закрити
              </button>
              <button
                onClick={() => handleUpdateAct(selectedAct)}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
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
