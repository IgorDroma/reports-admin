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
  static async deleteFile(url) {
    if (!url) return;

    try {
      // знайти шлях після назви бакета
      const parts = url.split(`${this.bucket}/`);
      if (parts.length < 2) throw new Error("Invalid file URL");
      const path = parts[1]; // приклад: pdfs/ACT123.pdf

      const { error } = await supabase.storage
        .from(this.bucket)
        .remove([path]);
      if (error) throw error;

      console.log("✅ File deleted:", path);
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
