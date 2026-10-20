import { Link } from "react-router-dom";

interface StatCardProps {
  label: string;
  value: number;
  href?: string;
  accent?: "default" | "success" | "warning" | "error";
}

const ACCENT_CLASSES: Record<NonNullable<StatCardProps["accent"]>, string> = {
  default: "text-[#0F2747]",
  success: "text-[#15803D]",
  warning: "text-[#B45309]",
  error: "text-[#B91C1C]",
};

export default function StatCard({
  label,
  value,
  href,
  accent = "default",
}: StatCardProps) {
  const content = (
    <div className="rounded-lg border border-[#E2E8F0] bg-white p-5 transition hover:border-[#334E68]">
      <p className="text-sm font-medium text-[#64748B]">{label}</p>
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
