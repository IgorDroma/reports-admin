import { supabase } from "./supabaseClient";

// Клас для роботи з файлами у бакеті
export class FileHelper {
  static bucket = "acts-files";

  // Генерація імені файлу (наприклад: pdfs/ACT123.pdf)
  static generateFileName(actNumber, folder, ext) {
    const safeNumber =
      actNumber?.toString().replaceAll(" ", "_").replaceAll("/", "-") ||
      "noNumber";
    return `${folder}/${safeNumber}_${Date.now()}.${ext}`;
  }

  // Завантаження файлу і повернення публічного URL
  static async uploadFile(file, folder, actNumber) {
    const ext = file.name.split(".").pop();
    const fileName = this.generateFileName(actNumber, folder, ext);

    const { error: uploadError } = await supabase.storage
      .from(this.bucket)
      .upload(fileName, file, { upsert: true });
    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from(this.bucket).getPublicUrl(fileName);
    return { path: fileName, url: data.publicUrl };
  }

  // Видалення файлу
  static async deleteFile(url, actId, type) {
  if (!url || !actId || !type) throw new Error("Missing parameters");

  try {
    // знайти шлях після назви бакета
    const parts = url.split(`${this.bucket}/`);
    if (parts.length < 2) throw new Error("Invalid file URL");
    const path = parts[1]; // наприклад "pdfs/ACT123.pdf"

    // 1️⃣ Видаляємо файл із Supabase Storage
    const { error: delErr } = await supabase.storage
      .from(this.bucket)
      .remove([path]);
    if (delErr) throw delErr;

    console.log("✅ File deleted from storage:", path);

    // 2️⃣ Очищаємо поле у базі (pdf_url або photo_url)
    const fieldName = `${type}_url`;
    const { error: updErr } = await supabase
      .from("acts")
      .update({ [fieldName]: null })
      .eq("id", actId);

    if (updErr) throw updErr;
    console.log(`✅ Cleared ${fieldName} for act id=${actId}`);

    return true;
  } catch (err) {
    console.error("❌ Error deleting file:", err.message);
    throw err;
  }
}


  // Отримати публічний URL з шляху
  static getPublicUrl(path) {
    return supabase.storage.from(this.bucket).getPublicUrl(path).data.publicUrl;
  }
}
