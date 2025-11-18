// Complex number type
type Complex = { re: number; im: number };

// Basic operations
const add = (a: Complex, b: Complex): Complex => ({ re: a.re + b.re, im: a.im + b.im });
const sub = (a: Complex, b: Complex): Complex => ({ re: a.re - b.re, im: a.im - b.im });
const mul = (a: Complex, b: Complex): Complex => ({
  re: a.re * b.re - a.im * b.im,
  im: a.re * b.im + a.im * b.re,
});
const exp = (theta: number): Complex => ({ re: Math.cos(theta), im: Math.sin(theta) });

/**
 * Cooley-Tukey FFT implementation.
 * Input must be a power of 2 length.
 */
const fftRecursive = (x: Complex[]): Complex[] => {
  const N = x.length;
  if (N <= 1) return x;

  const even = fftRecursive(x.filter((_, i) => i % 2 === 0));
  const odd = fftRecursive(x.filter((_, i) => i % 2 !== 0));

  const T = new Array(N / 2);
  for (let k = 0; k < N / 2; k++) {
    const t = mul(exp(-2 * Math.PI * k / N), odd[k]);
    T[k] = t;
  }

  const result = new Array(N);
  for (let k = 0; k < N / 2; k++) {
    result[k] = add(even[k], T[k]);
    result[k + N / 2] = sub(even[k], T[k]);
  }
  return result;
};

/**
 * Zero-pads input array to nearest power of 2 and performs FFT.
 * Returns magnitude array.
 */
export const calculateFFT = (inputSignal: number[]): number[] => {
  if (inputSignal.length === 0) return [];

  // Zero padding to next power of 2
  const n = inputSignal.length;
  const power = Math.ceil(Math.log2(n));
  const N = Math.pow(2, power);
  
  const complexInput: Complex[] = Array(N).fill({ re: 0, im: 0 });
  for (let i = 0; i < n; i++) {
    complexInput[i] = { re: inputSignal[i], im: 0 };
  }

  const fftResult = fftRecursive(complexInput);

  // Calculate magnitude, normalize by N
  // We use N/2 for normalization in one-sided spectrum, 
  // but conceptually magnitude = |fft| / N is standard for amplitude conservation.
  const magnitudes = fftResult.slice(0, N / 2).map(c => {
    return (2 * Math.sqrt(c.re * c.re + c.im * c.im)) / n; 
  });

  return magnitudes;
};

export const getAverageBrightness = (data: Uint8ClampedArray): number => {
  let totalBrightness = 0;
  const pixels = data.length / 4;
  
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    // Standard Luma formula
    const brightness = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    totalBrightness += brightness;
  }
  
  return totalBrightness / pixels;
};

/**
 * Resamples irregular time-series data to a fixed sample rate using Linear Interpolation.
 * This is crucial for stable FFT analysis on real-time data with jitter.
 * 
 * @param data Array of { timestamp, value }
 * @param startTime The start time of the window in ms
 * @param durationSec The duration of the window in seconds
 * @param sampleCount The desired number of samples (should be power of 2 for FFT)
 */
export const resampleSignal = (
  data: { timestamp: number; value: number }[],
  startTime: number,
  durationSec: number,
  sampleCount: number
): number[] => {
  const result: number[] = new Array(sampleCount);
  const step = (durationSec * 1000) / (sampleCount - 1);

  // Optimization: maintain a cursor to avoid re-scanning the array
  let cursor = 0;

  for (let i = 0; i < sampleCount; i++) {
    const t = startTime + i * step;
    
    // Find p1 and p2 such that p1.time <= t <= p2.time
    // Advance cursor
    while (cursor < data.length - 1 && data[cursor + 1].timestamp < t) {
      cursor++;
    }

    const p1 = data[cursor];
    // If we are past the end of data, hold the last value
    const p2 = data[cursor + 1] || p1; 

    if (!p1) {
        result[i] = 0;
        continue;
    }

    if (p1.timestamp === p2.timestamp) {
        result[i] = p1.value;
    } else {
        // Linear Interpolation
        const factor = (t - p1.timestamp) / (p2.timestamp - p1.timestamp);
        // Clamp factor between 0 and 1 to prevent shooting off if t is slightly out of bounds
        const clampedFactor = Math.max(0, Math.min(1, factor));
        result[i] = p1.value + (p2.value - p1.value) * clampedFactor;
    }
  }

  return result;
};