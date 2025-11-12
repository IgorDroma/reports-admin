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

  async function handleUploadFile(type, file) {
    if (!file) return;
    const folder = type === "pdf" ? "pdfs" : "photos";
    const filePath = `${folder}/${act.id}-${file.name}`;

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

  async function handleDeleteFile(type) {
    const url = type === "pdf" ? act.pdf_url : act.photo_url;
    if (!url) return;

    const { error: storageError } = await supabase
      .storage
      .from("acts-files")
      .remove([url]);

    if (storageError) {
      console.error(storageError.message);
      return;
    }

    const { error: dbError } = await supabase
      .from("acts")
      .update({ [type + "_url"]: null })
      .eq("id", act.id);

    if (dbError) console.error(dbError);
    else setAct({ ...act, [type + "_url"]: null });
  }

  const getFileUrl = (path) =>
    path ? supabase.storage.from("acts-files").getPublicUrl(path).data.publicUrl : null;

  if (!act) return <div>Loading...</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Редагування акту №{act.act_number}</h1>

      <div className="mb-2">
        <label className="block font-medium">Дата</label>
        <input
          type="date"
          value={act.date}
          onChange={(e) => setAct({ ...act, date: e.target.value })}
          className="border p-1 w-full"
        />
      </div>

      <div className="mb-2">
        <label className="block font-medium">Номер акту</label>
        <input
          type="text"
          value={act.act_number}
          onChange={(e) => setAct({ ...act, act_number: e.target.value })}
          className="border p-1 w-full"
        />
      </div>

      <div className="mb-2">
        <label className="block font-medium">Отримувач</label>
        <input
          type="text"
          value={act.receiver}
          onChange={(e) => setAct({ ...act, receiver: e.target.value })}
          className="border p-1 w-full"
        />
      </div>

      <div className="mb-2">
        <label className="block font-medium">Сума</label>
        <input
          type="number"
          value={act.amount}
          onChange={(e) => setAct({ ...act, amount: e.target.value })}
          className="border p-1 w-full"
        />
      </div>

      {/* PDF */}
      <div className="mb-2">
        <label className="block font-medium">PDF</label>
        {act.pdf_url && (
          <div className="flex items-center space-x-2 mb-1">
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
          onChange={(e) => handleUploadFile("pdf", e.target.files[0])}
          className="border p-1 w-full"
        />
      </div>

      {/* Фото */}
      <div className="mb-2">
        <label className="block font-medium">Фото</label>
        {act.photo_url && (
          <div className="flex items-center space-x-2 mb-1">
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
          onChange={(e) => handleUploadFile("photo", e.target.files[0])}
          className="border p-1 w-full"
        />
      </div>

      <div className="flex space-x-2 mt-4">
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
