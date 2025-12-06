// pages/admin/acts/index.js

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../../../lib/supabaseClient";

export default function ActsList() {
  const router = useRouter();
  const [user, setUser] = useState(null);

  const [acts, setActs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [page, setPage] = useState(0);
  const pageSize = 50;

  // Фільтри
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [receiver, setReceiver] = useState("");
  const [actId, setActId] = useState("");

  // Модалка товарів
  const [itemsModalOpen, setItemsModalOpen] = useState(false);
  const [itemsModalAct, setItemsModalAct] = useState(null);
  const [itemsModalItems, setItemsModalItems] = useState([]);
  const [itemsModalLoading, setItemsModalLoading] = useState(false);

  // Модалка фото
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [photoModalAct, setPhotoModalAct] = useState(null);
  const [photoModalImages, setPhotoModalImages] = useState([]);
  const [photoUploading, setPhotoUploading] = useState(false);

  // AUTH
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data?.user ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => setUser(session?.user ?? null)
    );
    return () => listener?.subscription?.unsubscribe?.();
  }, []);

  // Load acts
  useEffect(() => {
    if (!user) return;
    loadActs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, page]);

  async function loadActs() {
    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from("acts")
        .select("*", { count: "exact" })
        .order("act_date", { ascending: false })
        .range(page * pageSize, page * pageSize + pageSize - 1);

      if (dateFrom) query = query.gte("act_date", dateFrom);
      if (dateTo) query = query.lte("act_date", dateTo + " 23:59:59");
      if (receiver) query = query.ilike("receiver", `%${receiver}%`);
      if (actId) query = query.ilike("id", `%${actId}%`);

      const { data, error } = await query;
      if (error) throw error;

      setActs(data || []);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // --------- МОДАЛКА ТОВАРІВ ---------

  async function openItemsModal(act) {
    setItemsModalAct(act);
    setItemsModalItems([]);
    setItemsModalLoading(true);
    setItemsModalOpen(true);

    const { data, error } = await supabase
      .from("act_items")
      .select(
        `
        id,
        qty,
        sum,
        price,
        products (
          name,
          category_id,
          product_categories ( name )
        )
      `
      )
      .eq("act_id", act.id)
      .order("id", { ascending: true });

    if (error) {
      console.error(error);
      setItemsModalItems([]);
    } else {
      const mapped = (data || []).map((item) => ({
        id: item.id,
        qty: item.qty,
        sum: item.sum,
        price: item.price,
        product_name: item.products?.name || "",
        category: item.products?.product_categories?.name || "",
      }));
      setItemsModalItems(mapped);
    }

    setItemsModalLoading(false);
  }

  // --------- МОДАЛКА ФОТО ---------

  function openPhotoModal(act) {
    setPhotoModalAct(act);
    setPhotoModalImages(Array.isArray(act.photo_urls) ? act.photo_urls : []);
    setPhotoModalOpen(true);
  }

  async function handlePhotoUpload(e) {
    const files = e.target.files;
    if (!files || files.length === 0 || !photoModalAct) return;

    setPhotoUploading(true);

    try {
      let newUrls = [...photoModalImages];

      for (const file of files) {
        const ext = file.name.split(".").pop();
        const fileName = `${photoModalAct.id}-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}.${ext}`;
        const filePath = `${photoModalAct.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("acts-files")
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
          .from("acts-files")
          .getPublicUrl(filePath);

        newUrls.push(data.publicUrl);
      }

      const { error: updateError } = await supabase
        .from("acts")
        .update({ photo_urls: newUrls })
        .eq("id", photoModalAct.id);

      if (updateError) throw updateError;

      // оновлюємо локальний стан
      setPhotoModalImages(newUrls);
      setActs((prev) =>
        prev.map((a) =>
          a.id === photoModalAct.id ? { ...a, photo_urls: newUrls } : a
        )
      );
    } catch (err) {
      console.error(err);
      alert("Помилка завантаження фото: " + err.message);
    } finally {
      setPhotoUploading(false);
      // очищаємо інпут, щоб можна було завантажити ті ж файли ще раз
      e.target.value = "";
    }
  }

  async function deletePhoto(url) {
    if (!photoModalAct) return;
    if (!confirm("Видалити це фото?")) return;

    try {
      // витягуємо шлях відносно бакета
      const prefix = "/storage/v1/object/public/acts-files/";
      const idx = url.indexOf(prefix);
      if (idx === -1) {
        console.warn("Не вдалося визначити шлях файла для видалення");
      } else {
        const path = url.slice(idx + prefix.length);
        await supabase.storage.from("acts-files").remove([path]);
      }

      const newUrls = photoModalImages.filter((u) => u !== url);

      const { error } = await supabase
        .from("acts")
        .update({ photo_urls: newUrls })
        .eq("id", photoModalAct.id);

      if (error) throw error;

      setPhotoModalImages(newUrls);
      setActs((prev) =>
        prev.map((a) =>
          a.id === photoModalAct.id ? { ...a, photo_urls: newUrls } : a
        )
      );
    } catch (err) {
      console.error(err);
      alert("Помилка видалення фото: " + err.message);
    }
  }

  // --------- UI ---------

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg">
          Please sign in →{" "}
          <a href="/" className="text-blue-600 underline">
            Login
          </a>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-6">
      {/* HEADER */}
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Акти</h1>
        <button
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          onClick={() => router.push("/admin/import-json")}
        >
          Імпорт JSON
        </button>
      </header>

      {/* ФІЛЬТРИ */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">
          Фільтри
        </h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              Дата від
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full rounded-md border border-slate-200 px-2 py-1 text-sm focus:border-slate-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              Дата до
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full rounded-md border border-slate-200 px-2 py-1 text-sm focus:border-slate-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              Отримувач
            </label>
            <input
              type="text"
              value={receiver}
              onChange={(e) => setReceiver(e.target.value)}
              className="w-full rounded-md border border-slate-200 px-2 py-1 text-sm focus:border-slate-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              ID акту
            </label>
            <input
              type="text"
              value={actId}
              onChange={(e) => setActId(e.target.value)}
              className="w-full rounded-md border border-slate-200 px-2 py-1 text-sm focus:border-slate-400 focus:outline-none"
            />
          </div>

          <div className="flex items-end gap-2">
            <button
              className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500"
              onClick={() => {
                setPage(0);
                loadActs();
              }}
            >
              Застосувати
            </button>
          </div>
        </div>
      </section>

      {/* ТАБЛИЦЯ АКТІВ */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        {error && (
          <p className="mb-2 text-sm text-red-500">Помилка: {error}</p>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Дата</th>
                <th className="px-3 py-2">ID акту</th>
                <th className="px-3 py-2">Отримувач</th>
                <th className="px-3 py-2">Фото</th>
                <th className="px-3 py-2">Дії</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-center text-sm">
                    Завантаження...
                  </td>
                </tr>
              ) : acts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-center text-sm">
                    Немає актів
                  </td>
                </tr>
              ) : (
                acts.map((act) => (
                  <tr
                    key={act.id}
                    className="border-t border-slate-100 hover:bg-slate-50/60"
                  >
                    <td className="px-3 py-2 align-top">
                      {act.act_date
                        ? new Date(act.act_date).toLocaleDateString("uk-UA")
                        : ""}
                    </td>
                    <td className="px-3 py-2 align-top font-mono text-xs text-slate-700">
                      {act.id}
                    </td>
                    <td className="px-3 py-2 align-top">
                      <span className="text-sm">{act.receiver}</span>
                    </td>
                    <td className="px-3 py-2 align-top">
                      {Array.isArray(act.photo_urls) &&
                      act.photo_urls.length > 0 ? (
                        <button
                          className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-500"
                          onClick={() => openPhotoModal(act)}
                        >
                          <span>🖼️</span>
                          <span>
                            Фото
                            {act.photo_urls.length > 1
                              ? ` x${act.photo_urls.length}`
                              : ""}
                          </span>
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">
                          Немає фото
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 align-top">
                      <button
                        className="mr-3 text-sm font-medium text-blue-600 hover:text-blue-500"
                        onClick={() => openItemsModal(act)}
                      >
                        Товари
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ПАГІНАЦІЯ */}
        <div className="mt-4 flex items-center justify-between text-sm">
          <button
            disabled={page === 0}
            className="rounded-md border border-slate-200 px-3 py-1 disabled:opacity-40"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            ← Назад
          </button>
          <span className="text-slate-500">Сторінка {page + 1}</span>
          <button
            className="rounded-md border border-slate-200 px-3 py-1"
            onClick={() => setPage((p) => p + 1)}
          >
            Вперед →
          </button>
        </div>
      </section>

      {/* МОДАЛКА ТОВАРІВ */}
      {itemsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="max-h-[80vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                Товари акту {itemsModalAct?.id}
              </h2>
              <button
                className="text-lg text-slate-400 hover:text-red-500"
                onClick={() => setItemsModalOpen(false)}
              >
                ✕
              </button>
            </div>

            {itemsModalLoading ? (
              <p>Завантаження...</p>
            ) : itemsModalItems.length === 0 ? (
              <p>Немає товарів</p>
            ) : (
              <table className="min-w-full text-sm border border-slate-100 rounded-md overflow-hidden">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-2 py-1 text-left">Назва</th>
                    <th className="px-2 py-1 text-left">Категорія</th>
                    <th className="px-2 py-1 text-right">Кількість</th>
                    <th className="px-2 py-1 text-right">Сума</th>
                  </tr>
                </thead>
                <tbody>
                  {itemsModalItems.map((it) => (
                    <tr key={it.id} className="border-t border-slate-100">
                      <td className="px-2 py-1">{it.product_name}</td>
                      <td className="px-2 py-1">{it.category}</td>
                      <td className="px-2 py-1 text-right">{it.qty}</td>
                      <td className="px-2 py-1 text-right">
                        {it.sum.toLocaleString("uk-UA")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* МОДАЛКА ФОТО */}
      {photoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="max-h-[85vh] w-full max-w-4xl overflow-y-auto rounded-xl bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                Фото акту {photoModalAct?.id}
              </h2>
              <button
                className="text-lg text-slate-400 hover:text-red-500"
                onClick={() => setPhotoModalOpen(false)}
              >
                ✕
              </button>
            </div>

            {/* Грід із фото */}
            {photoModalImages.length === 0 ? (
              <p className="mb-4 text-sm text-slate-500">
                Фото ще не завантажені
              </p>
            ) : (
              <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                {photoModalImages.map((url, index) => (
                  <div
                    key={index}
                    className="overflow-hidden rounded-lg border border-slate-200"
                  >
                    <a href={url} target="_blank" rel="noreferrer">
                      <img
                        src={url}
                        className="h-64 w-full object-cover"
                        alt={`Фото ${index + 1}`}
                      />
                    </a>
                    <div className="flex justify-between border-t border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                      <span className="truncate">{url}</span>
                      <button
                        className="ml-2 text-red-500 hover:text-red-600"
                        onClick={() => deletePhoto(url)}
                      >
                        Видалити
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Завантаження нових фото */}
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-sm">
              <p className="mb-2 font-medium text-slate-700">
                Додати фото / PDF
              </p>
              <input
                type="file"
                multiple
                accept="image/*,application/pdf"
                onChange={handlePhotoUpload}
                disabled={photoUploading}
                className="text-sm"
              />
              {photoUploading && (
                <p className="mt-1 text-xs text-slate-500">
                  Завантаження...
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
