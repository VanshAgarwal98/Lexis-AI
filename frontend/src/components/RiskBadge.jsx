import { AlertTriangle, AlertCircle, CheckCircle2 } from "lucide-react";

export default function RiskBadge({ level }) {
  const normalized = (level || "").toLowerCase();
  
  if (normalized === "red") {
    return (
      <span className="risk-badge red">
        <AlertTriangle size={13} />
        High Risk
      </span>
    );
  }
  
  if (normalized === "yellow") {
    return (
      <span className="risk-badge yellow">
        <AlertCircle size={13} />
        Review Advised
      </span>
    );
  }
  
  return (
    <span className="risk-badge green">
      <CheckCircle2 size={13} />
      Standard
    </span>
  );
}
