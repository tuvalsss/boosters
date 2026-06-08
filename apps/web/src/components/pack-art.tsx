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
  const positionClass = /\b(absolute|fixed|sticky)\b/.test(className) ? '' : 'relative';
  const hasNativePackFinish = src.includes('/assets/brand-packs/');

  return (
    <span
      className={`pack-art-shell ${positionClass} inline-flex overflow-hidden ${className}`}
      style={style}
    >
      <Image
        src={src}
        alt={alt}
        width={600}
        height={900}
        className={`relative z-10 h-full w-auto object-contain ${imageClassName}`}
      />
      {!hasNativePackFinish && (
        <>
          <span className="pack-art-crimp pack-art-crimp-top" />
          <span className="pack-art-crimp pack-art-crimp-bottom" />
          <span className="pack-art-side pack-art-side-left" />
          <span className="pack-art-side pack-art-side-right" />
        </>
      )}
      <span className={`pack-art-shine ${hasNativePackFinish ? 'pack-art-shine-native' : ''}`} />
    </span>
  );
}
