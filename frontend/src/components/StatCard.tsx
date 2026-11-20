import { Link } from "react-router-dom";

interface StatCardProps {
  label: string;
  value: number;
  href?: string;
  accent?: "default" | "success" | "warning" | "error";
}

const ACCENT_CLASSES: Record<NonNullable<StatCardProps["accent"]>, string> = {
  default: "text-primary",
  success: "text-success",
  warning: "text-warning",
  error: "text-error",
};

export default function StatCard({
  label,
  value,
  href,
  accent = "default",
}: StatCardProps) {
  const content = (
    <div className="rounded-lg border border-border bg-white p-5 transition hover:border-secondary">
      <p className="text-sm font-medium text-text-muted">{label}</p>
      <p className={`mt-2 text-3xl font-semibold ${ACCENT_CLASSES[accent]}`}>
        {value}
      </p>
    </div>
  );

  if (href) {
    return <Link to={href}>{content}</Link>;
  }

  return content;
}
