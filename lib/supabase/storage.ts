import { createClient } from "@supabase/supabase-js";

const BUCKET = "logos";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase storage env vars missing");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Uploads a company logo and returns its storage path. */
export async function uploadLogo(
  companyId: string,
  bytes: ArrayBuffer,
  contentType: string,
): Promise<string> {
  const ext = contentType.includes("svg")
    ? "svg"
    : contentType.includes("ico")
      ? "ico"
      : "png";
  const path = `companies/${companyId}.${ext}`;
  const { error } = await adminClient()
    .storage.from(BUCKET)
    .upload(path, bytes, { contentType, upsert: true });
  if (error) throw new Error(`Logo upload failed: ${error.message}`);
  return path;
}

/** Public URL for a stored logo path (bucket is public). */
export function logoPublicUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}
