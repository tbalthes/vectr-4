import { Building2 } from 'lucide-react';

interface MerchantLogoProps {
  merchant: string;
  logoUrl?: string;
  className?: string;
}

export function MerchantLogo({ merchant, logoUrl, className = "w-8 h-8" }: MerchantLogoProps) {
  if (logoUrl) {
    return (
      <img 
        src={logoUrl} 
        alt={`${merchant} logo`}
        className={`${className} rounded-lg object-cover border border-border`}
        onError={(e) => {
          e.currentTarget.style.display = 'none';
          e.currentTarget.nextElementSibling?.classList.remove('hidden');
        }}
      />
    );
  }

  // Generate a color based on merchant name
  const colors = [
    'bg-chart-1/20 text-chart-1',
    'bg-chart-2/20 text-chart-2', 
    'bg-chart-3/20 text-chart-3',
    'bg-chart-4/20 text-chart-4',
    'bg-chart-5/20 text-chart-5'
  ];
  
  const colorIndex = merchant.length % colors.length;
  const colorClass = colors[colorIndex];

  return (
    <div className={`${className} ${colorClass} rounded-lg flex items-center justify-center border border-current/20`}>
      <span className="font-semibold text-sm">
        {merchant.charAt(0).toUpperCase()}
      </span>
    </div>
  );
}