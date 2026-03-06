import type { ImageAdjustments } from "@/types/annotation";

export function applyCLAHE(
  imageData: ImageData,
  clipLimit: number = 2,
  gridSize: number = 8
) {
  const { data, width, height } = imageData;

  // Extract luminance
  const numPixels = width * height;
  const luminance = new Uint8Array(numPixels);
  for (let i = 0; i < numPixels; i++) {
    luminance[i] = Math.round(
      0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]
    );
  }

  const tileW = Math.ceil(width / gridSize);
  const tileH = Math.ceil(height / gridSize);

  // Compute clipped histogram CDF for each tile
  const cdfs: Uint8Array[][] = [];

  for (let ty = 0; ty < gridSize; ty++) {
    cdfs[ty] = [];
    for (let tx = 0; tx < gridSize; tx++) {
      const x0 = tx * tileW;
      const y0 = ty * tileH;
      const x1 = Math.min(x0 + tileW, width);
      const y1 = Math.min(y0 + tileH, height);
      const pixelCount = (x1 - x0) * (y1 - y0);
      if (pixelCount === 0) {
        cdfs[ty][tx] = new Uint8Array(256).map((_, i) => i);
        continue;
      }

      const hist = new Float64Array(256);
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          hist[luminance[y * width + x]]++;
        }
      }

      // Clip histogram
      const clip = clipLimit * pixelCount / 256;
      let excess = 0;
      for (let i = 0; i < 256; i++) {
        if (hist[i] > clip) {
          excess += hist[i] - clip;
          hist[i] = clip;
        }
      }
      const redistrib = excess / 256;
      for (let i = 0; i < 256; i++) {
        hist[i] += redistrib;
      }

      // Build CDF
      const cdf = new Uint8Array(256);
      let sum = 0;
      for (let i = 0; i < 256; i++) {
        sum += hist[i];
        cdf[i] = Math.round((sum / pixelCount) * 255);
      }
      cdfs[ty][tx] = cdf;
    }
  }

  // Apply with bilinear interpolation
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const lum = luminance[idx];

      const txf = (x + 0.5) / tileW - 0.5;
      const tyf = (y + 0.5) / tileH - 0.5;
      const tx0 = Math.max(0, Math.floor(txf));
      const ty0 = Math.max(0, Math.floor(tyf));
      const tx1 = Math.min(gridSize - 1, tx0 + 1);
      const ty1 = Math.min(gridSize - 1, ty0 + 1);

      const fx = Math.max(0, Math.min(1, txf - tx0));
      const fy = Math.max(0, Math.min(1, tyf - ty0));

      const v00 = cdfs[ty0][tx0][lum];
      const v10 = cdfs[ty0][tx1][lum];
      const v01 = cdfs[ty1][tx0][lum];
      const v11 = cdfs[ty1][tx1][lum];

      const newLum = (1 - fx) * (1 - fy) * v00 + fx * (1 - fy) * v10 +
                     (1 - fx) * fy * v01 + fx * fy * v11;

      const ratio = lum > 0 ? newLum / lum : 1;
      const pi = idx * 4;
      data[pi] = Math.min(255, Math.round(data[pi] * ratio));
      data[pi + 1] = Math.min(255, Math.round(data[pi + 1] * ratio));
      data[pi + 2] = Math.min(255, Math.round(data[pi + 2] * ratio));
    }
  }
}

export function applySharpen(imageData: ImageData, amount: number) {
  if (amount <= 0) return;
  const { data, width, height } = imageData;
  const factor = amount / 100;
  const copy = new Uint8ClampedArray(data);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      for (let c = 0; c < 3; c++) {
        const idx = (y * width + x) * 4 + c;
        const center = copy[idx];
        const top = copy[((y - 1) * width + x) * 4 + c];
        const bottom = copy[((y + 1) * width + x) * 4 + c];
        const left = copy[(y * width + (x - 1)) * 4 + c];
        const right = copy[(y * width + (x + 1)) * 4 + c];
        const sharpened = 5 * center - top - bottom - left - right;
        data[idx] = Math.min(255, Math.max(0, Math.round(
          center + factor * (sharpened - center)
        )));
      }
    }
  }
}

export function applyInvert(imageData: ImageData) {
  const { data } = imageData;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255 - data[i];
    data[i + 1] = 255 - data[i + 1];
    data[i + 2] = 255 - data[i + 2];
  }
}

export function applyPixelFilters(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  adj: ImageAdjustments
) {
  const needsProcessing = adj.clahe || adj.invert || adj.sharpen > 0;
  if (!needsProcessing) return;

  const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);

  if (adj.clahe) {
    applyCLAHE(imageData, adj.claheClipLimit);
  }
  if (adj.sharpen > 0) {
    applySharpen(imageData, adj.sharpen);
  }
  if (adj.invert) {
    applyInvert(imageData);
  }

  ctx.putImageData(imageData, 0, 0);
}
