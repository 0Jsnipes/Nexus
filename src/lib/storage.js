import { supabase } from "./supabase";

// path: e.g. `${workspaceId}/attachments/${file.name}` or `profile/${uid}/${file.name}`
export const uploadFile = async (path, file) => {
  const key = `${path}/${Date.now()}-${file.name}`;
  const isPublicProfileMedia = path.startsWith("profile/");
  const bucket = isPublicProfileMedia ? "nexus-public" : "nexus";
  const { error } = await supabase.storage.from(bucket).upload(key, file, {
    cacheControl: "3600",
    upsert: false,
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
