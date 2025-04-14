import React, { useEffect, useState } from 'react';

import { ComponentIcon } from 'lucide-react';
import { loadSvgByName } from '@/utils';

type Props = {
  name: string
  alt?: string
  className?: string
  fallback?: React.ReactNode
}

const SvgRenderer: React.FC<Props> = ({ name, alt = '', className, fallback = null }) => {
  if (!name) return <>{fallback ?? <ComponentIcon size={16} />}</>
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    loadSvgByName(name).then((svg) => {
      if (isMounted) setSrc(svg)
    })
    return () => {
      isMounted = false
    }
  }, [name])

  if (!src) return <>{fallback ?? <ComponentIcon size={16} />}</>

  return <img src={src} alt={alt || name} width={16} height={16} className={className} />
};

export {
  SvgRenderer
}
