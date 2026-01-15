import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Kubernetes DNS label validation (RFC 1123) - matches backend rules exactly
 * Rules:
 * - Lowercase alphanumeric with hyphens only
 * - Must start and end with alphanumeric
 * - 1-63 characters
 * - Cannot be "incluster" (reserved)
 */
export const validateConfigName = (name: string): { valid: boolean; error?: string } => {
  const trimmed = name.trim().toLowerCase();

  if (!trimmed) {
    return { valid: false, error: 'Config name is required' };
  }

  if (trimmed.length > 63) {
    return { valid: false, error: 'Config name must be 63 characters or less' };
  }

  if (trimmed === 'incluster') {
    return { valid: false, error: "'incluster' is a reserved name" };
  }

  const dnsLabelRegex = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;
  if (!dnsLabelRegex.test(trimmed)) {
    return {
      valid: false,
      error: 'Config name must start and end with a lowercase letter or number, and can only contain lowercase letters, numbers, and hyphens'
    };
  }

  return { valid: true };
};

export const isConfigNameInvalid = (name: string): boolean => !validateConfigName(name).valid;

interface ConfigNameInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
}

export const ConfigNameInput = ({ id, value, onChange }: ConfigNameInputProps) => {
  const validation = value ? validateConfigName(value) : { valid: true };
  const showError = value && !validation.valid;

  return (
    <div className="space-y-1">
      <Label htmlFor={id}>Config Name</Label>
      <Input
        id={id}
        placeholder="my-cluster"
        value={value}
        className={cn(
          'shadow-none',
          showError && 'border-red-500 focus-visible:ring-red-500'
        )}
        onChange={(e) => onChange(e.target.value.toLowerCase())}
      />
      {showError ? (
        <p className="text-red-500 text-sm">{validation.error}</p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Lowercase letters, numbers, and hyphens only. Must start and end with alphanumeric (1-63 characters).
        </p>
      )}
    </div>
  );
};
