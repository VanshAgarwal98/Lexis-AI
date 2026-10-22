import { useEffect, useState } from "react";
import { 
  FileText, 
  Search, 
  Trash2, 
  ArrowRight, 
  Filter, 
  Upload, 
  Sparkles, 
  AlertCircle 
} from "lucide-react";
import { listDocuments, deleteDocument } from "../api";
import UploadPanel from "./UploadPanel";

export default function DocumentList({ onSelect }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("ALL");
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState(null);
  const [showUpload, setShowUpload] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const data = await listDocuments();
      setDocs(data);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  async function handleDelete(id, e) {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this document from the repository?")) return;
    setDeletingId(id);
    setError(null);
    try {
      await deleteDocument(id);
      await refresh();
    } catch (e) {
      setError(`Failed to delete document: ${e.message}`);
    } finally {
      setDeletingId(null);
    }
  }

  const filteredDocs = docs.filter(d => {
    const matchesSearch = d.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          d.doc_type.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;
    if (selectedFilter === "ANALYZED") return d.analyzed;
    if (selectedFilter === "PENDING") return !d.analyzed;
    return true;
  });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, margin: "0 0 4px" }}>
            Contract Document Repository
          </h2>
          <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: 14 }}>
            Manage uploaded legal documents, review clause extraction, or add new agreements.
          </p>
        </div>
        <button 
          className={`btn ${showUpload ? "secondary" : "cyan"}`} 
          onClick={() => setShowUpload(!showUpload)}
        >
          {showUpload ? "Hide Upload Panel" : "+ Ingest Agreement"}
        </button>
      </div>

      {showUpload && (
        <div style={{ marginBottom: 24 }}>
          <UploadPanel onUploaded={() => { setShowUpload(false); refresh(); }} />
        </div>
      )}

      {error && (
        <div className="error-banner">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      <div className="glass-card">
        {/* Search and Filters Bar */}
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ position: "relative", minWidth: 260, flex: 1, maxWidth: 420 }}>
            <Search size={16} color="var(--text-muted)" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
            <input
              type="text"
              placeholder="Search contracts by name or type…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingLeft: 38 }}
            />
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            {["ALL", "ANALYZED", "PENDING"].map((f) => (
              <button
                key={f}
                className={`filter-tab-btn ${selectedFilter === f ? "active" : ""}`}
                onClick={() => setSelectedFilter(f)}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ padding: "40px 0", textAlign: "center", color: "var(--text-muted)" }}>
            <span className="spinner" style={{ marginRight: 8 }} />
            Loading repository contracts…
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="empty-state">
            <FileText className="empty-icon" />
            <div className="em-title">No matching contracts found</div>
            <p>
              {searchTerm ? "Try adjusting your search query or filters." : "Upload a contract above to start analyzing."}
            </p>
          </div>
        ) : (
          <table className="doc-table">
            <thead>
              <tr>
                <th>Document Name</th>
                <th>Category</th>
                <th>Ingested Date</th>
                <th>Status</th>
                <th>Risk Metrics</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDocs.map((d) => (
                <tr key={d.id} onClick={() => onSelect(d.id)} style={{ cursor: "pointer" }}>
                  <td className="doc-name">
                    <FileText size={18} color="var(--accent-purple-light)" />
                    <span>{d.filename}</span>
                  </td>
                  <td>{d.doc_type}</td>
                  <td className="doc-meta">
                    {d.uploaded_at ? new Date(d.uploaded_at).toLocaleDateString() : "—"}
                  </td>
                  <td>
                    <span className={`status-pill ${d.analyzed ? "done" : "pending"}`}>
                      {d.analyzed ? "Analyzed" : "Pending"}
                    </span>
                  </td>
                  <td>
                    {d.risk_counts ? (
                      <div style={{ display: "flex", gap: 6 }}>
                        {d.risk_counts.red > 0 && (
                          <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--risk-red)", background: "var(--risk-red-bg)", padding: "2px 6px", borderRadius: 4 }}>
                            {d.risk_counts.red} Red
                          </span>
                        )}
                        {d.risk_counts.yellow > 0 && (
                          <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--risk-yellow)", background: "var(--risk-yellow-bg)", padding: "2px 6px", borderRadius: 4 }}>
                            {d.risk_counts.yellow} Review
                          </span>
                        )}
                        {d.risk_counts.green > 0 && (
                          <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--risk-green)", background: "var(--risk-green-bg)", padding: "2px 6px", borderRadius: 4 }}>
                            {d.risk_counts.green} Standard
                          </span>
                        )}
                      </div>
                    ) : (
                      <span style={{ color: "var(--text-muted)", fontSize: 12 }}>Unanalyzed</span>
                    )}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <div style={{ display: "inline-flex", gap: 8 }}>
                      <button
                        className="btn secondary sm"
                        onClick={(e) => { e.stopPropagation(); onSelect(d.id); }}
                      >
                        {d.analyzed ? "View Analysis" : "Run AI Review"}
                        <ArrowRight size={13} />
                      </button>
                      <button
                        className="btn danger sm"
                        disabled={deletingId === d.id}
                        onClick={(e) => handleDelete(d.id, e)}
                        title="Delete contract"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
