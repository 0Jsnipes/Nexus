// Video provider abstraction. Nexus never talks to a video SDK directly from
// feature components — everything goes through this interface so a real
// provider (LiveKit, Daily, Jitsi, Zoom, Google Meet) can be dropped in later
// without touching Meetings UI.
//
// A token-based provider (LiveKit/Daily) needs a server to mint join tokens
// with a secret API key — that secret must never reach the client. This repo
// has no backend/edge function yet, so only the "external link" provider is
// wired up today. To add LiveKit/Daily: create a Supabase Edge Function that
// mints a token using a service-role/API secret (set as a Supabase secret,
// never a VITE_ env var), and implement `getJoinUrl` below to call it.

export const VIDEO_PROVIDERS = {
  external: {
    id: "external",
    label: "External link",
    getJoinUrl: async (meeting) => meeting.meeting_url || null,
  },
  // livekit: { id: "livekit", label: "LiveKit", getJoinUrl: async (meeting) => { /* call edge function */ } },
  // daily: { id: "daily", label: "Daily", getJoinUrl: async (meeting) => { /* call edge function */ } },
};

export const getVideoProvider = (providerId) => VIDEO_PROVIDERS[providerId] || VIDEO_PROVIDERS.external;
