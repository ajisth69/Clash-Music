/**
 * Extracts dominant RGB colors from an image URL using HTML5 Canvas
 */
export function extractDominantColor(imageUrl) {
  return new Promise((resolve) => {
    if (!imageUrl) {
      resolve({ primary: '#FFC72C', secondary: '#FF6B8B' });
      return;
    }

    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = imageUrl;

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 40;
        canvas.height = 40;
        ctx.drawImage(img, 0, 0, 40, 40);

        const imageData = ctx.getImageData(0, 0, 40, 40).data;
        let r = 0, g = 0, b = 0, count = 0;

        for (let i = 0; i < imageData.length; i += 16) {
          r += imageData[i];
          g += imageData[i + 1];
          b += imageData[i + 2];
          count++;
        }

        r = Math.floor(r / count);
        g = Math.floor(g / count);
        b = Math.floor(b / count);

        const primary = `rgb(${r}, ${g}, ${b})`;
        const secondary = `rgb(${Math.min(r + 40, 255)}, ${Math.min(g + 40, 255)}, ${Math.min(b + 40, 255)})`;

        resolve({ primary, secondary });
      } catch (err) {
        resolve({ primary: '#FFC72C', secondary: '#FF6B8B' });
      }
    };

    img.onerror = () => {
      resolve({ primary: '#FFC72C', secondary: '#FF6B8B' });
    };
  });
}
