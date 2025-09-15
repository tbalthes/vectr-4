import React, { useState, useRef, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// --- DATA PROCESSING & GROUPING LOGIC ---
interface Account {
  id: string;
  name: string;
  mask: string;
  type: string;
  subtype: string;
  institution_name: string;
  institution_logo_url: string | null;
  balance_amount: number;
  available: number | null;
  last_synced_at: string;
}

interface GroupTimeframe {
  totalBalance: number;
  change: { amount: number; percent: number | string; positive: boolean };
  history: number[];
}

interface GroupData {
  id: string;
  category: string;
  icon: keyof typeof Icons;
  accounts: Account[];
  timeframes: Record<string, GroupTimeframe>;
}

const groupAccountsByType = (accounts: Account[]) => {
  const categoryMap: Record<string, { category: string; icon: keyof typeof Icons }> = {
    depository: { category: 'Cash & Liquid Assets', icon: 'cash' },
    investment: { category: 'Investments', icon: 'invest' },
    credit: { category: 'Credit Cards', icon: 'credit' },
    loan: { category: 'Loans', icon: 'loan' },
    other: { category: 'Other Assets', icon: 'cash' }, // fallback to a valid icon key
  };

  type GroupedType = Record<
    string,
    {
      category: string;
      icon: keyof typeof Icons;
      id: string;
      accounts: Account[];
      timeframes: Record<
        string,
        {
          totalBalance: number;
          change: {
            amount: number;
            percent: number | string;
            positive: boolean;
          };
          history: number[];
        }
      >;
    }
  >;

  const grouped = accounts.reduce((acc: GroupedType, account) => {
    const groupKey = account.type in categoryMap ? account.type : 'other';
    if (!acc[groupKey]) {
      acc[groupKey] = {
        ...categoryMap[groupKey],
        id: `group-${groupKey}`,
        accounts: [],
        // Mocking timeframes for demonstration purposes
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
    acc[groupKey].accounts.push(account);
    return acc;
  }, {} as GroupedType);

  // Calculate total balances and generate mock history
  Object.values(grouped).forEach((group) => {
    const total = group.accounts.reduce((sum, acc) => sum + acc.balance_amount, 0);
    Object.keys(group.timeframes).forEach((tf) => {
      group.timeframes[tf].totalBalance = total;
      // Simple mock data generation
      const days = parseInt(tf.replace('D', ''));
      group.timeframes[tf].history = Array.from(
        { length: days },
        (_, i) => total * (1 + (Math.random() - 0.5) * 0.1 * (i / days)),
      );
      const changeAmount = (Math.random() - 0.4) * total * 0.05;
      group.timeframes[tf].change = {
        amount: changeAmount,
        percent: total !== 0 ? ((changeAmount / total) * 100).toFixed(2) : 0,
        positive: changeAmount >= 0,
      };
    });
  });

  return Object.values(grouped);
};

// --- HELPERS ---
const timeAgo = (dateString: string) => {
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

// --- UI & VISUAL COMPONENTS ---

const Icons = {
  cash: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <path
        d="M16.75 7.75H7.25C6.42157 7.75 5.75 8.42157 5.75 9.25V14.75C5.75 15.5784 6.42157 16.25 7.25 16.25H16.75C17.5784 16.25 18.25 15.5784 18.25 14.75V9.25C18.25 8.42157 17.5784 7.75 16.75 7.75Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      ></path>
      <path
        d="M12 13.25C12.6904 13.25 13.25 12.6904 13.25 12C13.25 11.3096 12.6904 10.75 12 10.75C11.3096 10.75 10.75 11.3096 10.75 12C10.75 12.6904 11.3096 13.25 12 13.25Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      ></path>
    </svg>
  ),
  invest: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <path
        d="M5.75 15.25L10.25 10.75L13.75 14.25L18.25 9.75"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      ></path>
      <path
        d="M18.25 12.75V9.75H15.25"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      ></path>
      <path
        d="M12 19.25H18.25"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      ></path>
      <path
        d="M5.75 19.25H8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      ></path>
      <path
        d="M12 4.75H5.75"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      ></path>
      <path
        d="M18.25 4.75H16"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      ></path>
    </svg>
  ),
  credit: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
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
  loan: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <circle cx="12" cy="12" r="9.25" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M14.25 8.75L9.75 15.25"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path d="M10.25 8.75H14.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M9.75 15.25H13.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  grip: (p: React.SVGProps<SVGSVGElement>) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" {...p}>
      <circle cx="12" cy="5" r="1.5" fill="currentColor" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      <circle cx="12" cy="19" r="1.5" fill="currentColor" />
      <circle cx="6" cy="5" r="1.5" fill="currentColor" />
      <circle cx="6" cy="12" r="1.5" fill="currentColor" />
      <circle cx="6" cy="19" r="1.5" fill="currentColor" />
    </svg>
  ),
  chevron: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <path
        d="M16 10L12 14L8 10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      ></path>
    </svg>
  ),
  details: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <path
        d="M12 13.25C12.6904 13.25 13.25 12.6904 13.25 12C13.25 11.3096 12.6904 10.75 12 10.75C11.3096 10.75 10.75 11.3096 10.75 12C10.75 12.6904 11.3096 13.25 12 13.25Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      ></path>
      <path
        d="M12 5.75V4.75"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      ></path>
      <path
        d="M12 19.25V18.25"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      ></path>
      <path
        d="M18.25 12L19.25 12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      ></path>
      <path
        d="M4.75 12L5.75 12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      ></path>
    </svg>
  ),
  moreVertical: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <circle cx="12" cy="12" r="1" fill="currentColor" />
      <circle cx="12" cy="5" r="1" fill="currentColor" />
      <circle cx="12" cy="19" r="1" fill="currentColor" />
    </svg>
  ),
  eye: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
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
  trash: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
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

