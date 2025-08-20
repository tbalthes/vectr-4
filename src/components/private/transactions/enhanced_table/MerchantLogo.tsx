// This component is mostly correct already, just ensure props are named well.
import Image from "next/image";

interface MerchantLogoProps {
  merchantName: string;
  logoUrl?: string | null; // Can be null
  className?: string;
}

export function MerchantLogo({
  merchantName,
  logoUrl,
  className = "w-8 h-8",
}: MerchantLogoProps) {
  // If a logoUrl is provided, try to render it.
  if (logoUrl) {
    return (
      <Image
        src={logoUrl}
        alt={`${merchantName} logo`}
        className={`${className} rounded-lg object-cover border border-border`}
        width={32}
        height={32}
        style={{ objectFit: "cover" }}
        unoptimized={logoUrl.startsWith("data:")}
      />
    );
  }

  // Fallback to initial if no logoUrl
  const colors = [
    "bg-chart-1/20 text-chart-1",
    "bg-chart-2/20 text-chart-2",
    "bg-chart-3/20 text-chart-3",
    "bg-chart-4/20 text-chart-4",
    "bg-chart-5/20 text-chart-5",
  ];
  const colorIndex = merchantName.length % colors.length;
  const colorClass = colors[colorIndex];

  return (
    <div
      className={`${className} ${colorClass} rounded-lg flex items-center justify-center border border-current/20`}
    >
      <span className="font-semibold text-sm">
        {merchantName.charAt(0).toUpperCase()}
      </span>
    </div>
  );
}
