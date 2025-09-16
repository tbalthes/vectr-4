// This component is mostly correct already, just ensure props are named well.
'use client';

import Image from 'next/image';
import { useState } from 'react';

interface MerchantLogoProps {
  merchantName: string;
  logoUrl?: string | null; // Can be null
  className?: string;
}

export function MerchantLogo({ merchantName, logoUrl, className = 'w-8 h-8' }: MerchantLogoProps) {
  const [imageLoadError, setImageLoadError] = useState(false);

  // Guard merchantName
  const name = merchantName || '';

  // If a logoUrl is provided, try to render it.
  // Only render Image if logoUrl is a non-empty string and looks like a valid URL
  if (
    typeof logoUrl === 'string' &&
    logoUrl.trim() !== '' &&
    /^(https?:\/\/|\/|data:)/.test(logoUrl.trim()) &&
    !imageLoadError && // Don't render if image has failed to load
    logoUrl.trim() !== '\\' && // Filter out malformed URLs like "\"
    logoUrl.trim().length > 1 // Prevent single character malformed URLs
  ) {
    // Convert HTTP to HTTPS for Clearbit and other image services
    const secureUrl = logoUrl.startsWith('http:') ? logoUrl.replace('http:', 'https:') : logoUrl;

    return (
      <Image
        src={secureUrl}
        alt={`${merchantName} logo`}
        className={`${className} rounded-lg object-cover border border-border`}
        width={32}
        height={32}
        style={{ objectFit: 'cover' }}
        // `unoptimized` must be a boolean; only set true for data URIs.
        unoptimized={typeof logoUrl === 'string' && logoUrl.startsWith('data:')}
        onError={() => {
          setImageLoadError(true);
          console.log('MerchantLogo load error:', logoUrl, '-> converted to:', secureUrl);
        }}
        onLoad={() => {
          // Reset error state if component re-mounts with a different URL that loads successfully
          setImageLoadError(false);
        }}
      />
    );
  }

  // Fallback to initial if no logoUrl or image failed to load - use theme colors
  const colors = [
    'bg-chart-1/20 text-chart-1',
    'bg-chart-2/20 text-chart-2',
    'bg-chart-3/20 text-chart-3',
    'bg-chart-4/20 text-chart-4',
    'bg-chart-5/20 text-chart-5',
  ];
  const colorIndex = name.length % colors.length;
  const colorClass = colors[colorIndex];

  return (
    <div
      className={`${className} ${colorClass} rounded-full flex items-center justify-center border border-current/20`}
    >
      <span className="font-semibold text-sm">{name.charAt(0).toUpperCase()}</span>
    </div>
  );
}

// Provide a default export for consumers that import the component as default
export default MerchantLogo;
