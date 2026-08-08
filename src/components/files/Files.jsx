import { useEffect, useMemo, useState } from "react";
import "./files.css";
import { supabase } from "../../lib/supabase";
import { useWorkspaceStore, selectActiveMembership } from "../../lib/workspaceStore";
import EmptyState from "../shared/EmptyState";
import { FiFile, FiImage, FiSearch, FiGrid, FiList } from "react-icons/fi";
import { resolveStorageUrl } from "../../lib/storage";

const Files = () => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [layout, setLayout] = useState("grid");
  const active = useWorkspaceStore(selectActiveMembership);

  useEffect(() => {
    if (!active) return;
    setLoading(true);
    supabase
      .from("files")
      .select("*, uploader:profiles(username)")
      .eq("workspace_id", active.workspace_id)
      .order("created_at", { ascending: false })
      .then(async ({ data }) => {
        const resolved = await Promise.all(
          (data || []).map(async (file) => ({ ...file, url: await resolveStorageUrl(file.url) }))
        );
        setFiles(resolved);
        setLoading(false);
      });
  }, [active]);

  const visible = useMemo(() => {
    return files
      .filter((f) => f.name.toLowerCase().includes(search.toLowerCase()))
      .filter((f) => typeFilter === "all" || (typeFilter === "image" ? f.type?.startsWith("image/") : !f.type?.startsWith("image/")));
  }, [files, search, typeFilter]);

  if (!active) return null;

  return (
    <div className="nx-page">
      <div className="nx-page-header">
        <h2>Files</h2>
        <div className="nx-row">
          <button type="button" className={`nx-btn nx-btn-icon ${layout === "grid" ? "nx-btn-primary" : ""}`} onClick={() => setLayout("grid")}><FiGrid size={14} /></button>
          <button type="button" className={`nx-btn nx-btn-icon ${layout === "list" ? "nx-btn-primary" : ""}`} onClick={() => setLayout("list")}><FiList size={14} /></button>
        </div>
      </div>

      <div className="nx-row" style={{ marginBottom: 14, gap: 8 }}>
        <div className="rooms-search" style={{ maxWidth: 240 }}>
          <FiSearch size={13} />
          <input placeholder="Search files" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="nx-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={{ maxWidth: 160 }}>
          <option value="all">All types</option>
          <option value="image">Images</option>
          <option value="other">Other</option>
        </select>
      </div>

      {loading && <div className="nx-skeleton" style={{ height: 120 }} />}

      {!loading && visible.length === 0 && (
        <EmptyState title="No files yet" description="Files shared as attachments in rooms will show up here." />
      )}

      {layout === "grid" ? (
        <div className="files-grid">
          {visible.map((f) => (
            <a key={f.id} className="file-card" href={f.url} target="_blank" rel="noreferrer">
              {f.type?.startsWith("image/") ? <img src={f.url} alt={f.name} /> : <div className="file-card-icon"><FiFile size={22} /></div>}
              <div className="file-card-name">{f.name}</div>
              <div className="nx-muted file-card-meta">{f.uploader?.username} · {new Date(f.created_at).toLocaleDateString()}</div>
            </a>
          ))}
        </div>
      ) : (
        <table className="task-table">
          <thead><tr><th>Name</th><th>Uploaded by</th><th>Date</th><th>Size</th></tr></thead>
          <tbody>
            {visible.map((f) => (
              <tr key={f.id} onClick={() => window.open(f.url, "_blank", "noopener,noreferrer")}>
                <td className="nx-row">{f.type?.startsWith("image/") ? <FiImage size={14} /> : <FiFile size={14} />} {f.name}</td>
                <td>{f.uploader?.username}</td>
                <td>{new Date(f.created_at).toLocaleDateString()}</td>
                <td>{f.size ? `${Math.round(f.size / 1024)} KB` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default Files;
