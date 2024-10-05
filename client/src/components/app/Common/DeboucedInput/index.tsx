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
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "/" && (e.target as HTMLInputElement)?.id !== 'global-search') {
        e.preventDefault();
        globalSearchRef.current!.focus();
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
      onChange={e => setValue(e.target.value)}
      id="global-search"
    />
  );
};

export {
  DebouncedInput
};