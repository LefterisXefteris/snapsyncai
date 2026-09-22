import { useEffect, useRef, useState, type ImgHTMLAttributes } from "react";
import { fetchImageObjectUrl } from "@/lib/authenticated-image";

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  path: string;
  onUnavailable?: () => void;
};

/** `<img>` that loads `/api/images/:id/file` with the Clerk Bearer token. */
export function AuthenticatedImg({ path, alt, onUnavailable, ...rest }: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const onUnavailableRef = useRef(onUnavailable);
  onUnavailableRef.current = onUnavailable;

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    fetchImageObjectUrl(path).then((url) => {
      if (cancelled) {
        if (url) URL.revokeObjectURL(url);
        return;
      }
      objectUrl = url;
      setSrc(url);
      if (!url) onUnavailableRef.current?.();
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);

  if (!src) return null;
  return <img src={src} alt={alt ?? ""} {...rest} />;
}
