import { supabase } from "./supabaseClient";

// Клас для роботи з файлами у бакеті
export class FileHelper {
  static bucket = "acts-files";

  // Генерація імені файлу (наприклад: pdfs/ACT123.pdf)
  static generateFileName(actNumber, folder, ext) {
    const safeNumber = actNumber?.toString().replaceAll(" ", "_").replaceAll("/", "-") || "noNumber";
    return `${folder}/${safeNumber}_${Date.now()}.${ext}`;
  }

  // Завантаження файлу і повернення публічного URL
  static async uploadFile(file, folder, actNumber) {
    const ext = file.name.split(".").pop();
    const fileName = this.generateFileName(actNumber, folder, ext);

    const { error: uploadError } = await supabase.storage.from(this.bucket).upload(fileName, file, {
      upsert: true,
    });
    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from(this.bucket).getPublicUrl(fileName);
    return { path: fileName, url: data.publicUrl };
  }

  // Видалення файлу
  static async deleteFile(url) {
    if (!url) return;
    const path = url.split("/storage/v1/object/public/")[1]?.replace(`${this.bucket}/`, "");
    if (!path) return;

    const { error } = await supabase.storage.from(this.bucket).remove([path]);
    if (error) throw error;
  }

  // Отримати публічний URL з шляху
  static getPublicUrl(path) {
    return supabase.storage.from(this.bucket).getPublicUrl(path).data.publicUrl;
  }
}
