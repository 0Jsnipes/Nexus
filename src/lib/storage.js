import { supabase } from "./supabase";

// path: e.g. `${workspaceId}/attachments/${file.name}` or `profile/${uid}/${file.name}`
export const uploadFile = async (path, file) => {
  const key = `${path}/${Date.now()}-${file.name}`;
  const { error } = await supabase.storage.from("nexus").upload(key, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from("nexus").getPublicUrl(key);
  return data.publicUrl;
};
