/** Resuelve una fuente de imagen: data URLs se usan directo, rutas relativas se prefijan con /edu/ */
export function resolveImageSrc(src: string): string {
  if (!src) return "";
  if (src.startsWith("data:") || src.startsWith("blob:") || src.startsWith("http") || src.startsWith("/")) {
    return src;
  }
  return `/edu/${src}`;
}
