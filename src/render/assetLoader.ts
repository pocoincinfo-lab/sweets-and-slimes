export interface LoadedAssets {
  titleBannerUrl: string;
  rocketEmblemUrl: string;
  kingSlimeBadgeUrl: string;
  rocketEmblemImg: HTMLImageElement | null;
  kingSlimeBadgeImg: HTMLImageElement | null;
}

/**
 * Flood-fills pure/near-white background from the four outer borders of an image
 * so internal white frosting/cream highlights stay completely intact.
 */
function removeOuterWhiteBackground(img: HTMLImageElement): Promise<{ url: string; cleanImg: HTMLImageElement }> {
  return new Promise((resolve) => {
    try {
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      if (!w || !h) {
        resolve({ url: img.src, cleanImg: img });
        return;
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve({ url: img.src, cleanImg: img });
        return;
      }
      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, w, h);
      const data = imgData.data;

      const visited = new Uint8Array(w * h);
      const queue = new Int32Array(w * h);
      let head = 0;
      let tail = 0;

      const isBgColor = (idx: number): boolean => {
        const i = idx * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const maxC = Math.max(r, g, b);
        const minC = Math.min(r, g, b);
        return r > 236 && g > 236 && b > 236 && maxC - minC < 18;
      };

      const pushIfBg = (x: number, y: number) => {
        const idx = y * w + x;
        if (!visited[idx] && isBgColor(idx)) {
          visited[idx] = 1;
          queue[tail++] = idx;
        }
      };

      for (let x = 0; x < w; x++) {
        pushIfBg(x, 0);
        pushIfBg(x, h - 1);
      }
      for (let y = 0; y < h; y++) {
        pushIfBg(0, y);
        pushIfBg(w - 1, y);
      }

      while (head < tail) {
        const curr = queue[head++];
        const x = curr % w;
        const y = (curr / w) | 0;
        data[curr * 4 + 3] = 0;

        if (x > 0) pushIfBg(x - 1, y);
        if (x < w - 1) pushIfBg(x + 1, y);
        if (y > 0) pushIfBg(x, y - 1);
        if (y < h - 1) pushIfBg(x, y + 1);
      }

      // Soften 1px fringe around removed background
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const idx = y * w + x;
          if (visited[idx]) continue;
          const adjBg =
            visited[idx - 1] || visited[idx + 1] || visited[idx - w] || visited[idx + w];
          if (adjBg) {
            const p = idx * 4;
            const lum = (data[p] + data[p + 1] + data[p + 2]) / 3;
            if (lum > 220) {
              data[p + 3] = Math.round(data[p + 3] * 0.45);
            }
          }
        }
      }

      ctx.putImageData(imgData, 0, 0);
      const url = canvas.toDataURL('image/png');
      const cleanImg = new Image();
      cleanImg.onload = () => resolve({ url, cleanImg });
      cleanImg.onerror = () => resolve({ url, cleanImg: img });
      cleanImg.src = url;
    } catch {
      resolve({ url: img.src, cleanImg: img });
    }
  });
}

function loadRawImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export async function loadGameAssets(): Promise<LoadedAssets> {
  const titleUrl = '/assets/title_banner.png';
  const rocketRawUrl = '/assets/rocket_emblem.png';
  const slimeRawUrl = '/assets/king_slime_badge.png';

  const [rocketImgRaw, slimeImgRaw] = await Promise.all([
    loadRawImage(rocketRawUrl),
    loadRawImage(slimeRawUrl),
  ]);

  let rocketEmblemUrl = rocketRawUrl;
  let rocketEmblemImg: HTMLImageElement | null = rocketImgRaw;
  if (rocketImgRaw) {
    const cleaned = await removeOuterWhiteBackground(rocketImgRaw);
    rocketEmblemUrl = cleaned.url;
    rocketEmblemImg = cleaned.cleanImg;
  }

  let kingSlimeBadgeUrl = slimeRawUrl;
  let kingSlimeBadgeImg: HTMLImageElement | null = slimeImgRaw;
  if (slimeImgRaw) {
    const cleaned = await removeOuterWhiteBackground(slimeImgRaw);
    kingSlimeBadgeUrl = cleaned.url;
    kingSlimeBadgeImg = cleaned.cleanImg;
  }

  return {
    titleBannerUrl: titleUrl,
    rocketEmblemUrl,
    kingSlimeBadgeUrl,
    rocketEmblemImg,
    kingSlimeBadgeImg,
  };
}
