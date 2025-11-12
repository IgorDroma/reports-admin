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
  
async function deleteFile(publicUrl) {
  if (!publicUrl) return

  try {
    const path = publicUrl.split('/storage/v1/object/public/acts-files/')[1]
    if (!path) throw new Error('Invalid file URL')

    const { error } = await supabase.storage.from('acts-files').remove([path])
    if (error) throw error

    console.log('✅ File deleted:', path)
    return true
  } catch (err) {
    console.error('❌ Error deleting file:', err.message)
    throw err
  }
}

export { deleteFile }

