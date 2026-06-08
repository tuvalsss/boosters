import Image from 'next/image';
import type { CSSProperties } from 'react';

export function PackArt({
  src,
  alt,
  className = '',
  imageClassName = '',
  style,
}: {
  src: string;
  alt: string;
  className?: string;
  imageClassName?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className={`pack-art-shell relative inline-flex overflow-hidden ${className}`}
      style={style}
    >
      <Image
        src={src}
        alt={alt}
        width={600}
        height={900}
        className={`relative z-10 h-full w-auto object-contain ${imageClassName}`}
      />
      <span className="pack-art-crimp pack-art-crimp-top" />
      <span className="pack-art-crimp pack-art-crimp-bottom" />
      <span className="pack-art-side pack-art-side-left" />
      <span className="pack-art-side pack-art-side-right" />
      <span className="pack-art-shine" />
    </span>
  );
}
