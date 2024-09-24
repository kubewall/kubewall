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
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg max-h-[220px]",
          description: "group-[.toast]:text-muted-foreground max-h-[200px] overflow-auto",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          icon:
            "hidden"
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
