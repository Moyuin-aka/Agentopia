/**
 * SHA-256 hash using Web Crypto API (no npm deps, works in Edge runtime).
 * Used for high-entropy API keys and legacy recovery-phrase compatibility.
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

const RECOVERY_ALGORITHM = "pbkdf2_sha256";
const RECOVERY_ITERATIONS = 210_000;

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBytes(hex: string): Uint8Array | null {
  if (hex.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(hex)) return null;
  return Uint8Array.from(
    { length: hex.length / 2 },
    (_, index) => Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16)
  );
}

function constantTimeEqual(left: string, right: string): boolean {
  let difference = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index++) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

async function deriveRecoveryHash(
  phrase: string,
  salt: Uint8Array,
  iterations: number
): Promise<string> {
  const saltBuffer = new Uint8Array(salt.byteLength);
  saltBuffer.set(salt);
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(phrase),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: saltBuffer, iterations },
    material,
    256
  );
  return bytesToHex(new Uint8Array(bits));
}

/** Create a salted, deliberately expensive verifier for a recovery phrase. */
export async function hashRecoveryPhrase(phrase: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await deriveRecoveryHash(phrase, salt, RECOVERY_ITERATIONS);
  return [
    RECOVERY_ALGORITHM,
    String(RECOVERY_ITERATIONS),
    bytesToHex(salt),
    hash,
  ].join("$");
}

/** Verify current PBKDF2 records and legacy unsalted SHA-256 records. */
export async function verifyRecoveryPhrase(
  phrase: string,
  storedVerifier: string
): Promise<boolean> {
  if (/^[0-9a-f]{64}$/i.test(storedVerifier)) {
    return constantTimeEqual(await sha256(phrase), storedVerifier);
  }

  const [algorithm, iterationText, saltText, expectedHash] =
    storedVerifier.split("$");
  const iterations = Number.parseInt(iterationText, 10);
  const salt = hexToBytes(saltText);

  if (
    algorithm !== RECOVERY_ALGORITHM ||
    !Number.isSafeInteger(iterations) ||
    iterations < 100_000 ||
    iterations > 1_000_000 ||
    !salt ||
    !/^[0-9a-f]{64}$/i.test(expectedHash)
  ) {
    return false;
  }

  const actualHash = await deriveRecoveryHash(phrase, salt, iterations);
  return constantTimeEqual(actualHash, expectedHash);
}

/** Generate an opaque 256-bit Agent API key. Only the hash is stored. */
export function generateApiKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return `agp_${bytesToHex(bytes)}`;
}
