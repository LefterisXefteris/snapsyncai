import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const STORAGE_BUCKET = 'product-images';

// Lazy singleton — client is created on first use, not at module load time.
// This prevents a fatal startup crash when SUPABASE_URL is not yet in the
// environment (e.g. missing Vercel env var scope) while still failing fast
// with a useful message if the var is genuinely absent at call time.
let _client: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (_client) return _client;

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error(
      'SUPABASE_URL environment variable is not set. ' +
      'Add it to your Vercel project environment variables (all environments).'
    );
  }
  if (!supabaseKey) {
    throw new Error(
      'SUPABASE_ANON_KEY environment variable is not set. ' +
      'Add it to your Vercel project environment variables (all environments).'
    );
  }

  _client = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

  return _client;
}

// Exported for callers that need direct client access
export function getSupabase(): SupabaseClient {
  return getSupabaseClient();
}

export async function uploadImageToStorage(
  fileBuffer: Buffer,
  mimeType: string,
  imageId: number,
  originalName: string,
): Promise<string | null> {
  const supabase = getSupabaseClient();
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
