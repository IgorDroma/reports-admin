import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useRouter } from "next/router";

export default function ActEditPage() {
  const router = useRouter();
  const { id } = router.query;

  const [act, setAct] = useState(null);
  const [newPdf, setNewPdf] = useState(null);
  const [newPhoto, setNewPhoto] = useState(null);
  const [loading, setLoading] = useState(false);

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

  const handleChange = (e) => {
    const { name, files, value } = e.target;
    setAct(prev => ({ ...prev, [name]: files ? files[0] : value }));
  }

  const uploadFile = async (file, folder) => {
    if (!file) return null;
    const fileName = `${folder}/${act.id}-${Date.now()}_${file.name.replaceAll(' ','_')}`;
    const { data, error } = await supabase.storage.from('acts-files').upload(fileName, file, { upsert: true });
    if (error) throw error;
    const { data: publicData } = supabase.storage.from('acts-files').getPublicUrl(fileName);
    return fileName; // Зберігаємо внутрішній шлях, як в Add.js
  }

  const handleUploadFile = async (type) => {
    try {
      const file = type === 'pdf' ? newPdf : newPhoto;
      if (!file) return;
      const folder = type === 'pdf' ? 'pdfs' : 'photos';
      const path = await uploadFile(file, folder);
      const { error } = await supabase
        .from('acts')
        .update({ [type + '_url']: path })
        .eq('id', act.id);
      if (error) throw error;
      setAct(prev => ({ ...prev, [type + '_url']: path }));
      if (type === 'pdf') setNewPdf(null);
      else setNewPhoto(null);
    } catch (err) {
      console.error(err);
    }
  }

  const handleDeleteFile = async (type) => {
    const path = act[type + '_url'];
    if (!path) return;
    const { error: storageError } = await supabase.storage.from('acts-files').remove([path]);
    if (storageError) {
      console.error(storageError.message);
      return;
    }
    const { error: dbError } = await supabase
      .from('acts')
      .update({ [type + '_url']: null })
      .eq('id', act.id);
    if (dbError) console.error(dbError);
    else setAct(prev => ({ ...prev, [type + '_url']: null }));
  }

  const handleUpdateAct = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("acts")
        .update({
          date: act.date,
          act_number: act.act_number,
          receiver: act.receiver,
          amount: act.amount
        })
        .eq("id", act.id);
      if (error) throw error;
      router.push("/acts");
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const getFileUrl = (path) =>
    path ? supabase.storage.from("acts-files").getPublicUrl(path).data.publicUrl : null;

  if (!act) return <div className="p-6">Loading...</div>;

  return (
    <div className="max-w-lg mx-auto p-6 bg-white shadow rounded mt-10">
      <h1 className="text-2xl font-bold mb-6 text-center">Редагування акту №{act.act_number}</h1>

      <div className="mb-4">
        <label className="block font-medium mb-1">Дата</label>
        <input type="date" name="date" value={act.date} onChange={handleChange} className="border p-2 w-full rounded"/>
      </div>
      <div className="mb-4">
        <label className="block font-medium mb-1">Номер акту</label>
        <input type="text" name="act_number" value={act.act_number} onChange={handleChange} className="border p-2 w-full rounded"/>
      </div>
      <div className="mb-4">
        <label className="block font-medium mb-1">Отримувач</label>
        <input type="text" name="receiver" value={act.receiver} onChange={handleChange} className="border p-2 w-full rounded"/>
      </div>
      <div className="mb-4">
        <label className="block font-medium mb-1">Сума</label>
        <input type="number" name="amount" value={act.amount} onChange={handleChange} className="border p-2 w-full rounded"/>
      </div>

      {/* PDF */}
      <div className="mb-4">
        <label className="block font-medium mb-1">PDF</label>
        {act.pdf_url && (
          <div className="flex items-center space-x-2 mb-2">
            <a href={getFileUrl(act.pdf_url)} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">Поточний PDF</a>
            <button onClick={() => handleDeleteFile('pdf')} className="text-red-500 hover:text-red-700">Видалити</button>
          </div>
        )}
        <input type="file" accept="application/pdf" onChange={e => setNewPdf(e.target.files[0])} className="border p-2 w-full rounded"/>
        <button onClick={() => handleUploadFile('pdf')} className="mt-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded">Завантажити PDF</button>
      </div>

      {/* Фото */}
      <div className="mb-4">
        <label className="block font-medium mb-1">Фото</label>
        {act.photo_url && (
          <div className="flex items-center space-x-2 mb-2">
            <a href={getFileUrl(act.photo_url)} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">Поточне фото</a>
            <button onClick={() => handleDeleteFile('photo')} className="text-red-500 hover:text-red-700">Видалити</button>
          </div>
        )}
        <input type="file" accept="image/*" onChange={e => setNewPhoto(e.target.files[0])} className="border p-2 w-full rounded"/>
        <button onClick={() => handleUploadFile('photo')} className="mt-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded">Завантажити фото</button>
      </div>

      <div className="flex justify-between mt-6">
        <button onClick={() => router.push('/acts')} className="bg-gray-300 hover:bg-gray-400 px-4 py-2 rounded">Назад</button>
        <button onClick={handleUpdateAct} disabled={loading} className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded">{loading ? 'Saving...' : 'Зберегти'}</button>
      </div>
    </div>
  )
}
