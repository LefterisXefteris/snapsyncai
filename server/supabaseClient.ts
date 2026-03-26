import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
// Use anon key — bucket has open RLS policies for server-side uploads
const supabaseKey = process.env.SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

export const STORAGE_BUCKET = 'product-images';

export async function uploadImageToStorage(
  fileBuffer: Buffer,
  mimeType: string,
  imageId: number,
  originalName: string,
): Promise<string | null> {
  const ext = originalName.split('.').pop() || 'jpg';
  const path = `${imageId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, fileBuffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (error) {
    console.error('Supabase Storage upload error:', error.message);
    return null;
  }

  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
