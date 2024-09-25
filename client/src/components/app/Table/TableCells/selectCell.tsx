import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import * as React from "react";

import { Checkbox } from "@/components/ui/checkbox"; // Import your ShadCN Checkbox component

// The updated component with a forward ref
const IndeterminateCheckbox = React.forwardRef<
React.ElementRef<typeof CheckboxPrimitive.Root>,
React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className = '', ...rest }, ref) => {
  return (
    <Checkbox
      ref={ref} // Pass the ref to ShadCN Checkbox
      className={className} // Ensure classNames are handled correctly
      {...rest} // Spread the rest of the props (like checked)
    />
  );
});

// Display name for debugging purposes
IndeterminateCheckbox.displayName = 'IndeterminateCheckbox';

export { IndeterminateCheckbox };
