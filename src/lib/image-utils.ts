/**
 * Convierte un blob: URL a un data URL (base64).
 * @react-pdf/renderer no carga blob: URLs de forma confiable,
 * pero sí funciona con data URLs.
 */
export function blobUrlToDataUrl(blobUrl: string): Promise<string> {
  // Si ya es un data URL, retornarlo directamente
  if (blobUrl.startsWith("data:")) return Promise.resolve(blobUrl);

  return fetch(blobUrl)
    .then((res) => res.blob())
    .then(
      (blob) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        })
    );
}
