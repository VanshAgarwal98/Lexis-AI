import { useState, useRef } from "react";
import { UploadCloud, FileText, Check, AlertCircle } from "lucide-react";
import { uploadDocument } from "../api";

const DOC_TYPES = [
  "Non-Disclosure Agreement (NDA)",
  "Master Services Agreement (MSA)",
  "Vendor / Supplier Agreement",
  "Employment Agreement",
  "Commercial Lease Agreement",
  "Software License / SaaS Agreement",
  "Other Legal Contract",
];

const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".txt"];

export default function UploadPanel({ onUploaded }) {
  const [file, setFile] = useState(null);
  const [docType, setDocType] = useState(DOC_TYPES[0]);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef();

  function pickFile(f) {
    if (!f) return;
    setError(null);
    const ext = "." + f.name.split(".").pop().toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setError(`Unsupported file type "${ext}". Please upload a PDF, DOCX, or TXT contract.`);
      return;
    }
    setFile(f);
  }

  async function handleUpload() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const record = await uploadDocument(file, docType);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      onUploaded(record);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div className="glass-card">
      <div className="card-header-row">
        <h2 className="card-title">
          <UploadCloud size={20} color="var(--accent-purple)" />
          Upload Legal Contract
        </h2>
        <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
          SECURE PARSER
        </span>
      </div>

      {error && (
        <div className="error-banner">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      <div
        className={`dropzone ${dragging ? "dragging" : ""}`}
        onClick={() => inputRef.current && inputRef.current.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files[0]) pickFile(e.dataTransfer.files[0]);
        }}
      >
        <div className="dropzone-icon">
          <FileText size={26} />
        </div>
        <div className="dropzone-title">Click to browse or drop agreement here</div>
        <div className="dropzone-sub">
          Supported file formats: PDF, DOCX, TXT · Maximum 50 MB
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,.txt"
          hidden
          onChange={(e) => e.target.files[0] && pickFile(e.target.files[0])}
        />

        {file && (
          <div className="file-chip">
            <Check size={16} color="var(--risk-green)" />
            <span>{file.name} ({formatBytes(file.size)})</span>
          </div>
        )}
      </div>

      <div className="field-row">
        <div className="field">
          <label>Contract Category</label>
          <select value={docType} onChange={(e) => setDocType(e.target.value)}>
            {DOC_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ marginTop: 22, display: "flex", justifyContent: "flex-end" }}>
        <button className="btn" disabled={!file || busy} onClick={handleUpload}>
          {busy && <span className="spinner" />}
          {busy ? "Parsing & Ingesting…" : "Upload Contract"}
        </button>
      </div>
    </div>
  );
}
