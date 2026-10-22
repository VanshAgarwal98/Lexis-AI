import { useState } from "react";
import { 
  LayoutDashboard, 
  FolderKanban, 
  UploadCloud, 
  GitCompare, 
  Scale, 
  Sparkles,
  ShieldCheck,
  Menu,
  X
} from "lucide-react";
import DashboardOverview from "./components/DashboardOverview";
import DocumentList from "./components/DocumentList";
import UploadPanel from "./components/UploadPanel";
import AnalysisView from "./components/AnalysisView";
import CompareView from "./components/CompareView";

const NAV_ITEMS = [
  { key: "overview", label: "Command Center", icon: LayoutDashboard },
  { key: "library", label: "Contract Library", icon: FolderKanban },
  { key: "upload", label: "Ingest Contract", icon: UploadCloud },
  { key: "compare", label: "Redline & Compare", icon: GitCompare },
];

export default function App() {
  const [view, setView] = useState("overview");
  const [selectedDocId, setSelectedDocId] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  function handleSelectDoc(id) {
    setSelectedDocId(id);
    setView("analysis");
  }

  function handleBackToLibrary() {
    setSelectedDocId(null);
    setView("library");
  }

  function handleNavClick(key) {
    setSelectedDocId(null);
    setView(key);
    setMobileMenuOpen(false);
  }

  return (
    <div className="app-shell">
      {/* Mobile Header Bar */}
      <div className="mobile-header-toggle">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="brand-icon-box" style={{ width: 30, height: 30 }}>
            <Scale size={16} />
          </div>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16 }}>
            Lexis AI
          </span>
        </div>
        <button 
          className="btn secondary sm" 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {/* Futuristic AI Sidebar */}
      <aside className={`sidebar ${mobileMenuOpen ? "mobile-open" : ""}`}>
        <div className="brand-wrapper">
          <div className="brand-logo-row">
            <div className="brand-icon-box">
              <Scale size={20} />
            </div>
            <div>
              <div className="brand-name">LEXIS AI</div>
              <div className="brand-tagline">Legal Intelligence</div>
            </div>
          </div>
        </div>

        <div className="nav-section-title">Navigation</div>
        <ul className="nav-list">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = view === item.key && !selectedDocId;
            return (
              <li
                key={item.key}
                className={`nav-item ${isActive ? "active" : ""}`}
                onClick={() => handleNavClick(item.key)}
              >
                <span className="nav-icon"><Icon size={18} /></span>
                <span>{item.label}</span>
              </li>
            );
          })}
        </ul>

        {/* Live System Status Box */}
        <div className="sidebar-status-box">
          <div className="status-badge-live">
            <span className="live-pulse" />
            <span>GEMINI LIVE</span>
          </div>
          <div className="sidebar-footer-text">
            Enterprise Contract Intelligence & Liability Engine
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main">
        {view === "overview" && (
          <DashboardOverview 
            onSelectDoc={handleSelectDoc}
            onGoToUpload={() => setView("upload")}
            onGoToCompare={() => setView("compare")}
          />
        )}

        {view === "library" && (
          <DocumentList onSelect={handleSelectDoc} />
        )}

        {view === "upload" && (
          <div>
            <div className="page-header">
              <div>
                <div className="page-eyebrow">Ingestion</div>
                <h1 className="page-title">Ingest Legal Contract</h1>
                <p className="page-sub">
                  Upload agreements in PDF, DOCX, or TXT format for instant neural clause parsing and liability evaluation.
                </p>
              </div>
            </div>
            <UploadPanel onUploaded={(record) => handleSelectDoc(record.id)} />
          </div>
        )}

        {view === "compare" && (
          <CompareView />
        )}

        {view === "analysis" && selectedDocId && (
          <AnalysisView docId={selectedDocId} onBack={handleBackToLibrary} />
        )}
      </main>
    </div>
  );
}
