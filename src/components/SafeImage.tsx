import { useState } from 'react';
import { ImageOff } from 'lucide-react';

interface SafeImageProps {
  src?: string;
  alt: string;
  className?: string;
  fallbackLabel?: string;
}

export function SafeImage({ src, alt, className = '', fallbackLabel }: SafeImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-sky-50 via-slate-50 to-slate-100 text-slate-400 p-3 text-center ${className}`}
        aria-label={alt}
      >
        <ImageOff className="w-5 h-5 text-sky-400/80 mb-1" />
        {fallbackLabel && (
          <span className="text-xs font-medium text-slate-500 line-clamp-1">{fallbackLabel}</span>
        )}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
