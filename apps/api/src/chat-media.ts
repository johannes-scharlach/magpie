/** Chat attachments are signed URLs into our own Supabase storage. Only the
 *  signed path and token are taken from the client; the host is always ours.
 *  A phone may reach Supabase by another address (a LAN or Tailscale IP in
 *  dev), and a tampered client must never steer the API to internal hosts. */
export function ownStorageUrl(url: URL, supabaseUrl: string): URL | null {
  if (!url.pathname.startsWith("/storage/v1/object/sign/")) return null;
  return new URL(`${url.pathname}${url.search}`, supabaseUrl);
}
