'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import Image from 'next/image';
import { AlertCircle, RefreshCw, GripVertical } from 'lucide-react';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { DndContext, closestCenter } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { toast } from 'sonner';

import type { Account } from '@/hooks/useAccounts';
import { accountToasts } from '@/lib/notifications/account-notifications';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useAccountSync } from '@/contexts/AccountSyncContext';

interface AccountsGridProps {
  accounts: Account[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onSyncAccount?: (accountId: string, accountName: string) => Promise<void>;
  onSyncAll?: () => Promise<
    | {
        successful: number;
        failed: number;
        failedAccounts: string[];
      }
    | undefined
  >;
}

// Define types for the transformed account and group data
interface TransformedAccount {
  id: string;
  name: string;
  mask: string;
  type: string;
  subtype?: string;
  institution_name: string;
  institution_logo_url?: string | null;
  balance_amount: number;
  available?: number;
  last_synced_at: string;
}

interface GroupTimeframe {
  totalBalance: number;
  change: { amount: number; percent: number; positive: boolean };
  history: number[];
}

interface GroupData {
  id: string;
  category: string;
  icon: string;
  accounts: TransformedAccount[];
  timeframes: {
    [key: string]: GroupTimeframe;
    '7D': GroupTimeframe;
    '30D': GroupTimeframe;
    '90D': GroupTimeframe;
  };
}

type IconProps = React.SVGProps<SVGSVGElement>;

// --- PERSISTENCE HELPERS ---
interface SavedOrder {
  groups: string[]; // group ids
  accountsByGroup: Record<string, string[]>; // groupId -> [accountId]
}

// Get user-specific storage key
function getUserStorageKey(): string {
  // Try to get user ID from various sources
  let userId = 'default';

  try {
    // Try to get from localStorage (Supabase session)
    const storedSessions = Object.keys(localStorage).filter(
      (key) => key.includes('auth-token') && key.startsWith('sb-'),
    );

    if (storedSessions.length > 0) {
      const sessionData = localStorage.getItem(storedSessions[0]);
      if (sessionData) {
        const parsed = JSON.parse(sessionData);
        if (Array.isArray(parsed) && parsed.length >= 3 && parsed[2]?.user?.id) {
          userId = parsed[2].user.id;
        }
      }
    }
  } catch (error) {
    console.warn('Failed to get user ID for storage:', error);
  }

  return `vectr.accounts.order.${userId}.v1`;
}

function saveOrderToStorage(data: GroupData[]) {
  try {
    const payload: SavedOrder = {
      groups: data.map((g) => g.id),
      accountsByGroup: data.reduce<Record<string, string[]>>((acc, g) => {
        acc[g.id] = g.accounts.map((a) => a.id);
        return acc;
      }, {}),
    };
    localStorage.setItem(getUserStorageKey(), JSON.stringify(payload));
  } catch (error) {
    console.warn('Failed to save account order:', error);
  }
}

function loadOrderFromStorage(): SavedOrder | null {
  try {
    const raw = localStorage.getItem(getUserStorageKey());
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as SavedOrder;
  } catch (error) {
    console.warn('Failed to load account order:', error);
    return null;
  }
}

function applySavedOrder(data: GroupData[]): GroupData[] {
  const saved = loadOrderFromStorage();
  if (!saved) {
    return data;
  }

  // Reorder groups
  const groupMap = new Map<string, GroupData>(data.map((g) => [g.id, g]));
  const orderedGroups: GroupData[] = [];
  for (const gid of saved.groups) {
    const g = groupMap.get(gid);
    if (g) {
      orderedGroups.push(g);
      groupMap.delete(gid);
    }
  }
  // Append any new groups not in saved
  for (const g of groupMap.values()) {
    orderedGroups.push(g);
  }

  // Reorder accounts within each group
  const result = orderedGroups.map((g) => {
    const savedAcc = saved.accountsByGroup[g.id];
    if (!savedAcc) {
      return g;
    }
    const accMap = new Map<string, TransformedAccount>(g.accounts.map((a) => [a.id, a]));
    const ordered: TransformedAccount[] = [];
    for (const aid of savedAcc) {
      const a = accMap.get(aid);
      if (a) {
        ordered.push(a);
        accMap.delete(aid);
      }
    }
    // Append any new accounts not in saved
    for (const a of accMap.values()) {
      ordered.push(a);
    }
    return { ...g, accounts: ordered };
  });

  return result;
}

// --- HELPERS ---
const timeAgo = (dateString?: string) => {
  if (!dateString) {
    return null;
  }
  const date = new Date(dateString);
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  let interval = seconds / 31536000;
  if (interval > 1) {
    return Math.floor(interval) + ' years ago';
  }
  interval = seconds / 2592000;
  if (interval > 1) {
    return Math.floor(interval) + ' months ago';
  }
  interval = seconds / 86400;
  if (interval > 1) {
    return Math.floor(interval) + ' days ago';
  }
  interval = seconds / 3600;
  if (interval > 1) {
    return Math.floor(interval) + ' hours ago';
  }
  interval = seconds / 60;
  if (interval > 1) {
    return Math.floor(interval) + ' minutes ago';
  }
  return 'Just now';
};

// --- ICONS ---
const Icons = {
  cash: (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M16.75 7.75H7.25C6.42157 7.75 5.75 8.42157 5.75 9.25V14.75C5.75 15.5784 6.42157 16.25 7.25 16.25H16.75C17.5784 16.25 18.25 15.5784 18.25 14.75V9.25C18.25 8.42157 17.5784 7.75 16.75 7.75Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 13.25C12.6904 13.25 13.25 12.6904 13.25 12C13.25 11.3096 12.6904 10.75 12 10.75C11.3096 10.75 10.75 11.3096 10.75 12C10.75 12.6904 11.3096 13.25 12 13.25Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  invest: (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M5.75 15.25L10.25 10.75L13.75 14.25L18.25 9.75"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18.25 12.75V9.75H15.25"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  credit: (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <rect
        x="1"
        y="4"
        width="22"
        height="16"
        rx="2"
        ry="2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line
        x1="1"
        y1="10"
        x2="23"
        y2="10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  loan: (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <circle cx="12" cy="12" r="9.25" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M14.25 8.75L9.75 15.25"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  ),
  grip: (props: IconProps) => <GripVertical {...props} />,
  chevron: (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M16 10L12 14L8 10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  moreVertical: (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <circle cx="12" cy="12" r="1" fill="currentColor" />
      <circle cx="12" cy="5" r="1" fill="currentColor" />
      <circle cx="12" cy="19" r="1" fill="currentColor" />
    </svg>
  ),
  eye: (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="12"
        cy="12"
        r="3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  trash: (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="m3 6 3 13h12l3-13"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line
        x1="10"
        y1="11"
        x2="10"
        y2="17"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line
        x1="14"
        y1="11"
        x2="14"
        y2="17"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
};

// --- SPARKLINE COMPONENT ---
interface SparklineProps {
  data: number[];
  positive: boolean;
}

const InteractiveSparkline: React.FC<SparklineProps> = ({ data, positive }) => {
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    value: number;
  } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const width = 120;
  const height = 50;
  const strokeColor = positive ? '#22c55e' : '#ef4444';

  if (!data || data.length === 0) {
    return <div className="w-full h-full bg-gray-100 rounded" />;
  }

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min === 0 ? 1 : max - min;
  const yPoints = data.map((d) => height - ((d - min) / range) * (height - 10) - 5);
  const xPoints = data.map((_, i) => (i / (data.length - 1)) * width);
  const points = yPoints.map((y, i) => `${xPoints[i].toFixed(2)},${y.toFixed(2)}`).join(' ');

  const handleMouseMove = (e: React.MouseEvent) => {
    const svg = svgRef.current;
    if (!svg) {
      return;
    }
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    const svgP = pt.matrixTransform(svg.getScreenCTM()?.inverse());
    const closestIndex = xPoints.reduce(
      (closest, curr, i) =>
        Math.abs(curr - svgP.x) < Math.abs(xPoints[closest] - svgP.x) ? i : closest,
      0,
    );
    setTooltip({
      x: xPoints[closestIndex],
      y: yPoints[closestIndex],
      value: data[closestIndex],
    });
  };

  const gradientId = `spark-grad-${Math.random()}`;

  return (
    <div className="relative w-full h-full cursor-crosshair" onMouseLeave={() => setTooltip(null)}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-full"
        preserveAspectRatio="none"
        onMouseMove={handleMouseMove}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.2" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d={`M${xPoints[0]},${height} L${points} L${xPoints[xPoints.length - 1]},${height} Z`}
          fill={`url(#${gradientId})`}
        />
        <polyline fill="none" stroke={strokeColor} strokeWidth="2" points={points} />
        {tooltip && (
          <>
            <line
              x1={tooltip.x}
              y1="0"
              x2={tooltip.x}
              y2={height}
              stroke={strokeColor}
              strokeWidth="1"
              strokeDasharray="2 2"
            />
            <circle
              cx={tooltip.x}
              cy={tooltip.y}
              r="3"
              fill="white"
              stroke={strokeColor}
              strokeWidth="2"
            />
          </>
        )}
      </svg>
      {tooltip && (
        <div
          className="absolute text-xs bg-slate-800 text-white rounded-md px-2 py-1 pointer-events-none"
          style={{
            left: tooltip.x,
            top: tooltip.y - 30,
            transform: 'translateX(-50%)',
          }}
        >
          ${tooltip.value.toLocaleString()}
        </div>
      )}
    </div>
  );
};

// --- ACCOUNT ACTIONS MENU ---
interface AccountActionsMenuProps {
  account: TransformedAccount;
  onView: (account: TransformedAccount) => void;
  onDelete: (account: TransformedAccount) => void;
}

const AccountActionsMenu: React.FC<AccountActionsMenuProps> = ({ account, onView, onDelete }) => {
  const [open, setOpen] = useState(false);

  const handleView = () => {
    onView(account);
    setOpen(false);
  };

  const handleDelete = () => {
    onDelete(account);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="p-2 rounded-full hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors">
          <Icons.moreVertical className="w-5 h-5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-44 sm:w-48 p-0 bg-white border border-slate-200 rounded-lg shadow-lg"
        align="end"
        side="bottom"
        sideOffset={4}
        alignOffset={0}
        avoidCollisions={true}
        collisionPadding={16}
      >
        <div className="py-1">
          <button
            onClick={handleView}
            className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <Icons.eye className="w-4 h-4 mr-3" />
            View Details
          </button>
          <button
            onClick={handleDelete}
            className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
          >
            <Icons.trash className="w-4 h-4 mr-3" />
            Delete Account
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

// --- INSTITUTION LOGO ---
interface InstitutionLogoProps {
  url?: string | null;
  name: string;
}

const InstitutionLogo: React.FC<InstitutionLogoProps> = ({ url, name }) => {
  const [hasError, setHasError] = useState(false);
  const fallbackInitial = name ? name.charAt(0).toUpperCase() : '?';

  if (!url || hasError) {
    return (
      <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold text-xs">
        {fallbackInitial}
      </div>
    );
  }
  return (
    <Image
      src={url}
      alt={`${name} logo`}
      width={24}
      height={24}
      className="w-6 h-6 rounded-full object-contain"
      onError={() => setHasError(true)}
    />
  );
};

// --- DATA PROCESSING ---
const groupAccountsByType = (accounts: Account[]): GroupData[] => {
  const categoryMap = {
    depository: { category: 'Cash & Liquid Assets', icon: 'cash' },
    investment: { category: 'Investments', icon: 'invest' },
    credit: { category: 'Credit Cards', icon: 'credit' },
    loan: { category: 'Loans', icon: 'loan' },
    other: { category: 'Other Assets', icon: 'other' },
  };

  const grouped = accounts.reduce((acc: Record<string, GroupData>, account) => {
    const groupKey = account.type || 'other';
    if (!acc[groupKey]) {
      acc[groupKey] = {
        ...(categoryMap[groupKey as keyof typeof categoryMap] || categoryMap.other),
        id: `group-${groupKey}`,
        accounts: [],
        timeframes: {
          '7D': {
            totalBalance: 0,
            change: { amount: 0, percent: 0, positive: true },
            history: [],
          },
          '30D': {
            totalBalance: 0,
            change: { amount: 0, percent: 0, positive: true },
            history: [],
          },
          '90D': {
            totalBalance: 0,
            change: { amount: 0, percent: 0, positive: true },
            history: [],
          },
        },
      };
    }

    // Transform API account to match expected format
    const transformedAccount = {
      id: account.id,
      name: account.name,
      mask: account.mask || '****',
      type: account.type || 'other',
      subtype: account.subtype,
      institution_name: account.institution_name || 'Unknown Bank',
      institution_logo_url: account.institution_logo_url,
      balance_amount: account.balance_amount || 0,
      available: account.available,
      last_synced_at: account.last_synced_at || new Date().toISOString(),
    };

    acc[groupKey].accounts.push(transformedAccount);
    return acc;
  }, {});

  // Calculate total balances and generate mock history
  Object.values(grouped).forEach((group: GroupData) => {
    const total = group.accounts.reduce(
      (sum: number, acc: TransformedAccount) => sum + acc.balance_amount,
      0,
    );
    Object.keys(group.timeframes).forEach((tf) => {
      group.timeframes[tf].totalBalance = total;
      // Simple mock data generation for history
      const days = parseInt(tf.replace('D', ''));
      group.timeframes[tf].history = Array.from(
        { length: Math.max(1, days) },
        (_, i) => total * (1 + (Math.random() - 0.5) * 0.1 * (i / Math.max(1, days))),
      );
      const changeAmount = (Math.random() - 0.4) * total * 0.05;
      group.timeframes[tf].change = {
        amount: changeAmount,
        percent: total !== 0 ? parseFloat(((changeAmount / total) * 100).toFixed(2)) : 0,
        positive: changeAmount >= 0,
      };
    });
  });

  return Object.values(grouped);
};

// --- ACCOUNT ROW ---
interface AccountLedgerRowProps {
  account: TransformedAccount;
  dndAttributes?: React.HTMLAttributes<HTMLDivElement>;
  dndListeners?: React.HTMLAttributes<HTMLDivElement>;
  onViewAccount: (account: TransformedAccount) => void;
  onDeleteAccount: (account: TransformedAccount) => void;
}

const AccountLedgerRow: React.FC<AccountLedgerRowProps> = ({
  account,
  dndAttributes,
  dndListeners,
  onViewAccount,
  onDeleteAccount,
}) => {
  const {
    name,
    mask,
    institution_name,
    institution_logo_url,
    balance_amount,
    available,
    last_synced_at,
  } = account;

  return (
    <div className="flex items-center justify-between px-3 sm:px-5 border-t border-border py-2.5 hover:bg-accent dark:hover:bg-slate-800/60 group">
      {/* Left side - Logo and Account Info */}
      <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
        {/* Drag Handle - Hidden on mobile */}
        <div
          className="text-slate-300 dark:text-slate-500 cursor-grab hover:text-slate-500 transition-colors hidden sm:block"
          {...dndAttributes}
          {...dndListeners}
        >
          <Icons.grip className="w-5 h-5" />
        </div>

        {/* Institution Logo */}
        <div className="flex-shrink-0">
          <InstitutionLogo url={institution_logo_url} name={institution_name} />
        </div>

        {/* Account Details */}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-slate-900 dark:text-slate-100 truncate text-sm">{name}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
            <span className="hidden sm:inline">{institution_name} •••• </span>
            <span className="sm:hidden">•••• </span>
            {mask}
          </p>
        </div>
      </div>

      {/* Right side - Balance and Actions */}
      <div className="flex items-center space-x-2 sm:space-x-3 flex-shrink-0">
        {/* Balance */}
        <div className="text-right">
          <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
            $
            {Math.abs(balance_amount).toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
          {available !== null && available !== undefined && available !== balance_amount && (
            <p className="text-xs text-slate-500 dark:text-slate-400 hidden lg:block">
              Available: $
              {available.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
          )}
        </div>

        {/* Last Synced - Hidden on mobile */}
        <div className="text-xs text-slate-400 dark:text-slate-500 hidden lg:block min-w-0">
          <span className="truncate">{timeAgo(last_synced_at)}</span>
        </div>

        {/* Actions Menu */}
        <div className="opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
          <AccountActionsMenu account={account} onView={onViewAccount} onDelete={onDeleteAccount} />
        </div>
      </div>
    </div>
  );
};

// --- SORTABLE ACCOUNT ROW ---
interface SortableAccountLedgerRowProps {
  account: TransformedAccount;
  onViewAccount: (account: TransformedAccount) => void;
  onDeleteAccount: (account: TransformedAccount) => void;
}

const SortableAccountLedgerRow: React.FC<SortableAccountLedgerRowProps> = ({
  account,
  onViewAccount,
  onDeleteAccount,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `acc-${account.id}`,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    backgroundColor: isDragging ? '#f1f5f9' : 'transparent',
  };

  return (
    <div ref={setNodeRef} style={style}>
      <AccountLedgerRow
        account={account}
        dndAttributes={attributes}
        dndListeners={listeners}
        onViewAccount={onViewAccount}
        onDeleteAccount={onDeleteAccount}
      />
    </div>
  );
};

// --- FINANCIAL INSIGHT CARD ---
interface FinancialInsightCardProps {
  groupData: GroupData;
  dndAttributes?: React.HTMLAttributes<HTMLDivElement>;
  dndListeners?: React.HTMLAttributes<HTMLDivElement>;
  onViewAccount: (account: TransformedAccount) => void;
  onDeleteAccount: (account: TransformedAccount) => void;
}

const FinancialInsightCard: React.FC<FinancialInsightCardProps> = ({
  groupData,
  dndAttributes,
  dndListeners,
  onViewAccount,
  onDeleteAccount,
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const [activeTimeframe, setActiveTimeframe] = useState('30D');
  const { category, icon, timeframes, accounts } = groupData;
  const { totalBalance, change, history } = timeframes[activeTimeframe];
  const IconComponent = Icons[icon as keyof typeof Icons];

  const formattedBalance = totalBalance.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });

  const [shimmerActive, setShimmerActive] = useState(false);
  return (
    <div className="bg-card rounded-xl shadow-xl hover:shadow-2xl transition-all duration-300 border border-border group/card hover:scale-[1.02] hover:border-slate-300 dark:hover:border-slate-700">
      {/* Shimmer Animation Styles */}
      <style>{`
        @keyframes vectr-shimmer {
          0% { background-position: 200% center; }
          100% { background-position: -200% center; }
        }
        .vectr-shift {
          position: relative;
          color: transparent;
          background-image: linear-gradient(to right, #171717 40%, #e5e5e5 50%, #171717 60%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          background-clip: text;
          animation: vectr-shimmer 2.5s linear infinite;
          animation-play-state: paused;
        }
        .vectr-shift::before {
          content: attr(data-text);
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          color: #171717;
          z-index: -1;
        }
        .group/card:hover .vectr-shift { animation-play-state: running; }
        .vectr-run { animation: vectr-shimmer 1.6s linear 1; }
      `}</style>

      {/* Card Header */}
      <div className="flex items-center justify-between p-5 pb-3">
        <div className="flex items-center space-x-3">
          <div
            className="flex-shrink-0 text-slate-300 cursor-grab hover:text-slate-500 transition-colors"
            {...dndAttributes}
            {...dndListeners}
          >
            <Icons.grip className="w-5 h-5" />
          </div>
          <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
            <IconComponent className="w-4 h-4 text-slate-600 dark:text-slate-300" />
          </div>
          <div>
            <h3
              className="text-base font-semibold text-slate-900 dark:text-slate-100 vectr-shift"
              data-text={category}
            >
              {category}
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-xs">
              {accounts.length} account{accounts.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <Icons.chevron
            className={`w-4 h-4 text-slate-400 transition-transform ${!isOpen ? '-rotate-90' : ''}`}
          />
        </button>
      </div>

      {/* Balance and Chart */}
      <div className="px-6 pb-4">
        <div
          className="flex items-center justify-between"
          onMouseEnter={() => setShimmerActive(true)}
        >
          <div>
            <p
              className={`text-2xl font-extrabold tracking-wide text-slate-900 dark:text-slate-200 ${
                shimmerActive ? 'vectr-shift vectr-run' : ''
              }`}
              data-text={formattedBalance}
              onMouseEnter={() => setShimmerActive(true)}
              onAnimationEnd={() => setShimmerActive(false)}
            >
              {formattedBalance}
            </p>
            <div className="flex items-center mt-0.5">
              <span
                className={`text-xs font-medium ${
                  change.positive ? 'text-green-600' : 'text-red-500'
                }`}
              >
                {change.positive ? '▲' : '▼'} {Math.abs(change.percent)}%
              </span>
              <span className="text-slate-400 dark:text-slate-500 text-xs ml-2">
                in {activeTimeframe}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 w-28 mr-3">
            <div className="w-28 h-12">
              <InteractiveSparkline data={history} positive={change.positive} />
            </div>
            <div className="w-28">
              <div className="mx-auto inline-flex items-center gap-1 rounded-full bg-slate-100/80 dark:bg-slate-800 px-1 py-0.5 text-[10px] font-semibold">
                {Object.keys(timeframes).map((tf) => (
                  <button
                    key={tf}
                    onClick={() => setActiveTimeframe(tf)}
                    className={`px-1.5 py-0.5 rounded-full transition-colors ${
                      activeTimeframe === tf
                        ? 'bg-slate-900 text-white shadow'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white'
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Accounts List */}
      <div
        className={`transition-all duration-300 ease-in-out ${
          isOpen ? 'max-h-none opacity-100' : 'max-h-0 opacity-0'
        } overflow-hidden`}
      >
        <SortableContext
          items={accounts.map((a: TransformedAccount) => `acc-${a.id}`)}
          strategy={verticalListSortingStrategy}
        >
          <div>
            {accounts.map((account: TransformedAccount) => (
              <SortableAccountLedgerRow
                key={account.id}
                account={account}
                onViewAccount={onViewAccount}
                onDeleteAccount={onDeleteAccount}
              />
            ))}
          </div>
        </SortableContext>
      </div>
    </div>
  );
};

// --- SORTABLE CARD ---
interface SortableFinancialInsightCardProps {
  groupData: GroupData;
  onViewAccount: (account: TransformedAccount) => void;
  onDeleteAccount: (account: TransformedAccount) => void;
}

const SortableFinancialInsightCard: React.FC<SortableFinancialInsightCardProps> = ({
  groupData,
  onViewAccount,
  onDeleteAccount,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: groupData.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.8 : 1,
    zIndex: isDragging ? 10 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <FinancialInsightCard
        groupData={groupData}
        dndAttributes={attributes}
        dndListeners={listeners}
        onViewAccount={onViewAccount}
        onDeleteAccount={onDeleteAccount}
      />
    </div>
  );
};

// --- MAIN COMPONENT ---
export function LuxuryAccountsGrid({
  accounts: initialAccounts,
  loading,
  error,
  onRefresh,
  onSyncAll,
}: AccountsGridProps) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { isBulkSyncing } = useAccountSync();

  // Transform accounts for LuxuryAccountCard
  const groupedData = useMemo(() => groupAccountsByType(accounts), [accounts]);
  const [sortedGroupedData, setSortedGroupedData] = useState(groupedData);

  // Update state when accounts change
  useEffect(() => {
    setAccounts(initialAccounts);
  }, [initialAccounts]);

  // Update grouped data when accounts change and apply saved order
  useEffect(() => {
    const fresh = groupAccountsByType(accounts);
    setSortedGroupedData(applySavedOrder(fresh));
  }, [accounts]);

  const handleDragStart = (_event: DragStartEvent) => {
    // No-op: activeId state removed as it was unused
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) {
      return;
    }
    const activeId = String(active.id);
    const overId = String(over.id);

    // Check if we are dragging a group card
    if (activeId.startsWith('group-') && overId.startsWith('group-')) {
      if (activeId !== overId) {
        setSortedGroupedData((items: GroupData[]) => {
          const oldIndex = items.findIndex((item) => item.id === activeId);
          const newIndex = items.findIndex((item) => item.id === overId);
          const next = arrayMove(items, oldIndex, newIndex);
          saveOrderToStorage(next);
          return next;
        });
      }
    }

    // Check if we are dragging an account row
    else if (activeId.startsWith('acc-') && overId.startsWith('acc-')) {
      setSortedGroupedData((prevData: GroupData[]) => {
        const newData = [...prevData];

        // Extract account IDs from prefixed strings
        const activeAccountId = activeId.replace('acc-', '');
        const overAccountId = overId.replace('acc-', '');

        // Find the group and index for both accounts
        const findAccountPosition = (
          accountId: string,
        ): { groupIndex: number; accountIndex: number } | null => {
          for (let gi = 0; gi < newData.length; gi++) {
            const accountIndex = newData[gi].accounts.findIndex((acc) => acc.id === accountId);
            if (accountIndex !== -1) {
              return { groupIndex: gi, accountIndex };
            }
          }
          return null;
        };

        const activePos = findAccountPosition(activeAccountId);
        const overPos = findAccountPosition(overAccountId);

        // Only reorder if both accounts are in the same group
        if (activePos && overPos && activePos.groupIndex === overPos.groupIndex) {
          const group = newData[activePos.groupIndex];
          const oldIndex = activePos.accountIndex;
          const newIndex = overPos.accountIndex;

          if (oldIndex !== newIndex) {
            group.accounts = arrayMove(group.accounts, oldIndex, newIndex);
            saveOrderToStorage(newData);
          }
        }

        return newData;
      });
    }
  };

  const handleViewAccount = (account: TransformedAccount) => {
    console.log('View account:', account);
    toast.info(`Viewing details for ${account.name}`);
  };

  const handleDeleteAccount = async (account: TransformedAccount) => {
    try {
      // Remove from local state immediately for better UX
      setAccounts((prev) => prev.filter((a) => a.id !== account.id));

      console.log(`Attempting to delete account: ${account.id}`);

      // Actually delete the account from the backend
      const response = await fetch(`/api/accounts/${account.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const responseText = await response.text();
      console.log(`Delete response status: ${response.status}`);
      console.log(`Delete response body: ${responseText}`);

      if (!response.ok) {
        let errorMessage = `Failed to delete account (${response.status})`;
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.error || errorMessage;
        } catch {
          errorMessage = responseText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      toast.success(`Account ${account.name} has been removed`);
      console.log('Account deleted successfully:', account.id);

      // No need to refresh since we've already optimistically updated the local state
      // and the backend operation was successful. This prevents the jarring loading skeleton.
    } catch (error) {
      console.error('Error deleting account:', error);
      // Revert the local state if delete fails
      setAccounts(initialAccounts);

      const errorMessage = error instanceof Error ? error.message : 'Failed to delete account';
      toast.error(errorMessage);
    }
  };

  const handleRefresh = () => {
    if (isRefreshing) {
      return;
    }
    setIsRefreshing(true);
    try {
      onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSyncAll = async () => {
    if (isBulkSyncing() || !onSyncAll) {
      return;
    }
    try {
      const result = await onSyncAll();
      if (result) {
        accountToasts.bulkSyncComplete(result.successful, result.failed, result.failedAccounts);
      }
    } catch (error) {
      console.error('Error syncing all accounts:', error);
      toast.error('Failed to sync accounts');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Your Accounts</h2>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl p-6 space-y-4">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Your Accounts</h2>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Your Accounts</h2>
        </div>
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">No accounts connected yet.</p>
          <p className="text-sm text-gray-400">
            Click &quot;Add Account&quot; above to get started.
          </p>
        </div>
      </div>
    );
  }

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-4 sm:space-y-5">
        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Your Accounts</h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center px-3 py-2 text-sm border rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
              <span className="sm:hidden">Sync</span>
            </button>
            {accounts.length > 1 && onSyncAll && (
              <button
                onClick={() => void handleSyncAll()}
                disabled={isBulkSyncing()}
                className="flex items-center px-3 py-2 text-sm border rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${isBulkSyncing() ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Sync All</span>
                <span className="sm:hidden">All</span>
              </button>
            )}
          </div>
        </div>

        {/* Luxury Account Cards Grid */}
        <SortableContext
          items={sortedGroupedData.map((g: GroupData) => g.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
            {sortedGroupedData.map((group: GroupData) => (
              <SortableFinancialInsightCard
                key={group.id}
                groupData={group}
                onViewAccount={handleViewAccount}
                onDeleteAccount={(account) => void handleDeleteAccount(account)}
              />
            ))}
          </div>
        </SortableContext>
      </div>
    </DndContext>
  );
}
