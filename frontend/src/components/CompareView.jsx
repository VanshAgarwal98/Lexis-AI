import { useEffect, useState } from "react";
import { 
  GitCompare, 
  Download, 
  AlertCircle, 
  Check, 
  FileText, 
  ArrowRight,
  Filter
} from "lucide-react";
import { listDocuments, compareDocuments, downloadComparisonReport } from "../api";

export default function CompareView() {
  const [docs, setDocs] = useState([]);
  const [docIdA, setDocIdA] = useState("");
  const [docIdB, setDocIdB] = useState("");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);
  const [diffFilter, setDiffFilter] = useState("ALL"); // ALL or CHANGES_ONLY

  async function loadDocs() {
    try {
      const list = await listDocuments();
      setDocs(list);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => { loadDocs(); }, []);

  async function handleCompare() {
    if (!docIdA || !docIdB) {
      setError("Please select both Document A and Document B to compare.");
      return;
    }
    if (docIdA === docIdB) {
      setError("Please select two distinct contracts to generate a comparison redline.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const data = await compareDocuments(docIdA, docIdB);
      setResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleExportComparisonPdf() {
    if (!docIdA || !docIdB) return;
    setExporting(true);
    setError(null);
    try {
      await downloadComparisonReport(docIdA, docIdB);
    } catch (e) {
      setError(`Failed to download comparison report: ${e.message}`);
    } finally {
      setExporting(false);
    }
  }

  const allTermKeys = result
    ? [...new Set([...Object.keys(result.key_terms_a || {}), ...Object.keys(result.key_terms_b || {})])]
    : [];

  const filteredDiff = (result?.diff || []).filter((line) => {
    if (diffFilter === "CHANGES_ONLY") {
      return line.type === "added" || line.type === "removed";
    }
    return true;
  });

  const addedCount = (result?.diff || []).filter(d => d.type === "added").length;
  const removedCount = (result?.diff || []).filter(d => d.type === "removed").length;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-eyebrow">
            <GitCompare size={14} /> Redline Engine
          </div>
          <h1 className="page-title">Contract Comparison & Redline</h1>
          <p className="page-sub">
            Identify clause additions, revisions, and commercial key term differences between agreement drafts.
          </p>
        </div>
      </div>

      {error && (
        <div className="error-banner">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Selectors Card */}
      <div className="glass-card">
        <div className="compare-selectors-grid">
          <div className="field">
            <label>Baseline Agreement (Draft A)</label>
            <select
              value={docIdA}
              onChange={(e) => { setDocIdA(e.target.value); setError(null); }}
            >
              <option value="">Select baseline document…</option>
              {docs.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.filename} ({d.doc_type})
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Counterparty Draft (Draft B)</label>
            <select
              value={docIdB}
              onChange={(e) => { setDocIdB(e.target.value); setError(null); }}
            >
              <option value="">Select comparison document…</option>
              {docs.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.filename} ({d.doc_type})
                </option>
              ))}
            </select>
          </div>

          <div>
            <button className="btn cyan" onClick={handleCompare} disabled={busy || !docIdA || !docIdB}>
              {busy && <span className="spinner" />}
              {busy ? "Comparing…" : "Compare Drafts"}
            </button>
          </div>
        </div>
      </div>

      {/* Comparison Results */}
      {result && (
        <>
          {/* Key Term Diff Table */}
          <div className="glass-card">
            <div className="card-header-row">
              <h2 className="card-title">
                <FileText size={18} color="var(--accent-purple-light)" />
                Side-by-Side Commercial Terms
              </h2>
              <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                KEY COVENANTS
              </span>
            </div>

            {allTermKeys.length > 0 ? (
              <table className="doc-table">
                <thead>
                  <tr>
                    <th style={{ width: "30%" }}>Term</th>
                    <th style={{ width: "35%" }}>{result.doc_a.filename}</th>
                    <th style={{ width: "35%" }}>{result.doc_b.filename}</th>
                  </tr>
                </thead>
                <tbody>
                  {allTermKeys.map((k) => {
                    const va = result.key_terms_a?.[k] || "—";
                    const vb = result.key_terms_b?.[k] || "—";
                    const differs = va !== vb && va !== "—" && vb !== "—";
                    return (
                      <tr key={k}>
                        <td style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--accent-cyan)" }}>
                          {k.replaceAll("_", " ").toUpperCase()}
                        </td>
                        <td style={{ color: differs ? "#FCA5A5" : "#FFFFFF", fontWeight: differs ? 600 : 400 }}>
                          {va}
                        </td>
                        <td style={{ color: differs ? "#FCA5A5" : "#FFFFFF", fontWeight: differs ? 600 : 400 }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <span>{vb}</span>
                            {differs && (
                              <span style={{ fontSize: 11, background: "var(--risk-red-bg)", color: "var(--risk-red)", border: "1px solid var(--risk-red-border)", padding: "2px 6px", borderRadius: 4 }}>
                                DIFF
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div style={{ padding: "20px 0", color: "var(--text-secondary)", fontSize: 14 }}>
                Run "Run AI Review" on both contracts to generate full key terms comparison.
              </div>
            )}
          </div>

          {/* Redline Diff Viewer */}
          <div className="glass-card">
            <div className="card-header-row">
              <h2 className="card-title">
                <GitCompare size={18} color="var(--accent-cyan)" />
                Line-by-Line Redline View
              </h2>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                  +{addedCount} added · -{removedCount} removed
                </span>
                <div style={{ display: "flex", gap: 6 }}>
                  <button 
                    className={`filter-tab-btn ${diffFilter === "ALL" ? "active" : ""}`}
                    onClick={() => setDiffFilter("ALL")}
                  >
                    All Lines
                  </button>
                  <button 
                    className={`filter-tab-btn ${diffFilter === "CHANGES_ONLY" ? "active" : ""}`}
                    onClick={() => setDiffFilter("CHANGES_ONLY")}
                  >
                    Changes Only
                  </button>
                </div>
              </div>
            </div>

            <div className="diff-viewer">
              {filteredDiff.length > 0 ? (
                filteredDiff.map((line, i) => (
                  <div className={`diff-line ${line.type}`} key={i}>
                    {line.type === "added" ? "+ " : line.type === "removed" ? "- " : "  "}
                    {line.text || " "}
                  </div>
                ))
              ) : (
                <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
                  No textual differences between the two documents in this view.
                </div>
              )}
            </div>
          </div>

          {/* Export Action */}
          <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
            <button className="btn" onClick={handleExportComparisonPdf} disabled={exporting}>
              {exporting ? <span className="spinner" /> : <Download size={14} />}
              {exporting ? "Generating PDF…" : "Export Redline Comparison PDF"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
