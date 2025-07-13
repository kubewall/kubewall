import { useEffect, useRef, useState } from "react";

import { Input } from "@/components/ui/input";

const DebouncedInput = ({
  value: initialValue,
  onChange,
  debounce = 250,
  ...props
}: {
  value: string | number
  onChange: (value: string | number) => void
  debounce?: number
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'>) => {
  const [value, setValue] = useState(initialValue);
  const globalSearchRef = useRef<null | HTMLInputElement>(null);

  const inputTextExceptionIds = [
    'addKwAiConfigUrl',
    'addKwAiConfigApiKey',
    'addKwAiConfigAlias',
    'global-search',
  ];
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "/" && !inputTextExceptionIds.includes((e.target as HTMLInputElement)?.id) && (e.target as HTMLInputElement)?.role !== 'combobox') {
        e.preventDefault();
        globalSearchRef.current?.focus();
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);


  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      onChange(value);
    }, debounce);

    return () => clearTimeout(timeout);
  }, [value]);

  return (
    <Input
      {...props}
      ref={globalSearchRef}
      type="search"
      value={value}
      onChange={e => setValue(e.target.value.trim())}
      id="global-search"
    />
  );
};

export {
  DebouncedInput
};