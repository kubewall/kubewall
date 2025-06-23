import React, { useEffect, useState } from 'react';
import { ComponentIcon } from 'lucide-react';
import { loadSvgByName } from '@/utils';

type Props = {
  name: string
  alt?: string
  className?: string
  fallback?: React.ReactNode
  minWidth?: number | string
}

const SvgRenderer: React.FC<Props> = ({
  name,
  alt = '',
  className,
  fallback = null,
  minWidth,
}) => {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    loadSvgByName(name).then((svg) => {
      if (isMounted) setSrc(svg);
    });
    return () => {
      isMounted = false;
    };
  }, [name]);

  if (!name) return <>{fallback ?? <ComponentIcon size={16} />}</>;
  if (!src) return <>{fallback ?? <ComponentIcon size={16} />}</>;

  return (
    <img
      src={src}
      alt={alt || name}
      width={16}
      height={16}
      className={className}
      style={{ minWidth, ...((className && {}) || {}) }}
    />
  );
};

export { SvgRenderer };
