import { toast } from "sonner";

type ActionError = {
  message?: string;
  code?: number;
} | null | undefined;

// A refused action (403) gets the "Not allowed" toast
// with the server's reason; every other failure keeps the generic one.
const NOT_ALLOWED_CLASSES = {
  toast: '!bg-destructive !text-destructive-foreground !border-destructive-foreground/20',
  title: '!text-destructive-foreground',
  description: '!text-destructive-foreground/85',
  icon: '!text-destructive-foreground',
};

const toastActionError = (error: ActionError, fallback = '') => {
  const description = error?.message || fallback;
  if (error?.code === 403) {
    toast.error('Not allowed', { description, classNames: NOT_ALLOWED_CLASSES });
    return;
  }
  toast.error('Failure', { description });
};

export { toastActionError };
