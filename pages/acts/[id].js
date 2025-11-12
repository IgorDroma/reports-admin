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

  // --------------------
  // Завантаження PDF або фото
  // --------------------
  async function handleUploadFile(type, file) {
    if (!file) return;
    const folder = type === "pdf" ? "pdfs" : "photos";
    const filePath = `${folder}/${act.id}-${file.name.replaceAll(" ", "_")}`;

    const { error: uploadError } = await supabase
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
    else setAct({ ...act, [type + "_url"]: filePath });
  }

  // --------------------
  // Видалення PDF або фото
  // --------------------
  async function handleDeleteFile(type) {
    const filePath = type === "pdf" ? act.pdf_url : act.photo_url;
    if (!filePath) return;

    const { error: storageError } = await supabase
      .storage
      .from("acts-files")
      .remove([filePath]);

    if (storageError) {
      console.error("Помилка видалення з бакету:", storageError.message);
      return;
    }

    const { error: dbError } = await supabase
      .from("acts")
      .update({ [type + "_url"]: null })
      .eq("id", act.id);

    if (dbError) console.error(dbError);
    else setAct({ ...act, [type + "_url"]: null });
  }

  // --------------------
  // Отримання публічного URL для перегляду
  // --------------------
  const getFileUrl = (path) =>
    path ? supabase.storage.from("acts-files").getPublicUrl(path).data.publicUrl : null;

  if (!act) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-center">Редагування акту №{act.act_number}</h1>

      {/* Дата */}
      <div className="mb-4">
        <label className="block font-medium mb-1">Дата</label>
        <input
          type="date"
          value={act.date}
          onChange={(e) => setAct({ ...act, date: e.target.value })}
          className="border rounded p-2 w-full"
        />
      </div>

      {/* Номер акту */}
      <div className="mb-4">
        <label className="block font-medium mb-1">Номер акту</label>
        <input
          type="text"
          value={act.act_number}
          onChange={(e) => setAct({ ...act, act_number: e.target.value })}
          className="border rounded p-2 w-full"
        />
      </div>

      {/* Отримувач */}
      <div className="mb-4">
        <label className="block font-medium mb-1">Отримувач</label>
        <input
          type="text"
          value={act.receiver}
          onChange={(e) => setAct({ ...act, receiver: e.target.value })}
          className="border rounded p-2 w-full"
        />
      </div>

      {/* Сума */}
      <div className="mb-4">
        <label className="block font-medium mb-1">Сума</label>
        <input
          type="number"
          value={act.amount}
          onChange={(e) => setAct({ ...act, amount: e.target.value })}
          className="border rounded p-2 w-full"
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
              className="text-blue-600 underline"
            >
              Поточний PDF
            </a>
            <button
              onClick={() => handleDeleteFile("pdf")}
              className="text-red-600 hover:text-red-800 px-2 py-1 border rounded"
            >
              Видалити
            </button>
          </div>
        )}
        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => handleUploadFile("pdf", e.target.files[0])}
          className="border rounded p-2 w-full"
        />
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
              className="text-blue-600 underline"
            >
              Поточне фото
            </a>
            <button
              onClick={() => handleDeleteFile("photo")}
              className="text-red-600 hover:text-red-800 px-2 py-1 border rounded"
            >
              Видалити
            </button>
          </div>
        )}
        <input
          type="file"
          accept="image/*"
          onChange={(e) => handleUploadFile("photo", e.target.files[0])}
          className="border rounded p-2 w-full"
        />
      </div>

      {/* Кнопки */}
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
