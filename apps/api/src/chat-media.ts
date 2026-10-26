/** Chat attachments are signed URLs into our own Supabase storage. Anything
 *  else in a file part came from a tampered client, and fetching it would let
 *  that client reach internal addresses through the API. */
export function isSignedStorageUrl(url: URL, supabaseUrl: string): boolean {
  const own = new URL(supabaseUrl);
  return (
    url.origin === own.origin &&
    url.pathname.startsWith("/storage/v1/object/sign/")
  );
}
