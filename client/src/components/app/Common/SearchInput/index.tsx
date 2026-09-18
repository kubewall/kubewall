import { useEffect, useRef } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const GLOBAL_SEARCH_INPUT_ID = 'global-search';

const LEADING_WHITESPACE = /^\s+/;

const FOCUS_SHORTCUT_IGNORED_INPUT_IDS = [
  'addKwAiConfigUrl',
  'addKwAiConfigApiKey',
  'addKwAiConfigAlias',
  GLOBAL_SEARCH_INPUT_ID,
];

type SearchInputProps = {
  value: string;
  onChange: (value: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'>;

const SearchInput = ({ value, onChange, ...props }: SearchInputProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const focusOnSlash = (event: KeyboardEvent) => {
      if (event.key !== '/') {
        return;
      }
      const target = event.target as HTMLInputElement | null;
      if (target?.role === 'combobox') {
        return;
      }
      if (FOCUS_SHORTCUT_IGNORED_INPUT_IDS.includes(target?.id ?? '')) {
        return;
      }
      event.preventDefault();
      inputRef.current?.focus();
    };

    document.addEventListener("keydown", focusOnSlash);
    return () => document.removeEventListener("keydown", focusOnSlash);
  }, []);

  return (
    <Input
      {...props}
      ref={inputRef}
      type="search"
      value={value}
      onChange={(event) => onChange(event.target.value.replace(LEADING_WHITESPACE, ''))}
      id={GLOBAL_SEARCH_INPUT_ID}
      className={cn(props.className, value ? "ring-1 ring-ring" : "")}
    />
  );
};

export { SearchInput };
