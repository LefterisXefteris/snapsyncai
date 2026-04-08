const IMAGE_NAME_RE = /\.(png|jpe?g|webp|gif|bmp|tiff?|heic|heif|avif)$/i;

type FileLike = {
  name: string;
  type?: string;
};

export function isImageLikeFile(file: FileLike): boolean {
  return (file.type ?? "").startsWith("image/") || IMAGE_NAME_RE.test(file.name);
}

export function filterImageLikeFiles<T extends FileLike>(files: Iterable<T>): T[] {
  return Array.from(files).filter(isImageLikeFile);
}
