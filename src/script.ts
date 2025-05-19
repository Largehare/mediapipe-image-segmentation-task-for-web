// Install the Vision Tasks SDK locally first:
//   npm install @mediapipe/tasks-vision

import {
  FilesetResolver,
  ImageSegmenter
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.2";

// Grab video/canvas elements and 2D context
const video = document.querySelector<HTMLVideoElement>(".input_video")!;
const canvas = document.querySelector<HTMLCanvasElement>(".output_canvas")!;
const ctx = canvas.getContext("2d")!;

// "Enable Webcam" button
const enableCamButton = document.getElementById("enableCam")!;

// Existing HSL sliders
const hueSlider = document.getElementById("hue") as HTMLInputElement;
const satSlider = document.getElementById("saturation") as HTMLInputElement;
const brightSlider = document.getElementById("brightness") as HTMLInputElement;

// NEW: opacity slider & blend-mode dropdown
const opacitySlider = document.getElementById("opacity") as HTMLInputElement;
const blendModeSelect = document.getElementById("blendMode") as HTMLSelectElement;

async function initHairSegmentation() {
  // Prepare the WASM runtime for Vision Tasks
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.2/wasm"
  );

  // Create the hair segmenter in LIVE_STREAM mode
  const hairSegmenter = await ImageSegmenter.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/image_segmenter/hair_segmenter/float32/latest/hair_segmenter.tflite"
    },
    outputCategoryMask: true,
    runningMode: "LIVE_STREAM"
  });

  function predictWebcam() {
    hairSegmenter.segmentForVideo(video, performance.now(), (result) => {
      const mask = result.categoryMask!;
      const { width, height } = mask;
      canvas.width = width;
      canvas.height = height;

      // Read color-adjustment sliders
      const targetHue  = parseFloat(hueSlider.value) / 360;
      const hueSat     = parseFloat(satSlider.value)   / 100;
      const brightness = parseFloat(brightSlider.value) / 100;

      // Read new opacity & blend-mode controls
      const opacity   = parseFloat(opacitySlider.value) / 100;
      const blendMode = blendModeSelect.value as GlobalCompositeOperation;

      // Precompute the fill color from HSL sliders
      const [cr, cg, cb] = hslToRgb(targetHue, hueSat, brightness);

      // Draw the live video frame first
      ctx.drawImage(video, 0, 0, width, height);

      // Overlay the colored hair mask
      const maskData = mask.getAsUint8Array();
      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.globalCompositeOperation = blendMode;
      ctx.fillStyle = `rgb(${cr}, ${cg}, ${cb})`;
      for (let i = 0; i < maskData.length; i++) {
        if (maskData[i] === 1) {
          const x = i % width;
          const y = Math.floor(i / width);
          ctx.fillRect(x, y, 1, 1);
        }
      }
      ctx.restore();
    });

    requestAnimationFrame(predictWebcam);
  }

  enableCamButton.addEventListener("click", async () => {
    enableCamButton.setAttribute("disabled", "");
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    video.addEventListener("loadeddata", predictWebcam);
  });
}

// Utility functions from your original script
function rgbToHsl(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)); break;
      case g: h = ((b - r) / d + 2); break;
      case b: h = ((r - g) / d + 4); break;
    }
    h /= 6;
  }
  return { h, s, l };
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

initHairSegmentation();