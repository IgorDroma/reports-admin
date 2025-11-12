import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useRouter } from "next/router";

export default function ActEditPage() {
  const router = useRouter();
  const { id } = router.query;

  const [act, setAct] = useState(null);
  const [newPdf, setNewPdf] = useState(null);
  const [newPhoto, setNewPhoto] = useState(null);

  useEffect(() => {
    if (id) fetchAct();
  }, [id]);

  async function fetchAct() {
    const { data, error } = await supabase
      .from("acts")
      .select("*")
      .eq("id", id)
      .single();

    if (error) console.error(error);
    else setAct(data);
  }

  // --------------------
  // Завантаження файлу
  // --------------------
  async function handleUploadFile(type, file) {
    if (!file) return;

    const folder = type === "pdf" ? "pdfs" : "photos";
    const fileName = `${folder}/${act.id}-${Date.now()}_${file.name.replaceAll(' ', '_')}`;

    const { error: uploadError } = await supabase
      .storage
      .from("acts-files")
      .upload(fileName, file, { upsert: true });

    if (uploadError) {
      console.error(uploadError);
      return;
    }

    const { error: dbError } = await supabase
      .from("acts")
      .update({ [type + "_url"]: fileName })
      .eq("id", act.id);

    if (dbError) console.error(dbError);
    else setAct(prev => ({ ...prev, [type + "_url"]: fileName }));

    if (type === "pdf") setNewPdf(null);
    else setNewPhoto(null);
  }

  // --------------------
  // Видалення файлу
  // --------------------
  async function handleDeleteFile(type) {
    const path = act[type + "_url"];
    if (!path) return;

    const { error: storageError } = await supabase
      .storage
      .from("acts-files")
      .remove([path]);

    if (storageError) {
      console.error("Помилка видалення з бакету:", storageError.message);
      return;
    }

    const { error: dbError } = await supabase
      .from("acts")
      .update({ [type + "_url"]: null })
      .eq("id", act.id);

    if (dbError) console.error(dbError);
    else setAct(prev => ({ ...prev, [type + "_url"]: null }));
  }

  // --------------------
  // Отримати публічний URL
  // --------------------
  const getFileUrl = (path) =>
    path ? supabase.storage.from("acts-files").getPublicUrl(path).data.publicUrl : null;

  // --------------------
  // Оновлення акту
  // --------------------
  async function handleUpdateAct() {
    const { error } = await supabase
      .from("acts")
      .update({
        date: act.date,
        act_number: act.act_number,
        receiver: act.receiver,
        amount: act.amount,
      })
      .eq("id", act.id);

    if (error) console.error(error);
    else router.push("/acts");
  }

  if (!act) return <div>Loading...</div>;

  return (
    <div className="max-w-2xl mx-auto p-6 mt-10 bg-white shadow-lg rounded-lg">
      <h1 className="text-2xl font-bold mb-6 text-center">Редагування акту №{act.act_number}</h1>

      <div className="mb-4">
        <label className="block font-medium mb-1">Дата</label>
        <input
          type="date"
          value={act.date}
          onChange={(e) => setAct({ ...act, date: e.target.value })}
          className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>

      <div className="mb-4">
        <label className="block font-medium mb-1">Номер акту</label>
        <input
          type="text"
          value={act.act_number}
          onChange={(e) => setAct({ ...act, act_number: e.target.value })}
          className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>

      <div className="mb-4">
        <label className="block font-medium mb-1">Отримувач</label>
        <input
          type="text"
          value={act.receiver}
          onChange={(e) => setAct({ ...act, receiver: e.target.value })}
          className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>

      <div className="mb-4">
        <label className="block font-medium mb-1">Сума</label>
        <input
          type="number"
          value={act.amount}
          onChange={(e) => setAct({ ...act, amount: e.target.value })}
          className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>

      {/* PDF */}
      <div className="mb-4">
        <label className="block font-medium mb-1">PDF</label>
        {act.pdf_url && (
          <div className="flex items-center space-x-2 mb-2">
            <a
              href={getFileUrl(act.pdf_url)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 underline"
            >
              Поточний PDF
            </a>
            <button
              onClick={() => handleDeleteFile("pdf")}
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
          className="w-full"
        />
        <button
          onClick={() => handleUploadFile("pdf", newPdf)}
          disabled={!newPdf}
          className="mt-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
        >
          Завантажити PDF
        </button>
      </div>

      {/* Фото */}
      <div className="mb-4">
        <label className="block font-medium mb-1">Фото</label>
        {act.photo_url && (
          <div className="flex items-center space-x-2 mb-2">
            <a
              href={getFileUrl(act.photo_url)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 underline"
            >
              Поточне фото
            </a>
            <button
              onClick={() => handleDeleteFile("photo")}
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
          className="w-full"
        />
        <button
          onClick={() => handleUploadFile("photo", newPhoto)}
          disabled={!newPhoto}
          className="mt-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
        >
          Завантажити Фото
        </button>
      </div>

      <div className="flex justify-between mt-6">
        <button
          onClick={() => router.push("/acts")}
          className="bg-gray-300 hover:bg-gray-400 px-4 py-2 rounded"
        >
          Назад
        </button>
        <button
          onClick={handleUpdateAct}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
        >
          Зберегти
        </button>
      </div>
    </div>
  );
}
