'use client';

import React from 'react';
import { RefreshCw, CheckCircle, AlertTriangle, Clock } from 'lucide-react';

import { useAccountSync } from '@/contexts/AccountSyncContext';
import { cn } from '@/lib/utils/utils';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';

interface GlobalSyncIndicatorProps {
  className?: string;
  showDetails?: boolean;
}

export function GlobalSyncIndicator({ className, showDetails = false }: GlobalSyncIndicatorProps) {
  const { state, hasActiveOperations, getSyncProgress, isBulkSyncing, clearAllSyncs } =
    useAccountSync();

  // Don't show indicator if no active operations
  if (!hasActiveOperations() && !state.lastSyncTime) {
    return null;
  }

  const progress = getSyncProgress();
  const activeSyncCount = state.activeSyncs.size;
  const backgroundProcessCount = state.backgroundProcesses.length;

  // Determine indicator status and appearance
  const getStatusInfo = () => {
    if (state.isGlobalSyncActive) {
      if (isBulkSyncing()) {
        return {
          status: 'syncing',
          icon: RefreshCw,
          label: `Syncing ${state.bulkSyncData?.totalAccounts} accounts`,
          color: 'text-blue-600',
          bgColor: 'bg-blue-50 border-blue-200',
          animate: true,
        };
      } else if (activeSyncCount > 0) {
        return {
          status: 'syncing',
          icon: RefreshCw,
          label: `Syncing ${activeSyncCount} account${activeSyncCount > 1 ? 's' : ''}`,
          color: 'text-blue-600',
          bgColor: 'bg-blue-50 border-blue-200',
          animate: true,
        };
      }
    }

    if (backgroundProcessCount > 0) {
      return {
        status: 'background',
        icon: Clock,
        label: `${backgroundProcessCount} background process${
          backgroundProcessCount > 1 ? 'es' : ''
        }`,
        color: 'text-amber-600',
        bgColor: 'bg-amber-50 border-amber-200',
        animate: false,
      };
    }

    if (state.lastSyncTime) {
      const timeSinceSync = Date.now() - state.lastSyncTime.getTime();
      const minutesAgo = Math.floor(timeSinceSync / (1000 * 60));

      return {
        status: 'completed',
        icon: CheckCircle,
        label: `Last sync: ${minutesAgo < 1 ? 'just now' : `${minutesAgo}m ago`}`,
        color: 'text-green-600',
        bgColor: 'bg-green-50 border-green-200',
        animate: false,
      };
    }

    return null;
  };

  const statusInfo = getStatusInfo();
  if (!statusInfo) {
    return null;
  }

  const StatusIcon = statusInfo.icon;

  const IndicatorContent = () => (
    <Badge
      variant="outline"
      className={cn(
        'flex items-center space-x-2 px-3 py-1.5 text-xs font-medium transition-all',
        statusInfo.bgColor,
        statusInfo.color,
        className,
      )}
    >
      <StatusIcon className={cn('h-3 w-3', statusInfo.animate && 'animate-spin')} />
      <span>{statusInfo.label}</span>
      {state.isGlobalSyncActive && progress > 0 && (
        <span className="text-xs font-normal">({progress}%)</span>
      )}
    </Badge>
  );

  // If showing details or there are complex operations, wrap in popover
  if (showDetails || state.isGlobalSyncActive || backgroundProcessCount > 0) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <div className="cursor-pointer">
            <IndicatorContent />
          </div>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 p-4" side="bottom" sideOffset={8}>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm">Sync Status</h4>
              {state.isGlobalSyncActive && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearAllSyncs}
                  className="h-7 px-2 text-xs"
                >
                  Cancel All
                </Button>
              )}
            </div>

            {/* Bulk Sync Progress */}
            {state.bulkSyncData && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Bulk Sync Progress</span>
                  <span className="text-xs text-muted-foreground">
                    {state.bulkSyncData.completedAccounts} / {state.bulkSyncData.totalAccounts}
                  </span>
                </div>
                <Progress value={progress} className="h-2" />
                {state.bulkSyncData.currentAccount && (
                  <p className="text-xs text-muted-foreground">
                    Currently: {state.bulkSyncData.currentAccount}
                  </p>
                )}
                {state.bulkSyncData.estimatedTime && (
                  <p className="text-xs text-muted-foreground">
                    Est. {state.bulkSyncData.estimatedTime} remaining
                  </p>
                )}
                {state.bulkSyncData.failedAccounts &&
                  state.bulkSyncData.failedAccounts.length > 0 && (
                    <div className="flex items-center space-x-1 text-xs text-orange-600">
                      <AlertTriangle className="h-3 w-3" />
                      <span>{state.bulkSyncData.failedAccounts.length} failed</span>
                    </div>
                  )}
              </div>
            )}

            {/* Individual Account Syncs */}
            {activeSyncCount > 0 && !state.bulkSyncData && (
              <div className="space-y-2">
                <h5 className="text-sm font-medium">Active Syncs</h5>
                <div className="space-y-2">
                  {Array.from(state.activeSyncs.values()).map((sync) => (
                    <div key={sync.accountName} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">{sync.accountName}</span>
                        <span className="text-xs text-muted-foreground">
                          {sync.step} / {sync.totalSteps}
                        </span>
                      </div>
                      <Progress value={(sync.step / sync.totalSteps) * 100} className="h-1.5" />
                      <p className="text-xs text-muted-foreground">{sync.currentOperation}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Background Processes */}
            {backgroundProcessCount > 0 && (
              <div className="space-y-2">
                <h5 className="text-sm font-medium">Background Processes</h5>
                <div className="space-y-1">
                  {state.backgroundProcesses.map((process) => (
                    <div key={process.id} className="flex items-center justify-between">
                      <span className="text-sm">{process.message}</span>
                      <span className="text-xs text-muted-foreground">
                        {Math.floor((Date.now() - process.startTime.getTime()) / (1000 * 60))}m
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Last Sync Time */}
            {state.lastSyncTime && !state.isGlobalSyncActive && (
              <div className="pt-2 border-t border-border">
                <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                  <CheckCircle className="h-3 w-3" />
                  <span>Last successful sync: {state.lastSyncTime.toLocaleTimeString()}</span>
                </div>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  // Simple indicator without popover
  return <IndicatorContent />;
}

export default GlobalSyncIndicator;
