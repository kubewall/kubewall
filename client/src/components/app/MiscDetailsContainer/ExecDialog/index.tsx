import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { SearchAddon } from '@xterm/addon-search';
import { TerminalIcon } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import ExecTerminal from '@/components/app/MiscDetailsContainer/ExecTerminal';

type ExecDialogProps = {
  open: boolean;
  onClose: () => void;
  namespace: string;
  pod: string;
  container: string;
  configName: string;
  clusterName: string;
  command?: string[];
};

const ExecDialog = ({
  open,
  onClose,
  namespace,
  pod,
  container,
  configName,
  clusterName,
  command,
}: ExecDialogProps) => {
  const xtermRef = useRef<Terminal | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);

  const handleClose = () => {
    // Dispose terminal to clean up
    if (xtermRef.current) {
      try {
        xtermRef.current.dispose();
      } catch (e) {
        // Ignore disposal errors
      }
      xtermRef.current = null;
    }
    onClose();
  };

  // Reset terminal ref when dialog closes
  useEffect(() => {
    if (!open && xtermRef.current) {
      try {
        xtermRef.current.dispose();
      } catch (e) {
        // Ignore disposal errors
      }
      xtermRef.current = null;
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl h-[600px] p-0 gap-0" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader className="p-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <TerminalIcon className="h-4 w-4" />
            <span>Exec: {pod}</span>
            <span className="text-muted-foreground text-sm font-normal">
              ({container})
            </span>
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 h-[calc(100%-60px)] bg-black p-2">
          {open && (
            <ExecTerminal
              namespace={namespace}
              pod={pod}
              container={container}
              configName={configName}
              clusterName={clusterName}
              command={command}
              xtermRef={xtermRef}
              searchAddonRef={searchAddonRef}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ExecDialog;
