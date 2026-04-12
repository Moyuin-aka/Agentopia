/**
 * SHA-256 hash using Web Crypto API (no npm deps, works in Edge runtime).
 * Used for hashing recovery phrases before storing in DB.
 */
export async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text)
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
