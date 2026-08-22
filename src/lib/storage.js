import { supabase } from "./supabase";

const PROFILE_MAX_BYTES = 5 * 1024 * 1024;
const PRIVATE_MAX_BYTES = 50 * 1024 * 1024;
const PROFILE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const BLOCKED_TYPES = new Set([
  "text/html",
  "application/xhtml+xml",
  "image/svg+xml",
  "application/javascript",
  "text/javascript",
]);
const BLOCKED_EXTENSIONS = /\.(?:html?|xhtml|svg|js|mjs|cjs)$/i;

const safeFilename = (name = "file") => {
  const cleaned = name
    .normalize("NFKC")
    .split("")
    .map((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127 || character === "/" || character === "\\" ? "-" : character;
    })
    .join("")
    .replace(/[^A-Za-z0-9._ -]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 120);
  return cleaned || "file";
};

const validateUpload = (path, file) => {
  if (!file || typeof file.size !== "number") throw new Error("No file selected.");

  const isProfile = path.startsWith("profile/");
  const maxBytes = isProfile ? PROFILE_MAX_BYTES : PRIVATE_MAX_BYTES;
  if (file.size <= 0 || file.size > maxBytes) {
    const maxMb = Math.floor(maxBytes / 1024 / 1024);
    throw new Error(`File must be smaller than ${maxMb} MB.`);
  }

  const type = (file.type || "").toLowerCase();
  if (isProfile && !PROFILE_TYPES.has(type)) {
    throw new Error("Avatar must be a JPG, PNG, WebP, or GIF image.");
  }

  if (BLOCKED_TYPES.has(type) || BLOCKED_EXTENSIONS.test(file.name || "")) {
    throw new Error("This file type is not allowed for security reasons.");
  }
};

// path: e.g. `${workspaceId}/attachments` or `profile/${uid}`
export const uploadFile = async (path, file) => {
  validateUpload(path, file);

  const filename = safeFilename(file.name);
  const key = `${path}/${Date.now()}-${crypto.randomUUID()}-${filename}`;
  const isPublicProfileMedia = path.startsWith("profile/");
  const bucket = isPublicProfileMedia ? "nexus-public" : "nexus";
  const { error } = await supabase.storage.from(bucket).upload(key, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || "application/octet-stream",
  });
  if (error) throw error;
  if (!isPublicProfileMedia) return key;
  const { data } = supabase.storage.from(bucket).getPublicUrl(key);
  return data.publicUrl;
};

export const resolveStorageUrl = async (value, expiresIn = 3600) => {
  if (!value || /^(https?:|blob:|data:)/i.test(value)) return value;
  const { data, error } = await supabase.storage.from("nexus").createSignedUrl(value, expiresIn);
  if (error) throw error;
  return data.signedUrl;
};
