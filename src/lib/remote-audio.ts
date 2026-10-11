import { AppError, BadRequestError } from "./errors";

// Groq's limit for a transcription upload.
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
const STORAGE_HOST = "res.cloudinary.com";

export class AudioTooLongError extends AppError {
  constructor() {
    super("That recording is too long to transcribe.", 413, "AUDIO_TOO_LONG");
  }
}

// Fetched server-side, so held to the upload host even though the url comes from our own database.
export const fetchStoredAudio = async function (url: string) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new BadRequestError("This recording can't be transcribed.");
  }
  if (parsed.protocol !== "https:" || parsed.hostname !== STORAGE_HOST) {
    throw new BadRequestError("This recording can't be transcribed.");
  }

  const response = await fetch(parsed, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new AppError("Couldn't load that recording. Please try again.", 502);
  if (Number(response.headers.get("content-length") ?? 0) > MAX_AUDIO_BYTES) throw new AudioTooLongError();

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_AUDIO_BYTES) throw new AudioTooLongError();

  const name = parsed.pathname.split("/").pop() ?? "";
  return { bytes, filename: /\.[a-z0-9]{2,4}$/i.test(name) ? name : `${name || "recording"}.m4a` };
};
