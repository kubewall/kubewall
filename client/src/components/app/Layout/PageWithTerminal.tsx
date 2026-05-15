// PageWithTerminal is no longer needed as a layout wrapper.
// The terminal is now rendered directly in app.tsx via a vertical
// ResizablePanelGroup so it never creates a second scroll container.
// This file re-exports a passthrough for any remaining imports.

import { ReactNode } from 'react';

interface PageWithTerminalProps {
  children: ReactNode;
}

const PageWithTerminal = ({ children }: PageWithTerminalProps) => {
  return <>{children}</>;
};

export default PageWithTerminal;