const InteractiveSparkline: React.FC<{ data: number[]; positive: boolean }> = ({
  data,
  positive,
}) => {
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    value: number;
  } | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const width = 120;
  const height = 50;
  const strokeColor = positive ? '#22c55e' : '#ef4444';
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min === 0 ? 1 : max - min;
  const yPoints = data.map((d) => height - ((d - min) / range) * (height - 10) - 5);
  const xPoints = data.map((_, i) => (i / (data.length - 1)) * width);
  const points = yPoints.map((y, i) => `${xPoints[i].toFixed(2)},${y.toFixed(2)}`).join(' ');
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    const svg = svgRef.current;
    if (!svg) {
      return;
    }
    const rect = svg.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    // Find the closest xPoint to the mouse x position
    let closest = 0;
    let minDist = Math.abs(xPoints[0] - mouseX);
    for (let i = 1; i < xPoints.length; i++) {
      const dist = Math.abs(xPoints[i] - mouseX);
      if (dist < minDist) {
        minDist = dist;
        closest = i;
      }
    }
    setTooltip({
      x: xPoints[closest],
      y: yPoints[closest],
      value: data[closest],
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

const AccountActionsMenu = ({
  account,
  onView,
  onDelete,
}: {
  account: Account;
  onView: (account: Account) => void;
  onDelete: (account: Account) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleView = () => {
    onView(account);
    setIsOpen(false);
  };

  const handleDelete = () => {
    onDelete(account);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-full hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors"
      >
        <Icons.moreVertical className="w-5 h-5" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-10 bg-white rounded-lg shadow-lg border border-slate-200 py-2 z-50 min-w-[150px]">
          <button
            onClick={handleView}
            className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
          >
            <Icons.eye className="w-4 h-4" />
            View Details
          </button>
          <button
            onClick={handleDelete}
            className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
          >
            <Icons.trash className="w-4 h-4" />
            Delete Account
          </button>
        </div>
      )}
    </div>
  );
};

const InstitutionLogo: React.FC<{ url: string | null; name: string }> = ({ url, name }) => {
  const [hasError, setHasError] = useState(false);
  const fallbackInitial = name ? name.charAt(0).toUpperCase() : '?';

  if (!url || hasError) {
    return (
      <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold">
        {fallbackInitial}
      </div>
    );
  }
  return (
    <Image
      src={url}
      alt={`${name} logo`}
      width={32}
      height={32}
      className="w-8 h-8 rounded-full object-contain"
      onError={() => setHasError(true)}
    />
  );
};

interface AccountLedgerRowProps {
  account: Account;
  dndAttributes?: React.HTMLAttributes<HTMLDivElement>;
  dndListeners?: ReturnType<typeof useSortable>['listeners'];
  onViewAccount: (account: Account) => void;
  onDeleteAccount: (account: Account) => void;
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
    <div className="flex items-center py-4 px-5 border-t border-slate-200/60 group">
      <div
        className="text-slate-300 cursor-grab group-hover:text-slate-500 transition-colors"
        {...dndAttributes}
        {...dndListeners}
      >
        <Icons.grip className="w-5 h-5 -ml-1" />
      </div>
      <div className="flex-shrink-0 mr-4 ml-3">
        <InstitutionLogo url={institution_logo_url} name={institution_name} />
      </div>
      <div className="flex-grow">
        <p className="font-semibold text-slate-800">
          {name} (...{mask})
        </p>
        <p className="text-sm text-slate-500">{timeAgo(last_synced_at)}</p>
      </div>
      <div className="flex items-center">
        <div className="text-right mr-4">
          <p className="font-medium text-slate-900 text-base tracking-tight">
            {balance_amount.toLocaleString('en-US', {
              style: 'currency',
              currency: 'USD',
            })}
          </p>
          {available !== null && available !== balance_amount && (
            <p className="text-xs text-slate-500" title="Available Balance">
              {available.toLocaleString('en-US', {
                style: 'currency',
                currency: 'USD',
              })}{' '}
              avail.
            </p>
          )}
        </div>
        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
          <AccountActionsMenu account={account} onView={onViewAccount} onDelete={onDeleteAccount} />
        </div>
      </div>
    </div>
  );
};

