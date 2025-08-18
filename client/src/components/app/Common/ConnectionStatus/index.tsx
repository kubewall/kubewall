import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff, RefreshCw, AlertCircle } from 'lucide-react';

type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'error';

interface ConnectionStatusIndicatorProps {
  status: ConnectionStatus;
  className?: string;
}

interface ConnectionStatusIconProps {
  status: ConnectionStatus;
  showText?: boolean;
  className?: string;
}

interface ConnectionStatusDotProps {
  status: ConnectionStatus;
  className?: string;
}

export const ConnectionStatusIndicator: React.FC<ConnectionStatusIndicatorProps> = ({ 
  status, 
  className = '' 
}) => {
  return <ConnectionStatusIcon status={status} showText={true} className={className} />;
};

export const ConnectionStatusDot: React.FC<ConnectionStatusDotProps> = ({ 
  status, 
  className = '' 
}) => {
  const getDotConfig = (status: ConnectionStatus) => {
    switch (status) {
      case 'connecting':
        return {
          color: 'bg-yellow-500',
          tooltip: 'Connecting to cluster...'
        };
      case 'connected':
        return {
          color: 'bg-green-500',
          tooltip: 'Connected - Live updates active'
        };
      case 'reconnecting':
        return {
          color: 'bg-yellow-500',
          tooltip: 'Reconnecting to cluster...'
        };
      case 'error':
        return {
          color: 'bg-red-500',
          tooltip: 'Disconnected from cluster'
        };
      default:
        return {
          color: 'bg-gray-500',
          tooltip: 'Connection status unknown'
        };
    }
  };

  const config = getDotConfig(status);

  return (
    <div 
      className={`w-2 h-2 rounded-full ${config.color} ${className}`}
      title={config.tooltip}
    />
  );
};

export const ConnectionStatusIcon: React.FC<ConnectionStatusIconProps> = ({ 
  status, 
  showText = false,
  className = '' 
}) => {
  const getStatusConfig = (status: ConnectionStatus) => {
    switch (status) {
      case 'connecting':
        return {
          icon: <RefreshCw className="h-3 w-3 animate-spin" />,
          text: 'Connecting...',
          variant: 'secondary' as const,
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-100 hover:bg-yellow-200',
          tooltip: 'Connecting to cluster...'
        };
      case 'connected':
        return {
          icon: <Wifi className="h-3 w-3" />,
          text: 'Live',
          variant: 'default' as const,
          color: 'text-green-600',
          bgColor: 'bg-green-100 hover:bg-green-200',
          tooltip: 'Connected - Live updates active'
        };
      case 'reconnecting':
        return {
          icon: <RefreshCw className="h-3 w-3 animate-spin" />,
          text: 'Reconnecting...',
          variant: 'secondary' as const,
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-100 hover:bg-yellow-200',
          tooltip: 'Reconnecting to cluster...'
        };
      case 'error':
        return {
          icon: <WifiOff className="h-3 w-3" />,
          text: 'Disconnected',
          variant: 'destructive' as const,
          color: 'text-red-600',
          bgColor: 'bg-red-100 hover:bg-red-200',
          tooltip: 'Disconnected from cluster'
        };
      default:
        return {
          icon: <AlertCircle className="h-3 w-3" />,
          text: 'Unknown',
          variant: 'secondary' as const,
          color: 'text-gray-600',
          bgColor: 'bg-gray-100 hover:bg-gray-200',
          tooltip: 'Connection status unknown'
        };
    }
  };

  const config = getStatusConfig(status);

  if (showText) {
    return (
      <Badge 
        variant={config.variant} 
        className={`flex items-center gap-1 text-xs ${config.color} ${className}`}
      >
        {config.icon}
        {config.text}
      </Badge>
    );
  }

  return (
    <div 
      className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${config.bgColor} ${config.color} transition-colors cursor-default ${className}`}
      title={config.tooltip}
    >
      {config.icon}
    </div>
  );
};