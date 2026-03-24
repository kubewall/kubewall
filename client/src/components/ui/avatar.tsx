import * as AvatarPrimitive from "@radix-ui/react-avatar";
import * as React from "react";

import { cn } from "@/lib/utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const AvatarRoot = AvatarPrimitive.Root as React.ForwardRefExoticComponent<
  React.HTMLAttributes<HTMLSpanElement> & React.RefAttributes<HTMLSpanElement>
>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const AvatarImg = AvatarPrimitive.Image as React.ForwardRefExoticComponent<
  React.ImgHTMLAttributes<HTMLImageElement> &
    { onLoadingStatusChange?: (status: string) => void } &
    React.RefAttributes<HTMLImageElement>
>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const AvatarFallbackEl = AvatarPrimitive.Fallback as React.ForwardRefExoticComponent<
  React.HTMLAttributes<HTMLSpanElement> &
    { delayMs?: number } &
    React.RefAttributes<HTMLSpanElement>
>;

const Avatar = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement>
>(({ className, ...props }, ref) => (
  <AvatarRoot
    ref={ref}
    className={cn(
      "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full",
      className
    )}
    {...props}
  />
));
Avatar.displayName = AvatarPrimitive.Root.displayName;

const AvatarImage = React.forwardRef<
  HTMLImageElement,
  React.ImgHTMLAttributes<HTMLImageElement> & { onLoadingStatusChange?: (status: string) => void }
>(({ className, ...props }, ref) => (
  <AvatarImg
    ref={ref}
    className={cn("aspect-square h-full w-full", className)}
    {...props}
  />
));
AvatarImage.displayName = AvatarPrimitive.Image.displayName;

const AvatarFallback = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement> & { delayMs?: number }
>(({ className, ...props }, ref) => (
  <AvatarFallbackEl
    ref={ref}
    className={cn(
      "flex h-full w-full items-center justify-center rounded-full bg-muted",
      className
    )}
    {...props}
  />
));
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;

export { Avatar, AvatarImage, AvatarFallback };
