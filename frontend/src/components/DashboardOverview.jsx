import { useEffect, useState } from "react";
import { 
  FileText, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  ArrowRight, 
  Sparkles, 
  ShieldCheck, 
  Activity,
  Cpu
} from "lucide-react";
import { listDocuments, getHealth } from "../api";
import RiskBadge from "./RiskBadge";

export default function DashboardOverview({ onSelectDoc, onGoToUpload, onGoToCompare }) {
  const [docs, setDocs] = useState([]);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [docsData, healthData] = await Promise.all([
          listDocuments(),
          getHealth().catch(() => ({ status: "ok", model: "gemini-3.8-flash" }))
        ]);
        setDocs(docsData);
        setHealth(healthData);
      } catch (err) {
        console.error("Dashboard data load error:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const totalDocs = docs.length;
  const analyzedDocs = docs.filter(d => d.analyzed);
  
  let totalRedFlags = 0;
  let totalYellowFlags = 0;
  let totalGreenFlags = 0;

  analyzedDocs.forEach(d => {
    if (d.risk_counts) {
      totalRedFlags += d.risk_counts.red || 0;
      totalYellowFlags += d.risk_counts.yellow || 0;
      totalGreenFlags += d.risk_counts.green || 0;
    }
  });

  return (
    <div>
      {/* Welcome & AI Status Banner */}
      <div className="glass-card" style={{ 
        background: "linear-gradient(135deg, rgba(139, 92, 246, 0.12) 0%, rgba(34, 211, 238, 0.08) 100%)",
        borderColor: "rgba(139, 92, 246, 0.25)"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div className="page-eyebrow">
              <Sparkles size={14} />
              AI-Powered Enterprise Intelligence
            </div>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 700, margin: "6px 0 10px", color: "#FFFFFF" }}>
              Legal Intelligence & Risk Command Center
            </h1>
            <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: 14.5, maxWidth: 640 }}>
              Automated paralegal contract review, redline difference tracking, and liability detection powered by Google Gemini.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
            <div className="status-badge-live">
              <span className="live-pulse" />
              <span>AI ENGINE: {health?.model || "GEMINI-FLASH"}</span>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
              <button className="btn cyan sm" onClick={onGoToUpload}>
                + New Contract
              </button>
              <button className="btn secondary sm" onClick={onGoToCompare}>
                Compare Redlines
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon-wrapper" style={{ background: "rgba(139, 92, 246, 0.15)", color: "var(--accent-purple-light)" }}>
            <FileText size={20} />
          </div>
          <div className="stat-value">{totalDocs}</div>
          <div className="stat-label">Total Ingested Contracts</div>
          <div className="stat-subtext">{analyzedDocs.length} reviewed with AI</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrapper" style={{ background: "rgba(239, 68, 68, 0.15)", color: "var(--risk-red)" }}>
            <AlertTriangle size={20} />
          </div>
          <div className="stat-value" style={{ color: totalRedFlags > 0 ? "var(--risk-red)" : "#FFFFFF" }}>
            {totalRedFlags}
          </div>
          <div className="stat-label">High-Risk Clauses Flagged</div>
          <div className="stat-subtext">Uncapped liability, indemnities</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrapper" style={{ background: "rgba(251, 191, 36, 0.15)", color: "var(--risk-yellow)" }}>
            <Activity size={20} />
          </div>
          <div className="stat-value" style={{ color: "var(--risk-yellow)" }}>
            {totalYellowFlags}
          </div>
          <div className="stat-label">Clauses Needing Review</div>
          <div className="stat-subtext">Notice windows, dispute rules</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrapper" style={{ background: "rgba(52, 211, 153, 0.15)", color: "var(--risk-green)" }}>
            <ShieldCheck size={20} />
          </div>
          <div className="stat-value" style={{ color: "var(--risk-green)" }}>
            {totalGreenFlags}
          </div>
          <div className="stat-label">Standard Mutual Clauses</div>
          <div className="stat-subtext">Balanced commercial terms</div>
        </div>
      </div>

      {/* Recent Activity Table */}
      <div className="glass-card">
        <div className="card-header-row">
          <h2 className="card-title">
            <Clock size={19} color="var(--accent-cyan)" />
            Recent Contract Repository
          </h2>
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
            {docs.length} active documents
          </span>
        </div>

        {loading ? (
          <div style={{ padding: "30px 0", textAlign: "center", color: "var(--text-muted)" }}>
            <span className="spinner" style={{ marginRight: 8 }} />
            Loading repository data…
          </div>
        ) : docs.length === 0 ? (
          <div className="empty-state">
            <FileText className="empty-icon" />
            <div className="em-title">No Contracts Uploaded Yet</div>
            <p>Upload a PDF, DOCX, or TXT contract to run your first AI review.</p>
            <button className="btn cyan sm" onClick={onGoToUpload} style={{ marginTop: 12 }}>
              Upload First Agreement
            </button>
          </div>
        ) : (
          <table className="doc-table">
            <thead>
              <tr>
                <th>Contract Name</th>
                <th>Category</th>
                <th>Uploaded</th>
                <th>Status</th>
                <th>Risk Profile</th>
                <th style={{ textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {docs.slice(0, 5).map((d) => (
                <tr key={d.id} onClick={() => onSelectDoc(d.id)} style={{ cursor: "pointer" }}>
                  <td className="doc-name">
                    <FileText size={17} color="var(--accent-purple-light)" />
                    {d.filename}
                  </td>
                  <td>{d.doc_type}</td>
                  <td className="doc-meta">
                    {d.uploaded_at ? new Date(d.uploaded_at).toLocaleDateString() : "N/A"}
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
                            {d.risk_counts.red} High
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
                      <span style={{ color: "var(--text-muted)", fontSize: 12 }}>—</span>
                    )}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button className="btn secondary sm" onClick={(e) => { e.stopPropagation(); onSelectDoc(d.id); }}>
                      View Analysis <ArrowRight size={13} />
                    </button>
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