interface SortableAccountLedgerRowProps {
  account: Account;
  onViewAccount: (account: Account) => void;
  onDeleteAccount: (account: Account) => void;
}

const SortableAccountLedgerRow: React.FC<SortableAccountLedgerRowProps> = ({
  account,
  onViewAccount,
  onDeleteAccount,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: account.id,
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

interface FinancialInsightCardProps {
  groupData: {
    category: string;
    icon: keyof typeof Icons;
    id: string;
    accounts: Account[];
    timeframes: Record<
      string,
      {
        totalBalance: number;
        change: { amount: number; percent: number | string; positive: boolean };
        history: number[];
      }
    >;
  };
  dndAttributes?: React.HTMLAttributes<HTMLDivElement>;
  dndListeners?: ReturnType<typeof useSortable>['listeners'];
  onViewAccount: (account: Account) => void;
  onDeleteAccount: (account: Account) => void;
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
  const IconComponent = Icons[icon];
  const formattedBalance = totalBalance.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });
  return (
    <div className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 border border-slate-200/80 mb-6 group/card hover:scale-[1.01] hover:border-slate-300">
      <div
        className="bg-slate-50/50 rounded-t-2xl p-5 cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-start">
          <div
            className="flex-shrink-0 text-slate-400 cursor-grab pr-4 pt-1"
            {...dndAttributes}
            {...dndListeners}
          >
            <Icons.grip className="w-6 h-6" />
          </div>
          <div className="flex-grow">
            <div className="flex items-center">
              <IconComponent className="w-6 h-6 text-slate-600 mr-3" />
              <h2 className="text-xl font-bold text-slate-800">{category}</h2>
            </div>
            <p
              className="vectr-shift mt-3 text-4xl font-extrabold tracking-tighter"
              data-text={formattedBalance}
            >
              {formattedBalance}
            </p>
            <div className="flex items-center text-sm mt-1">
              <span
                className={`${change.positive ? 'text-green-600' : 'text-red-600'} font-semibold`}
              >
                {change.positive ? '▲' : '▼'}{' '}
                {Math.abs(change.amount).toLocaleString('en-US', {
                  style: 'currency',
                  currency: 'USD',
                })}{' '}
                ({change.percent}%)
              </span>
              <span className="text-slate-500 ml-2">in {activeTimeframe}</span>
            </div>
          </div>
          <div className="w-32 h-16 flex-shrink-0 -mt-2 -mr-2">
            <InteractiveSparkline data={history} positive={change.positive} />
          </div>
          <div className="pl-4">
            <Icons.chevron
              className={`w-6 h-6 text-slate-500 transition-transform duration-300 ${
                isOpen ? 'rotate-180' : ''
              }`}
            />
          </div>
        </div>
        <div className="flex justify-end mt-2">
          <div className="flex items-center space-x-1 bg-slate-200/70 p-1 rounded-full text-xs font-semibold">
            {['7D', '30D', '90D'].map((tf) => (
              <button
                key={tf}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveTimeframe(tf);
                }}
                className={`px-3 py-1 rounded-full transition-colors ${
                  activeTimeframe === tf
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div
        className={`transition-all duration-500 ease-in-out overflow-hidden ${
          isOpen ? 'max-h-[1000px]' : 'max-h-0'
        }`}
      >
        <SortableContext items={accounts.map((a) => a.id)} strategy={verticalListSortingStrategy}>
          <div>
            {accounts.map((account) => (
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

interface SortableFinancialInsightCardProps {
  groupData: FinancialInsightCardProps['groupData'];
  onViewAccount: (account: Account) => void;
  onDeleteAccount: (account: Account) => void;
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

// Example component that takes accounts as props instead of using mock data
interface LuxuryAccountCardProps {
  accounts: Account[];
}

export default function LuxuryAccountCard({ accounts = [] }: LuxuryAccountCardProps) {
  const initialGroupedData = useMemo(() => groupAccountsByType(accounts), [accounts]);
  const [groupedData, setGroupedData] = useState(initialGroupedData);

  // Update grouped data when accounts change
  useEffect(() => {
    const fresh = groupAccountsByType(accounts);
    setGroupedData(fresh);
  }, [accounts]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) {
      return;
    }

    const activeId = active.id;
    const overId = over.id;

    // Check if we are dragging a card
    if (String(activeId).startsWith('group-') && String(overId).startsWith('group-')) {
      if (activeId !== overId) {
        setGroupedData((items: GroupData[]) => {
          const oldIndex = items.findIndex((item: GroupData) => item.id === activeId);
          const newIndex = items.findIndex((item: GroupData) => item.id === overId);
          return arrayMove(items, oldIndex, newIndex);
        });
      }
    }

    if (String(activeId).startsWith('acc-') && String(overId).startsWith('acc-')) {
      setGroupedData((prevData: GroupData[]) => {
        const newData = [...prevData];
        const activeGroupIndex = newData.findIndex((group: GroupData) =>
          group.accounts.some((acc: Account) => acc.id === activeId),
        );
        const overGroupIndex = newData.findIndex((group: GroupData) =>
          group.accounts.some((acc: Account) => acc.id === overId),
        );

        // Handle reordering within the same group
        if (activeGroupIndex === overGroupIndex) {
          const group = newData[activeGroupIndex];
          const oldIndex = group.accounts.findIndex((acc: Account) => acc.id === activeId);
          const newIndex = group.accounts.findIndex((acc: Account) => acc.id === overId);
          if (oldIndex !== newIndex) {
            group.accounts = arrayMove(group.accounts, oldIndex, newIndex);
          }
        }
        return newData;
      });
    }
  };

  const handleViewAccount = (account: Account) => {
    console.log('View account:', account);
    // Implement view account logic here
  };

  const handleDeleteAccount = (account: Account) => {
    console.log('Delete account:', account);
    // Implement delete account logic here
    setGroupedData((prevData: GroupData[]) => {
      return prevData
        .map((group: GroupData) => ({
          ...group,
          accounts: group.accounts.filter((acc: Account) => acc.id !== account.id),
        }))
        .filter((group: GroupData) => group.accounts.length > 0);
    });
  };

  return (
    <>
      <style>{`@keyframes vectr-shimmer {0% { background-position: 200% center; } 100% { background-position: -200% center; }}.vectr-shift {position: relative;color: transparent;background-image: linear-gradient(to right, #171717 40%, #e5e5e5 50%, #171717 60%);background-size: 200% auto;-webkit-background-clip: text;background-clip: text;animation: vectr-shimmer 2.5s linear infinite;animation-play-state: paused;}.vectr-shift::before {content: attr(data-text);position: absolute;top: 0;left: 0;width: 100%;height: 100%;color: #171717;z-index: -1;}.group\\/card:hover .vectr-shift {animation-play-state: running;}`}</style>
      <div className="bg-slate-100 min-h-screen font-sans p-4 sm:p-8">
        <div className="max-w-3xl mx-auto">
          <header className="mb-10 text-center">
            <h1 className="text-5xl font-extrabold text-slate-900 tracking-tighter">
              Vectr Dashboard
            </h1>
            <p className="text-slate-600 mt-2 text-xl">
              A dynamic overview of your financial landscape.
            </p>
          </header>
          <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext
              items={groupedData.map((g: GroupData) => g.id)}
              strategy={verticalListSortingStrategy}
            >
              <div>
                {groupedData.map((group: GroupData) => (
                  <SortableFinancialInsightCard
                    key={group.id}
                    groupData={group}
                    onViewAccount={handleViewAccount}
                    onDeleteAccount={handleDeleteAccount}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      </div>
    </>
  );
}
