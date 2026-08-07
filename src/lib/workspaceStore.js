import { create } from "zustand";
import { supabase } from "./supabase";
import { hasPermission } from "./permissions";

const ACTIVE_WORKSPACE_KEY = "nexus:activeWorkspaceId";

export const useWorkspaceStore = create((set, get) => ({
  memberships: [], // [{ ...workspace_members row, workspace: {...} }]
  activeWorkspaceId: localStorage.getItem(ACTIVE_WORKSPACE_KEY) || null,
  rolePermissions: [],
  isLoading: true,

  can: (permission) => {
    const membership = get().memberships.find((m) => m.workspace_id === get().activeWorkspaceId);
    return hasPermission(membership, get().rolePermissions, permission);
  },

  fetchMemberships: async () => {
    set({ isLoading: true });
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user?.id;
    if (!uid) return set({ memberships: [], isLoading: false });

    const { data, error } = await supabase
      .from("workspace_members")
      .select("*, workspace:workspaces(*)")
      .eq("user_id", uid)
      .eq("status", "active");

    if (error) {
      console.error(error);
      return set({ memberships: [], isLoading: false });
    }

    let activeWorkspaceId = get().activeWorkspaceId;
    if (!activeWorkspaceId || !data.some((m) => m.workspace_id === activeWorkspaceId)) {
      activeWorkspaceId = data[0]?.workspace_id || null;
    }

    set({ memberships: data, activeWorkspaceId, isLoading: false });
    if (activeWorkspaceId) await get().fetchRolePermissions(activeWorkspaceId);
  },

  fetchRolePermissions: async (workspaceId) => {
    const { data, error } = await supabase
      .from("role_permissions")
      .select("role, permission")
      .eq("workspace_id", workspaceId);
    if (!error) set({ rolePermissions: data });
  },

  switchWorkspace: async (workspaceId) => {
    localStorage.setItem(ACTIVE_WORKSPACE_KEY, workspaceId);
    set({ activeWorkspaceId: workspaceId });
    await get().fetchRolePermissions(workspaceId);
  },

  createWorkspace: async ({ name, slug, description, logoUrl }) => {
    const { data, error } = await supabase.rpc("create_workspace", {
      _name: name,
      _slug: slug || null,
      _description: description || null,
      _logo_url: logoUrl || null,
    });
    if (error) throw error;
    await get().fetchMemberships();
    await get().switchWorkspace(data.id);
    return data;
  },

  joinWorkspace: async (code) => {
    const { data, error } = await supabase.rpc("join_workspace", { _code: code });
    if (error) throw error;
    if (!data.ok) return data;
    await get().fetchMemberships();
    if (data.status === "active") await get().switchWorkspace(data.workspace_id);
    return data;
  },

  leaveWorkspace: async (workspaceId) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user?.id;
    const { error } = await supabase
      .from("workspace_members")
      .delete()
      .eq("workspace_id", workspaceId)
      .eq("user_id", uid);
    if (error) throw error;
    localStorage.removeItem(ACTIVE_WORKSPACE_KEY);
    set({ activeWorkspaceId: null });
    await get().fetchMemberships();
  },
}));

export const selectActiveMembership = (state) =>
  state.memberships.find((m) => m.workspace_id === state.activeWorkspaceId) || null;

export const selectActiveWorkspace = (state) => selectActiveMembership(state)?.workspace || null;
