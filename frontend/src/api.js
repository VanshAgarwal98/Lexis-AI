const BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

async function handle(res) {
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch (_) {}
    throw new Error(detail);
  }
  return res;
}

async function safeFetch(url, options = {}) {
  try {
    const res = await fetch(url, options);
    return await handle(res);
  } catch (err) {
    if (err instanceof TypeError && (err.message.includes("fetch") || err.message.includes("NetworkError"))) {
      throw new Error(`Unable to reach backend server. Please ensure the backend is running.`);
    }
    throw err;
  }
}

export async function uploadDocument(file, docType) {
  const form = new FormData();
  form.append("file", file);
  form.append("doc_type", docType);
  const res = await safeFetch(`${BASE_URL}/documents/upload`, { method: "POST", body: form });
  return res.json();
}

export async function listDocuments() {
  const res = await safeFetch(`${BASE_URL}/documents`);
  return res.json();
}

export async function getDocument(id) {
  const res = await safeFetch(`${BASE_URL}/documents/${id}`);
  return res.json();
}

export async function deleteDocument(id) {
  const res = await safeFetch(`${BASE_URL}/documents/${id}`, { method: "DELETE" });
  return res.json();
}

export async function analyzeDocument(id) {
  const res = await safeFetch(`${BASE_URL}/documents/${id}/analyze`, { method: "POST" });
  return res.json();
}

export async function getHealth() {
  const res = await safeFetch(`${BASE_URL}/health`);
  return res.json();
}

export async function chatWithDocument(id, question) {
  const res = await safeFetch(`${BASE_URL}/documents/${id}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
  return res.json();
}

export async function compareDocuments(docIdA, docIdB) {
  const res = await safeFetch(`${BASE_URL}/documents/compare`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ doc_id_a: docIdA, doc_id_b: docIdB }),
  });
  return res.json();
}

export async function downloadReport(id, filenameHint) {
  const res = await safeFetch(`${BASE_URL}/documents/${id}/report`);
  const blob = await res.blob();
  triggerDownload(blob, `${filenameHint || "report"}.pdf`);
}

export async function downloadComparisonReport(docIdA, docIdB) {
  const res = await safeFetch(`${BASE_URL}/documents/compare/report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ doc_id_a: docIdA, doc_id_b: docIdB }),
  });
  const blob = await res.blob();
  triggerDownload(blob, "comparison_report.pdf");
}

function triggerDownload(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => window.URL.revokeObjectURL(url), 100);
}
