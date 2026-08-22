import { supabase } from "./supabase";

const invokeGoogle = async (body) => {
  const { data, error } = await supabase.functions.invoke("google-calendar", { body });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
};

export const getCalendarConnections = async () => {
  const { data, error } = await supabase.from("calendar_connections").select("provider, account_email, status");
  if (error) throw error;
  return data || [];
};

export const connectGoogleCalendar = async () => {
  const data = await invokeGoogle({ action: "auth-url", redirectTo: window.location.origin });
  window.location.assign(data.url);
};

export const disconnectGoogleCalendar = () => invokeGoogle({ action: "disconnect" });

export const createGoogleMeeting = ({ meeting, attendeeEmails = [] }) =>
  invokeGoogle({ action: "create-meeting", meeting, attendeeEmails });
