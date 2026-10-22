import { useEffect, useState } from "react";
import { 
  ArrowLeft, 
  Sparkles, 
  Download, 
  Copy, 
  Check, 
  MessageSquare, 
  AlertTriangle, 
  ShieldAlert, 
  Send, 
  FileText, 
  HelpCircle,
  Search,
  Scale
} from "lucide-react";
import { getDocument, analyzeDocument, downloadReport, chatWithDocument } from "../api";
import RiskBadge from "./RiskBadge";

const ANALYSIS_STEPS = [
  "Ingesting raw document bytes and extracting text layers…",
  "Segmenting contractual clauses (Termination, Indemnity, Liability)…",
  "Evaluating legal risk severity & liability exposure…",
  "Synthesizing executive summary & structured key terms…"
];

export default function AnalysisView({ docId, onBack }) {
  const [doc, setDoc] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisStepIndex, setAnalysisStepIndex] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);
  const [copiedSummary, setCopiedSummary] = useState(false);

  // Clause filtering & search
  const [clauseFilter, setClauseFilter] = useState("ALL");
  const [clauseSearch, setClauseSearch] = useState("");

  // AI Chat Assistant
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    { sender: "ai", text: "Hello! I am your AI Contract Assistant. Ask me anything about this agreement's clauses, liabilities, obligations, or termination terms." }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  async function refresh() {
    try {
      const data = await getDocument(docId);
      setDoc(data);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => { refresh(); }, [docId]);

  async function handleAnalyze() {
    setAnalyzing(true);
    setAnalysisStepIndex(0);
    setError(null);

    // Realistic progressive steps indicator
    const stepInterval = setInterval(() => {
      setAnalysisStepIndex((prev) => (prev < ANALYSIS_STEPS.length - 1 ? prev + 1 : prev));
    }, 1800);

    try {
      const updated = await analyzeDocument(docId);
      setDoc(updated);
    } catch (e) {
      setError(e.message);
    } finally {
      clearInterval(stepInterval);
      setAnalyzing(false);
    }
  }

  async function handleExportPdf() {
    if (!doc) return;
    setExporting(true);
    setError(null);
    try {
      const baseName = doc.filename && doc.filename.lastIndexOf(".") !== -1
        ? doc.filename.substring(0, doc.filename.lastIndexOf("."))
        : (doc.filename || "contract");
      await downloadReport(docId, baseName);
    } catch (e) {
      setError(`Failed to download report: ${e.message}`);
    } finally {
      setExporting(false);
    }
  }

  function handleCopySummary() {
    if (!doc?.analysis?.summary) return;
    navigator.clipboard.writeText(doc.analysis.summary);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2000);
  }

  async function handleSendChat(textToSend) {
    const q = textToSend || chatInput;
    if (!q || !q.trim() || chatLoading) return;
    
    const userMsg = { sender: "user", text: q.trim() };
    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput("");
    setChatLoading(true);

    try {
      const res = await chatWithDocument(docId, q.trim());
      setChatMessages((prev) => [...prev, { sender: "ai", text: res.answer }]);
    } catch (err) {
      setChatMessages((prev) => [...prev, { sender: "ai", text: `Error: ${err.message}` }]);
    } finally {
      setChatLoading(false);
    }
  }

  if (!doc) {
    return (
      <div className="glass-card" style={{ textAlign: "center", padding: 60 }}>
        <span className="spinner" style={{ marginRight: 8 }} />
        <span>Loading document intelligence…</span>
      </div>
    );
  }

  const analysis = doc.analysis;
  const clauses = analysis?.clauses || [];

  const riskCounts = { red: 0, yellow: 0, green: 0 };
  clauses.forEach((c) => {
    const lvl = (c.risk_level || "").toLowerCase();
    if (riskCounts[lvl] !== undefined) riskCounts[lvl]++;
  });

  // Calculate Overall Risk Score
  let riskScore = 0;
  if (clauses.length > 0) {
    const weighted = (riskCounts.red * 40) + (riskCounts.yellow * 20) + (riskCounts.green * 5);
    riskScore = Math.min(100, Math.round((weighted / (clauses.length * 35)) * 100));
  }

  const riskLevelLabel = riskScore >= 60 ? "High Risk Profile" : riskScore >= 35 ? "Moderate Exposure" : "Standard Risk Profile";
  const riskColor = riskScore >= 60 ? "var(--risk-red)" : riskScore >= 35 ? "var(--risk-yellow)" : "var(--risk-green)";

  // Filter clauses
  const filteredClauses = clauses.filter((c) => {
    const lvl = (c.risk_level || "").toLowerCase();
    if (clauseFilter === "RED" && lvl !== "red") return false;
    if (clauseFilter === "YELLOW" && lvl !== "yellow") return false;
    if (clauseFilter === "GREEN" && lvl !== "green") return false;

    if (clauseSearch) {
      const term = clauseSearch.toLowerCase();
      return (c.type || "").toLowerCase().includes(term) ||
             (c.excerpt || "").toLowerCase().includes(term) ||
             (c.risk_reason || "").toLowerCase().includes(term);
    }
    return true;
  });

  return (
    <div>
      {/* Top Navigation Row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <button className="btn secondary sm" onClick={onBack}>
          <ArrowLeft size={14} /> Back to Repository
        </button>

        {analysis && (
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn secondary sm" onClick={() => setChatOpen(!chatOpen)}>
              <MessageSquare size={14} color="var(--accent-cyan)" />
              {chatOpen ? "Close AI Chat" : "Ask Contract AI"}
            </button>
            <button className="btn sm" onClick={handleExportPdf} disabled={exporting}>
              {exporting ? <span className="spinner" /> : <Download size={14} />}
              {exporting ? "Generating PDF…" : "Export Executive PDF"}
            </button>
          </div>
        )}
      </div>

      {/* Contract Title & Type Header */}
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <div className="page-eyebrow">
            <Scale size={13} />
            {doc.doc_type || "Commercial Contract"}
          </div>
          <h1 className="page-title">{doc.filename}</h1>
          <p className="page-sub">
            Uploaded on {doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleString() : "Recently"} · AI Paralegal Review
          </p>
        </div>

        {analysis && (
          <button className="btn secondary sm" onClick={handleAnalyze} disabled={analyzing}>
            {analyzing ? <span className="spinner" /> : <Sparkles size={14} color="var(--accent-purple-light)" />}
            {analyzing ? "Re-evaluating…" : "Re-run AI Analysis"}
          </button>
        )}
      </div>

      {error && (
        <div className="error-banner">
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* State A: Analyzing (Scanning Laser Animation) */}
      {analyzing && (
        <div className="scanning-card">
          <div className="scanner-beam-box">
            <div className="scanner-laser" />
            <FileText size={42} color="var(--accent-purple-light)" style={{ marginTop: 32, opacity: 0.8 }} />
          </div>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "#FFFFFF", margin: "0 0 8px" }}>
            Deep Contract Ingestion & Clause Evaluation
          </h2>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, margin: "0 0 20px" }}>
            Google Gemini neural engine is reading and cross-referencing your legal agreement…
          </p>
          <div className="scanning-steps-list">
            {ANALYSIS_STEPS.map((step, idx) => (
              <div 
                key={idx} 
                className={`scanning-step-item ${idx === analysisStepIndex ? "active" : ""}`}
                style={{ opacity: idx <= analysisStepIndex ? 1 : 0.35 }}
              >
                {idx < analysisStepIndex ? (
                  <Check size={16} color="var(--risk-green)" />
                ) : idx === analysisStepIndex ? (
                  <span className="spinner" style={{ width: 14, height: 14 }} />
                ) : (
                  <div style={{ width: 14, height: 14, borderRadius: "50%", border: "1px solid var(--text-muted)" }} />
                )}
                <span>{step}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* State B: Unanalyzed */}
      {!analyzing && !analysis && (
        <div className="glass-card" style={{ textAlign: "center", padding: 50 }}>
          <ShieldAlert size={52} color="var(--accent-purple-light)" style={{ margin: "0 auto 16px" }} />
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "#FFFFFF", margin: "0 0 8px" }}>
            Contract Ready for Intelligent Review
          </h2>
          <p style={{ color: "var(--text-secondary)", fontSize: 14.5, maxWidth: 520, margin: "0 auto 24px" }}>
            Extract distinct contractual provisions, evaluate liability caps, flag unusual indemnities, and generate executive summaries.
          </p>
          <button className="btn" onClick={handleAnalyze}>
            <Sparkles size={16} />
            Start AI Review with Gemini
          </button>
        </div>
      )}

      {/* State C: Fully Analyzed Dashboard */}
      {!analyzing && analysis && (
        <>
          {/* Risk Dial & Executive Score Card */}
          <div className="risk-meter-card">
            <div className="gauge-circle-container">
              <svg viewBox="0 0 100 100" width="120" height="120">
                <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
                <circle 
                  cx="50" 
                  cy="50" 
                  r="42" 
                  fill="none" 
                  stroke={riskColor}
                  strokeWidth="10" 
                  strokeDasharray="264" 
                  strokeDashoffset={264 - (264 * riskScore) / 100}
                  strokeLinecap="round" 
                  transform="rotate(-90 50 50)" 
                  style={{ transition: "stroke-dashoffset 1s ease" }}
                />
              </svg>
              <div className="gauge-center-text">
                <div className="gauge-score">{riskScore}</div>
                <div className="gauge-label">RISK INDEX</div>
              </div>
            </div>

            <div className="meter-details">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <h2 className="meter-title">{riskLevelLabel}</h2>
                <RiskBadge level={riskScore >= 60 ? "red" : riskScore >= 35 ? "yellow" : "green"} />
              </div>
              <p className="meter-desc">
                Calculated from {clauses.length} distinct contractual provisions. 
                {riskCounts.red > 0 
                  ? ` Attention needed: ${riskCounts.red} high-exposure clauses detected.` 
                  : " All provisions align with standard commercial practices."}
              </p>
              <div className="meter-bars">
                <span className="meter-pill" style={{ background: "var(--risk-red-bg)", color: "var(--risk-red)", border: "1px solid var(--risk-red-border)" }}>
                  <AlertTriangle size={13} /> {riskCounts.red} High Risk
                </span>
                <span className="meter-pill" style={{ background: "var(--risk-yellow-bg)", color: "var(--risk-yellow)", border: "1px solid var(--risk-yellow-border)" }}>
                  <HelpCircle size={13} /> {riskCounts.yellow} Review Advised
                </span>
                <span className="meter-pill" style={{ background: "var(--risk-green-bg)", color: "var(--risk-green)", border: "1px solid var(--risk-green-border)" }}>
                  <Check size={13} /> {riskCounts.green} Standard Mutual
                </span>
              </div>
            </div>
          </div>

          {/* Interactive AI Paralegal Chat Drawer */}
          {chatOpen && (
            <div className="chat-drawer">
              <div className="card-header-row">
                <h3 className="card-title">
                  <MessageSquare size={18} color="var(--accent-cyan)" />
                  AI Paralegal Contextual Q&A
                </h3>
                <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--accent-cyan)" }}>
                  LIVE DOCUMENT CONTEXT
                </span>
              </div>

              {/* Suggested Prompt Chips */}
              <div className="chat-prompts-row">
                {[
                  "Summarize termination rights and notice period",
                  "What is the liability cap under this agreement?",
                  "Are there any indemnification obligations?",
                  "What are the payment and invoicing terms?"
                ].map((chip) => (
                  <button key={chip} className="prompt-chip" onClick={() => handleSendChat(chip)}>
                    {chip}
                  </button>
                ))}
              </div>

              {/* Message History */}
              <div className="chat-history">
                {chatMessages.map((m, idx) => (
                  <div key={idx} className={`chat-bubble ${m.sender}`}>
                    {m.text}
                  </div>
                ))}
                {chatLoading && (
                  <div className="chat-bubble ai" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="spinner" /> Analyzing contract clauses…
                  </div>
                )}
              </div>

              {/* Chat Input */}
              <div className="chat-input-bar">
                <input 
                  type="text"
                  placeholder="Ask any question about this contract…"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendChat()}
                />
                <button className="btn cyan" onClick={() => handleSendChat()} disabled={chatLoading || !chatInput.trim()}>
                  <Send size={15} />
                </button>
              </div>
            </div>
          )}

          {/* Executive Summary Card */}
          <div className="glass-card">
            <div className="card-header-row">
              <h2 className="card-title">
                <FileText size={18} color="var(--accent-purple-light)" />
                Plain-English Executive Summary
              </h2>
              <button className="btn secondary sm" onClick={handleCopySummary}>
                {copiedSummary ? <Check size={13} color="var(--risk-green)" /> : <Copy size={13} />}
                {copiedSummary ? "Copied!" : "Copy Summary"}
              </button>
            </div>
            <p className="summary-text">{analysis.summary || "No summary available."}</p>
          </div>

          {/* Key Commercial Terms Grid */}
          <div className="glass-card">
            <div className="card-header-row">
              <h2 className="card-title">
                <Sparkles size={18} color="var(--accent-cyan)" />
                Key Commercial Terms & Covenants
              </h2>
              <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                STRUCTURED VALUES
              </span>
            </div>
            {analysis.key_terms && Object.keys(analysis.key_terms).length > 0 ? (
              <div className="terms-grid">
                {Object.entries(analysis.key_terms).map(([k, v]) => (
                  <div className="term-card" key={k}>
                    <div className="term-label">{k.replaceAll("_", " ")}</div>
                    <div className="term-value">{String(v || "—")}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: "var(--text-muted)" }}>No key terms extracted.</p>
            )}
          </div>

          {/* Clause-by-Clause Review */}
          <div className="glass-card">
            <div className="card-header-row">
              <h2 className="card-title">
                <Scale size={18} color="var(--accent-purple-light)" />
                Clause-by-Clause Risk Breakdown ({clauses.length})
              </h2>
            </div>

            {/* Filter Controls */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
              <div className="clause-filter-tabs" style={{ margin: 0 }}>
                <button 
                  className={`filter-tab-btn ${clauseFilter === "ALL" ? "active" : ""}`}
                  onClick={() => setClauseFilter("ALL")}
                >
                  All Provisions ({clauses.length})
                </button>
                <button 
                  className={`filter-tab-btn ${clauseFilter === "RED" ? "active" : ""}`}
                  onClick={() => setClauseFilter("RED")}
                  style={{ color: clauseFilter === "RED" ? "#FFF" : "var(--risk-red)" }}
                >
                  High Risk ({riskCounts.red})
                </button>
                <button 
                  className={`filter-tab-btn ${clauseFilter === "YELLOW" ? "active" : ""}`}
                  onClick={() => setClauseFilter("YELLOW")}
                  style={{ color: clauseFilter === "YELLOW" ? "#FFF" : "var(--risk-yellow)" }}
                >
                  Review Advised ({riskCounts.yellow})
                </button>
                <button 
                  className={`filter-tab-btn ${clauseFilter === "GREEN" ? "active" : ""}`}
                  onClick={() => setClauseFilter("GREEN")}
                  style={{ color: clauseFilter === "GREEN" ? "#FFF" : "var(--risk-green)" }}
                >
                  Standard ({riskCounts.green})
                </button>
              </div>

              <div style={{ position: "relative", minWidth: 200 }}>
                <Search size={14} color="var(--text-muted)" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
                <input 
                  type="text" 
                  placeholder="Filter clauses…"
                  value={clauseSearch}
                  onChange={(e) => setClauseSearch(e.target.value)}
                  style={{ padding: "6px 10px 6px 30px", fontSize: 13 }}
                />
              </div>
            </div>

            {filteredClauses.length === 0 ? (
              <div style={{ padding: "30px 0", textAlign: "center", color: "var(--text-muted)" }}>
                No clauses match the selected filter.
              </div>
            ) : (
              filteredClauses.map((c, i) => (
                <div className="clause-row" key={i}>
                  <div className="clause-header-meta">
                    <span className="clause-type-tag">{c.type || "Contractual Clause"}</span>
                    <RiskBadge level={c.risk_level} />
                  </div>
                  
                  {c.excerpt && (
                    <div className="clause-excerpt-box">
                      "{c.excerpt}"
                    </div>
                  )}

                  <p className="clause-reason-text">
                    <strong style={{ color: "#FFFFFF" }}>Paralegal Assessment:</strong> {c.risk_reason}
                  </p>
                </div>
              ))
            )}
          </div>

          {/* Legal Disclaimer */}
          <div className="legal-disclaimer">
            <Scale size={24} color="var(--accent-cyan)" style={{ flexShrink: 0 }} />
            <div>
              <strong>Legal Notice:</strong> AI-generated analysis is intended to assist with contract review and is not a substitute for professional legal advice. Important legal decisions should be reviewed by a qualified attorney.
            </div>
          </div>
        </>
      )}
    </div>
  );
}
