import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function AddAct() {
  const [form, setForm] = useState({
    date: '',
    amount: '',
    receiver: '',
    act_number: '',
    pdf: null,
    photo: null,
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [user, setUser] = useState(null);

  // Отримуємо авторизованого користувача
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data?.user ?? null));
  }, []);

  const handleFileChange = (e) => {
    const { name, files } = e.target;
    setForm({ ...form, [name]: files[0] });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      if (!user) throw new Error('Ви не авторизовані');

      let pdfUrl = null;
      let photoUrl = null;

      // Завантаження PDF
      if (form.pdf) {
        const pdfFileName = `${Date.now()}_${form.pdf.name}`;
        const { data: pdfData, error: pdfError } = await supabase.storage
          .from('acts-files')
          .upload(pdfFileName, form.pdf);

        if (pdfError) throw pdfError;

        pdfUrl = supabase.storage.from('acts-files').getPublicUrl(pdfFileName).data.publicUrl;
      }

      // Завантаження фото
      if (form.photo) {
        const photoFileName = `${Date.now()}_${form.photo.name}`;
        const { data: photoData, error: photoError } = await supabase.storage
          .from('acts-files')
          .upload(photoFileName, form.photo);

        if (photoError) throw photoError;

        photoUrl = supabase.storage.from('acts-files').getPublicUrl(photoFileName).data.publicUrl;
      }

      // Вставка рядка в таблицю acts
      const { error } = await supabase.from('acts').insert([{
        date: form.date,
        amount: form.amount,
        receiver: form.receiver,
        act_number: form.act_number,
        pdf_url: pdfUrl,
        photo_url: photoUrl,
        user_id: user.id
      }]);

      if (error) throw error;

      setMessage('Акт додано успішно!');
      setForm({ date: '', amount: '', receiver: '', act_number: '', pdf: null, photo: null });
    } catch (err) {
      console.error(err);
      setMessage('Помилка: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '20px auto' }}>
      <h2>Додати новий акт</h2>
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <input type="date" name="date" value={form.date} onChange={handleChange} required />
        <input type="number" name="amount" value={form.amount} onChange={handleChange} placeholder="Сума" required />
        <input type="text" name="receiver" value={form.receiver} onChange={handleChange} placeholder="Отримувач" required />
        <input type="text" name="act_number" value={form.act_number} onChange={handleChange} placeholder="Номер акту" required />
        <label>
          PDF Акту:
          <input type="file" name="pdf" accept=".pdf" onChange={handleFileChange} />
        </label>
        <label>
          Фото отримання:
          <input type="file" name="photo" accept="image/*" onChange={handleFileChange} />
        </label>
        <button type="submit" disabled={loading}>{loading ? 'Завантаження...' : 'Додати акт'}</button>
      </form>
      {message && <p>{message}</p>}
    </div>
  );
}
