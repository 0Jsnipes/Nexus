import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: jsonHeaders });

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY");
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:support@snipessystems.com";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

const truncate = (value: string | null, max = 80) => {
  const text = value?.trim() || "Sent an attachment";
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return json({ error: "push_not_configured" }, 503);

  try {
    const authorization = req.headers.get("Authorization");
    const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return json({ error: "authentication_required" }, 401);

    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData.user) return json({ error: "invalid_token" }, 401);

    const { messageId } = await req.json();
    if (typeof messageId !== "string" || !/^[0-9a-f-]{36}$/i.test(messageId)) {
      return json({ error: "messageId is required" }, 400);
    }

    const { data: message, error: messageError } = await supabase
      .from("messages")
      .select("id, body, sender_id, workspace_id, room_id, dm_id")
      .eq("id", messageId)
      .maybeSingle();
    if (messageError) throw messageError;
    if (!message) return json({ error: "message_not_found" }, 404);
    if (message.sender_id !== authData.user.id) return json({ error: "not_message_sender" }, 403);

    const { data: sender, error: senderError } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", message.sender_id)
      .single();
    if (senderError) throw senderError;

    let recipientRows: Array<{ user_id: string }> = [];
    let context = "a direct message";

    if (message.dm_id) {
      const { data, error } = await supabase
        .from("dm_members")
        .select("user_id")
        .eq("dm_id", message.dm_id);
      if (error) throw error;
      recipientRows = data || [];
    } else if (message.room_id) {
      const { data: room, error: roomError } = await supabase
        .from("rooms")
        .select("name, is_private")
        .eq("id", message.room_id)
        .single();
      if (roomError) throw roomError;
      context = `#${room.name}`;

      const query = room.is_private
        ? supabase.from("room_members").select("user_id").eq("room_id", message.room_id)
        : supabase
            .from("workspace_members")
            .select("user_id")
            .eq("workspace_id", message.workspace_id)
            .eq("status", "active");
      const { data, error } = await query;
      if (error) throw error;
      recipientRows = data || [];
    }

    const recipientIds = Array.from(
      new Set(recipientRows.map((row) => row.user_id).filter((id) => id !== message.sender_id))
    );
    if (!recipientIds.length) return json({ sent: 0, removed: 0 });

    const { data: subscriptions, error: subscriptionError } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .in("user_id", recipientIds);
    if (subscriptionError) throw subscriptionError;
    if (!subscriptions?.length) return json({ sent: 0, removed: 0 });

    const payload = JSON.stringify({
      title: `${sender.username} in ${context}`,
      body: truncate(message.body),
      url: "/?src=pwa",
    });
    const staleIds: string[] = [];
    let sent = 0;

    await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload
          );
          sent += 1;
        } catch (error) {
          const statusCode = (error as { statusCode?: number }).statusCode;
          if (statusCode === 404 || statusCode === 410) staleIds.push(sub.id);
          else console.error("push send failed", sub.id, statusCode);
        }
      })
    );

    if (staleIds.length) {
      const { error } = await supabase.from("push_subscriptions").delete().in("id", staleIds);
      if (error) throw error;
    }

    return json({ sent, removed: staleIds.length });
  } catch (error) {
    console.error(error);
    return json({ error: "internal_error" }, 500);
  }
});
