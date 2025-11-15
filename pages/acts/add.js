import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useRouter } from "next/router";

export default function Add() {
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({
    date: "",
    amount: "",
    receiver: "",
    act_number: "",
    pdf: null,
    photo: null,
  });
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // --- LOAD USER ---
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data?.user ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => listener?.subscription?.unsubscribe?.();
  }, []);

  if (!user)
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-lg">
          Please sign in on{" "}
          <a href="/" className="text-blue-500 underline">
            login
          </a>
        </p>
      </div>
    );

  // --- HANDLE FORM INPUT ---
  const handleChange = (e) => {
    const { name, value, files } = e.target;
    setForm((prev) => ({ ...prev, [name]: files ? files[0] : value }));
  };

  // --- UPLOAD TO SUPABASE STORAGE ---
  async function uploadFile(file, folder, actNumber) {
    if (!file) return null;

    const ext = file.name.split(".").pop();
    const fileName = `${actNumber}-${Date.now()}.${ext}`;
    const filePath = `${folder}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("acts-files")
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from("acts-files")
      .getPublicUrl(filePath);

    return data.publicUrl;
  }

  // --- SUBMIT FORM ---
  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const pdfUrl = await uploadFile(form.pdf, "pdfs", form.act_number);
      const photoUrl = await uploadFile(form.photo, "photos", form.act_number);

      const { error } = await supabase.from("acts").insert([
        {
          date: form.date,
          amount: form.amount,
          receiver: form.receiver,
          act_number: form.act_number,
          pdf_url: pdfUrl,
          photo_url: photoUrl,
          user_id: user.id,
        },
      ]);

      if (error) throw error;

      alert("Act added successfully!");
      router.push("/acts");

    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto p-6 mt-10 bg-white shadow-lg rounded-lg">
      <h2 className="text-2xl font-bold mb-6 text-center">Add New Act</h2>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block font-medium mb-1">Date</label>
          <input
            name="date"
            type="date"
            value={form.date}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded px-3 py-2"
            required
          />
        </div>

        <div>
          <label className="block font-medium mb-1">Amount</label>
          <input
            name="amount"
            type="number"
            value={form.amount}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded px-3 py-2"
            required
          />
        </div>

        <div>
          <label className="block font-medium mb-1">Receiver</label>
          <input
            name="receiver"
            type="text"
            value={form.receiver}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded px-3 py-2"
            required
          />
        </div>

        <div>
          <label className="block font-medium mb-1">Act Number</label>
          <input
            name="act_number"
            type="text"
            value={form.act_number}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded px-3 py-2"
            required
          />
        </div>

        <div>
          <label className="block font-medium mb-1">PDF File</label>
          <input name="pdf" type="file" accept="application/pdf" onChange={handleChange} />
        </div>

        <div>
          <label className="block font-medium mb-1">Photo</label>
          <input name="photo" type="file" accept="image/*" onChange={handleChange} />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"
        >
          {loading ? "Uploading..." : "Save"}
        </button>
      </form>
    </div>
  );
}
