import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useWorkspaceStore, selectActiveMembership } from "../../lib/workspaceStore";
import { PERMISSIONS } from "../../lib/permissions";

const EDITABLE_ROLES = ["admin", "member", "guest"];

const RolesSettings = () => {
  const active = useWorkspaceStore(selectActiveMembership);
  const can = useWorkspaceStore((s) => s.can);
  const fetchRolePermissions = useWorkspaceStore((s) => s.fetchRolePermissions);
  const [matrix, setMatrix] = useState({});
  const editable = can("manage_roles");

  useEffect(() => {
    if (!active) return;
    supabase
      .from("role_permissions")
      .select("role, permission")
      .eq("workspace_id", active.workspace_id)
      .then(({ data }) => {
        const m = {};
        (data || []).forEach((rp) => {
          m[`${rp.role}:${rp.permission}`] = true;
        });
        setMatrix(m);
      });
  }, [active]);

  const toggle = async (role, permission) => {
    if (!editable) return;
    const key = `${role}:${permission}`;
    const has = matrix[key];

    if (has) {
      await supabase.from("role_permissions").delete().eq("workspace_id", active.workspace_id).eq("role", role).eq("permission", permission);
    } else {
      await supabase.from("role_permissions").insert({ workspace_id: active.workspace_id, role, permission });
    }
    setMatrix((prev) => ({ ...prev, [key]: !has }));
    fetchRolePermissions(active.workspace_id);
  };

  return (
    <div>
      <p className="nx-hint" style={{ marginBottom: 12 }}>Owners always have every permission. Toggle capabilities per role below.</p>
      <div className="roles-matrix nx-scroll">
        <table className="task-table">
          <thead>
            <tr>
              <th>Permission</th>
              {EDITABLE_ROLES.map((r) => <th key={r} style={{ textTransform: "capitalize" }}>{r}</th>)}
            </tr>
          </thead>
          <tbody>
            {PERMISSIONS.map((perm) => (
              <tr key={perm}>
                <td>{perm.replace(/_/g, " ")}</td>
                {EDITABLE_ROLES.map((role) => (
                  <td key={role} style={{ textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={!!matrix[`${role}:${perm}`]}
                      onChange={() => toggle(role, perm)}
                      disabled={!editable}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RolesSettings;
