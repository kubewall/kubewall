import { Badge } from "@/components/ui/badge";
import { CheckCircledIcon, CrossCircledIcon, ExclamationTriangleIcon } from "@radix-ui/react-icons";

interface ClusterStatusCellProps {
  connected: boolean;
  reachable?: boolean;
  error?: string;
}

export const ClusterStatusCell = ({ connected, reachable }: ClusterStatusCellProps) => {
  // If we have reachability information, use it
  if (reachable !== undefined) {
    if (reachable) {
      return (
        <Badge variant="default" className="bg-green-100 text-green-800">
          <CheckCircledIcon className="w-3 h-3 mr-1" />
          Active
        </Badge>
      );
    } else {
      return (
        <Badge variant="destructive">
          <CrossCircledIcon className="w-3 h-3 mr-1" />
          Not Reachable
        </Badge>
      );
    }
  }

  // Fallback to connected status
  if (connected) {
    return (
      <Badge variant="default" className="bg-green-100 text-green-800">
        <CheckCircledIcon className="w-3 h-3 mr-1" />
        Active
      </Badge>
    );
  } else {
    return (
      <Badge variant="secondary">
        <ExclamationTriangleIcon className="w-3 h-3 mr-1" />
        Inactive
      </Badge>
    );
  }
}; 