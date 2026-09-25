const LONG_EDGE = 480;

export type StagedPhotoRecord = {
  blob: Blob;
  displayBlob?: Blob;
  filename: string;
  mimeType: string;
};

export function photoFromRecord(record: StagedPhotoRecord): { file: File; display: Blob } {
  const file = new File([record.blob], record.filename, { type: record.mimeType });
  return { file, display: record.displayBlob ?? file };
}

export async function smallerPicture(file: Blob): Promise<Blob | null> {
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") return null;
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
    const { width, height } = displaySize(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, width, height);
    return await new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.82));
  } catch {
    return null;
  } finally {
    bitmap?.close();
  }
}

export function displaySize(width: number, height: number): { width: number; height: number } {
  const long = Math.max(width, height);
  if (long <= LONG_EDGE) return { width, height };
  const scale = LONG_EDGE / long;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}
