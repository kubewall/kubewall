import { Toaster as Sonner } from "sonner";
import { useTheme } from "next-themes";

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:items-start group-[.toaster]:gap-2.5 group-[.toaster]:rounded-lg group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:pr-8 max-h-[260px]",
          title: "group-[.toast]:text-[13px] group-[.toast]:font-semibold",
          description:
            "group-[.toast]:text-xs group-[.toast]:leading-relaxed group-[.toast]:text-muted-foreground max-h-[180px] overflow-auto whitespace-pre-wrap break-words",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          // Sonner parks the close button outside the top-left corner. Its own
          // rules are two attribute selectors deep, so pinning it inside the
          // top-right corner needs !important to win.
          closeButton:
            "group-[.toast]:!left-auto group-[.toast]:!right-1.5 group-[.toast]:!top-1.5 group-[.toast]:!translate-x-0 group-[.toast]:!translate-y-0 group-[.toast]:!h-5 group-[.toast]:!w-5 group-[.toast]:!rounded-md group-[.toast]:!border-transparent group-[.toast]:!bg-transparent group-[.toast]:!text-current group-[.toast]:!opacity-50 group-[.toast]:hover:!opacity-100 group-[.toast]:hover:!bg-foreground/10",
          icon: "group-[.toast]:mt-0.5 group-[.toast]:shrink-0",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
