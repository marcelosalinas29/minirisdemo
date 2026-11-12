interface StorageError { message: string; statusCode?: string | number; error?: string; code?: string }
interface StudyStorage {
  upload: (path: string, file: Blob, options: { upsert: boolean; contentType?: string }) => PromiseLike<{ error: StorageError | null }>;
  remove: (paths: string[]) => PromiseLike<{ error: StorageError | null }>;
}

export async function savePreviousStudyFile(
  storage: StudyStorage,
  path: string,
  file: Blob,
  register: () => PromiseLike<{ error: StorageError | null }>,
) {
  const { error: uploadError } = await storage.upload(path, file, { upsert: false, contentType: file.type || undefined });
  const duplicate = uploadError && (
    String(uploadError.statusCode) === '409' || uploadError.error === 'Duplicate' ||
    uploadError.code === 'Duplicate' || /already exists|duplicate/i.test(uploadError.message)
  );
  if (uploadError && !duplicate) throw uploadError;
  try {
    const { error } = await register();
    if (error) throw error;
  } catch (error) {
    if (!uploadError) {
      try {
        const { error: cleanupError } = await storage.remove([path]);
        if (cleanupError) console.error('No se pudo limpiar el archivo sin registro:', cleanupError);
      } catch (cleanupError) { console.error('No se pudo limpiar el archivo sin registro:', cleanupError); }
    }
    throw error;
  }
}