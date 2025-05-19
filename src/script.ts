// script.ts — draw only a colored mask, CSS does the rest
import {
  FilesetResolver,
  ImageSegmenter
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.2";

// DOM refs
const video         = document.querySelector<HTMLVideoElement>(".input_video")!;
const maskCanvas    = document.getElementById("maskCanvas") as HTMLCanvasElement;
const maskCtx       = maskCanvas.getContext("2d")!;
const enableCamBtn  = document.getElementById("enableCam")!;
const hueSlider     = document.getElementById("hue") as HTMLInputElement;
const satSlider     = document.getElementById("saturation") as HTMLInputElement;
const brightSlider  = document.getElementById("brightness") as HTMLInputElement;
const opacitySlider = document.getElementById("opacity") as HTMLInputElement;
const blendSelect   = document.getElementById("blendMode") as HTMLSelectElement;
const featherSlider = document.getElementById("feather") as HTMLInputElement;

// whenever the user moves it, update the CSS blur
featherSlider.addEventListener("input", () => {
  maskCanvas.style.filter = `blur(${featherSlider.value}px)`;
});

// HSL→RGB util (as before)
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

async function init() {
  // Load MediaPipe
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.2/wasm"
  );
  const segmenter = await ImageSegmenter.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/image_segmenter/hair_segmenter/float32/latest/hair_segmenter.tflite"
    },
    outputCategoryMask: true,
    runningMode: "LIVE_STREAM"
  });

  function predict() {
    segmenter.segmentForVideo(video, performance.now(), (result) => {
      const mask = result.categoryMask!;
      const { width, height } = mask;
      maskCanvas.width  = width;
      maskCanvas.height = height;

      // Build a raw ImageData: hair pixels → fill color, others → transparent
      const imgData = maskCtx.createImageData(width, height);
      const data    = imgData.data;
      const maskArr = mask.getAsUint8Array();

      // compute your chosen color
      const [r, g, b] = hslToRgb(
        parseFloat(hueSlider.value)/360,
        parseFloat(satSlider.value)/100,
        parseFloat(brightSlider.value)/100
      );

      for (let i = 0; i < maskArr.length; ++i) {
        if (maskArr[i] === 1) {
          const j = i * 4;
          data[j    ] = r;
          data[j + 1] = g;
          data[j + 2] = b;
          data[j + 3] = 255;  // opaque
        }
        // else leave [j+3] = 0 → fully transparent
      }

      // Draw that single ImageData onto the mask canvas
      maskCtx.putImageData(imgData, 0, 0);

      requestAnimationFrame(predict);
    });
  }

  enableCamBtn.addEventListener("click", async () => {
    enableCamBtn.setAttribute("disabled", "");
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    video.play();
    video.addEventListener("loadeddata", () => {
      // Hook up dynamic CSS controls:
      opacitySlider.addEventListener("input", () => {
        maskCanvas.style.opacity = (parseFloat(opacitySlider.value)/100).toString();
      });
      blendSelect.addEventListener("change", () => {
        maskCanvas.style.mixBlendMode = blendSelect.value as any;
      });
      // kick off the loop
      predict();
    });
  });
}

init();
