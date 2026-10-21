import sustLogo from "../assets/sust-logo.png";

interface SustLogoProps {
  /** Tailwind height class, e.g. "h-9". Width follows the image's aspect ratio. */
  heightClass?: string;
  /**
   * Put the logo on a white round badge. Needed on the dark-navy header
   * bars, where the logo's black lettering would otherwise disappear.
   */
  badge?: boolean;
  className?: string;
}

/** The official SUST logo — one component so every placement stays consistent. */
export default function SustLogo({
  heightClass = "h-10",
  badge = false,
  className = "",
}: SustLogoProps) {
  const img = (
    <img
      src={sustLogo}
      alt="Shahjalal University of Science and Technology logo"
      className={`${heightClass} w-auto shrink-0 ${badge ? "" : className}`}
    />
  );
  if (!badge) return img;
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-white p-1 ${className}`}
    >
      {img}
    </span>
  );
}
