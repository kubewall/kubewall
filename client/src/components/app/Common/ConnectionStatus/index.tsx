import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff, RefreshCw, AlertCircle } from 'lucide-react';

type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'error';

interface ConnectionStatusIndicatorProps {
  status: ConnectionStatus;
  className?: string;
}

export const ConnectionStatusIndicator: React.FC<ConnectionStatusIndicatorProps> = ({ 
  status, 
  className = '' 
}) => {
  const getStatusConfig = (status: ConnectionStatus) => {
    switch (status) {
      case 'connecting':
        return {
          icon: <RefreshCw className="h-3 w-3 animate-spin" />,
          text: 'Connecting...',
          variant: 'secondary' as const,
          color: 'text-yellow-600'
        };
      case 'connected':
        return {
          icon: <Wifi className="h-3 w-3" />,
          text: 'Live',
          variant: 'default' as const,
          color: 'text-green-600'
        };
      case 'reconnecting':
        return {
          icon: <RefreshCw className="h-3 w-3 animate-spin" />,
          text: 'Reconnecting...',
          variant: 'secondary' as const,
          color: 'text-yellow-600'
        };
      case 'error':
        return {
          icon: <WifiOff className="h-3 w-3" />,
          text: 'Disconnected',
          variant: 'destructive' as const,
          color: 'text-red-600'
        };
      default:
        return {
          icon: <AlertCircle className="h-3 w-3" />,
          text: 'Unknown',
          variant: 'secondary' as const,
          color: 'text-gray-600'
        };
    }
  };

  const config = getStatusConfig(status);

  return (
    <Badge 
      variant={config.variant} 
      className={`flex items-center gap-1 text-xs ${config.color} ${className}`}
    >
      {config.icon}
      {config.text}
    </Badge>
  );
}; 