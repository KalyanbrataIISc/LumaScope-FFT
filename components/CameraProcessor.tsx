import React, { useEffect, useRef, useState, useCallback } from 'react';
import { getAverageBrightness, calculateFFT, resampleSignal } from '../utils/math';
import Oscilloscope from './Oscilloscope';
import SpectrumAnalyzer from './SpectrumAnalyzer';

interface DataPoint {
  index: number;
  value: number;
  timestamp: number;
}

interface FrequencyBin {
  frequency: number;
  magnitude: number;
}

// Configuration
const SAMPLE_BOX_SIZE = 4; 
const GRAPH_WINDOW_SECONDS = 5;
// To achieve 0.1Hz resolution, we need a 10 second window (Resolution = 1 / Duration)
const FFT_WINDOW_SECONDS = 10.0;
// 2048 samples in 10 sec = ~204.8Hz sampling rate. 
// Resolution = 0.1Hz. Max Freq (Nyquist) = ~102.4Hz. 
const FFT_SAMPLE_COUNT = 2048; 
const UI_THROTTLE_MS = 16; // ~60fps for UI updates
const DEFAULT_FFT_MAX_Y = 50;
const MIN_FFT_HZ = 5; // Start at 5Hz to ignore DC/LF noise

const RESOLUTIONS = {
  "240p": { width: 320, height: 240 },
  "480p": { width: 640, height: 480 },
  "720p": { width: 1280, height: 720 },
  "1080p": { width: 1920, height: 1080 },
  "4k": { width: 3840, height: 2160 },
};

const CameraProcessor: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Refs for the loop management
  const videoFrameCallbackRef = useRef<number>(0);
  const animationFrameRef = useRef<number>(0);
  
  // Mutable state for high-frequency data (bypass React state for collection)
  const bufferRef = useRef<DataPoint[]>([]); 
  const frameCountRef = useRef<number>(0);
  const lastFpsTimeRef = useRef<number>(0);
  const lastUiUpdateTimeRef = useRef<number>(0);
  
  // React State for UI Rendering
  const [timeSeriesData, setTimeSeriesData] = useState<DataPoint[]>([]);
  const [fftData, setFftData] = useState<FrequencyBin[]>([]);
  const [currentBrightness, setCurrentBrightness] = useState<number>(0);
  const [fps, setFps] = useState<number>(0);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string>('');
  
  // New Features State
  const [fftMaxY, setFftMaxY] = useState<number>(DEFAULT_FFT_MAX_Y);
  const [targetFps, setTargetFps] = useState<number>(240); // Default to high speed
  const [targetResolution, setTargetResolution] = useState<keyof typeof RESOLUTIONS>("480p");
  const [fftMaxFreq, setFftMaxFreq] = useState<number>(60); // User selectable max frequency

  const cleanup = useCallback(() => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (videoFrameCallbackRef.current && videoRef.current && 'cancelVideoFrameCallback' in videoRef.current) {
        (videoRef.current as any).cancelVideoFrameCallback(videoFrameCallbackRef.current);
    }
    if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(t => t.stop());
    }
  }, []);

  const startCamera = useCallback(async () => {
    cleanup(); // Ensure previous streams are closed
    bufferRef.current = []; // Clear buffer on start
    setError('');
    setIsStreaming(false);

    try {
      // Prioritizing frameRate and relaxing height/width constraints helps unlock 60/120fps modes on mobile.
      const resConfig = RESOLUTIONS[targetResolution];
      const constraints = {
        audio: false,
        video: {
          facingMode: 'environment',
          frameRate: { ideal: targetFps, min: 30 }, 
          width: { ideal: resConfig.width }, 
          height: { ideal: resConfig.height },
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().catch(e => console.error("Play error", e));
            setIsStreaming(true);
            
            // Start Data Collection Loop (Synced to Camera)
            if ('requestVideoFrameCallback' in HTMLVideoElement.prototype) {
                videoFrameCallbackRef.current = videoRef.current!.requestVideoFrameCallback(collectDataLoop);
            } else {
                console.warn("Browser does not support requestVideoFrameCallback, falling back to requestAnimationFrame.");
                videoFrameCallbackRef.current = (videoRef.current as any).requestVideoFrameCallback(collectDataLoop);
            }
            
            // Start UI Update Loop (Synced to Screen)
            animationFrameRef.current = requestAnimationFrame(updateUiLoop);
        };
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      setError("Camera access denied or unavailable.");
    }
  }, [targetFps, targetResolution, cleanup]);

  const handleReset = () => {
    setFftMaxY(DEFAULT_FFT_MAX_Y);
    setFftMaxFreq(60);
    setFps(0);
    setCurrentBrightness(0);
    setTimeSeriesData([]);
    setFftData([]);
    bufferRef.current = [];
    startCamera();
  };

  // --- Loop 1: High Speed Data Collection (Camera Sync) ---
  const collectDataLoop = (now: number, metadata: VideoFrameCallbackMetadata) => {
    if (!videoRef.current || !canvasRef.current) return;
    
    // --- Sampling ---
    const video = videoRef.current;
    const ctx = canvasRef.current.getContext('2d', { willReadFrequently: true });
    
    if (ctx && video.readyState >= 2) {
        const cx = Math.floor(video.videoWidth / 2) - (SAMPLE_BOX_SIZE / 2);
        const cy = Math.floor(video.videoHeight / 2) - (SAMPLE_BOX_SIZE / 2);
        
        // Fixed: drawImage takes max 9 arguments (image, sx, sy, sw, sh, dx, dy, dw, dh)
        ctx.drawImage(video, cx, cy, SAMPLE_BOX_SIZE, SAMPLE_BOX_SIZE, 0, 0, SAMPLE_BOX_SIZE, SAMPLE_BOX_SIZE);
        const imageData = ctx.getImageData(0, 0, SAMPLE_BOX_SIZE, SAMPLE_BOX_SIZE);
        const brightness = getAverageBrightness(imageData.data);
        
        // Add to buffer
        const point: DataPoint = {
            index: bufferRef.current.length > 0 ? bufferRef.current[bufferRef.current.length - 1].index + 1 : 0,
            value: brightness,
            timestamp: now
        };
        bufferRef.current.push(point);
        
        // --- FPS Counter logic (in data loop) ---
        frameCountRef.current++;
        if (now - lastFpsTimeRef.current >= 1000) {
            setFps(frameCountRef.current); 
            frameCountRef.current = 0;
            lastFpsTimeRef.current = now;
        }
    }

    // Schedule next frame
    if (videoRef.current) {
        videoFrameCallbackRef.current = videoRef.current.requestVideoFrameCallback(collectDataLoop);
    }
  };

  // --- Loop 2: UI Rendering (Screen Sync) ---
  const updateUiLoop = (now: number) => {
    if (now - lastUiUpdateTimeRef.current >= UI_THROTTLE_MS) {
        processUiUpdates(now);
        lastUiUpdateTimeRef.current = now;
    }
    animationFrameRef.current = requestAnimationFrame(updateUiLoop);
  };

  const processUiUpdates = (now: number) => {
    // 1. Prune Buffer 
    const keepTime = Math.max(GRAPH_WINDOW_SECONDS, FFT_WINDOW_SECONDS) * 1000;
    const cutoff = now - keepTime;
    
    if (bufferRef.current.length > 0 && bufferRef.current[0].timestamp < cutoff - 2000) {
        const findIndex = bufferRef.current.findIndex(p => p.timestamp >= cutoff);
        if (findIndex > 0) {
            bufferRef.current = bufferRef.current.slice(findIndex);
        }
    }

    // 2. Update Current Brightness Display
    const latestPoint = bufferRef.current[bufferRef.current.length - 1];
    if (latestPoint) {
        setCurrentBrightness(latestPoint.value);
    }

    // 3. Update Time Series Graph
    const visibleData = bufferRef.current.filter(p => p.timestamp > now - GRAPH_WINDOW_SECONDS * 1000);
    let displayData = visibleData;
    if (visibleData.length > 500) {
        const step = Math.ceil(visibleData.length / 500);
        displayData = visibleData.filter((_, i) => i % step === 0);
    }
    setTimeSeriesData(displayData);

    // 4. Update FFT
    const fftStartTime = now - FFT_WINDOW_SECONDS * 1000;
    
    // Ensure we have enough data for a meaningful FFT (at least a significant portion of the window)
    if (bufferRef.current.length > 100) {
        const resampledValues = resampleSignal(
            bufferRef.current, 
            fftStartTime, 
            FFT_WINDOW_SECONDS, 
            FFT_SAMPLE_COUNT
        );
        
        const magnitudes = calculateFFT(resampledValues);
        
        // Resolution = 1 / WindowSeconds (e.g., 1 / 10 = 0.1 Hz)
        const frequencyResolution = 1 / FFT_WINDOW_SECONDS;

        const bins: FrequencyBin[] = magnitudes.map((mag, i) => ({
            frequency: i * frequencyResolution, 
            magnitude: mag
        }));
        
        // User Requirement: Start from 5Hz up to Selected Max Frequency
        const relevantBins = bins.filter(b => b.frequency >= MIN_FFT_HZ && b.frequency <= fftMaxFreq);
        
        // Check for max peak to auto-expand Y-axis (Monotonic increase)
        let currentFrameMax = 0;
        for (const bin of relevantBins) {
             if (bin.magnitude > currentFrameMax) currentFrameMax = bin.magnitude;
        }

        setFftMaxY(prevMax => {
            if (currentFrameMax > prevMax) return Math.ceil(currentFrameMax * 1.1); // Add 10% headroom
            return prevMax; // Never decrease
        });

        setFftData(relevantBins);
    }
  };

  useEffect(() => {
    startCamera();
    return cleanup;
  }, [startCamera, cleanup]);

  return (
    // Use h-[100dvh] for mobile browser compatibility and reduce padding on small screens
    <div className="flex flex-col h-[100dvh] bg-gray-950 text-white p-2 md:p-4 gap-2 md:gap-4">
      {/* Top Bar: Stats & Video Preview */}
      {/* Key Fix: h-auto on mobile allows container to expand, preventing overlap */}
      <div className="flex flex-col md:flex-row gap-2 md:gap-4 h-auto md:h-1/3 shrink-0">
        
        {/* Camera Feed Card */}
        <div className="relative bg-black rounded-xl border border-gray-800 overflow-hidden flex-shrink-0 w-full md:w-1/3 lg:w-1/4 aspect-video md:aspect-auto group">
             {!isStreaming && !error && (
                 <div className="absolute inset-0 flex items-center justify-center text-gray-500 animate-pulse text-xs">
                     Initializing...
                 </div>
             )}
             {error && (
                 <div className="absolute inset-0 flex items-center justify-center text-red-500 p-4 text-center text-xs">
                     {error}
                 </div>
             )}
             <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted 
                className="w-full h-full object-cover opacity-80"
             />
             
             {/* Overlay Reticle */}
             <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="relative w-16 h-16 border border-cyan-500/30">
                    <div className="absolute top-1/2 left-1/2 w-1 h-1 bg-red-500 -translate-x-1/2 -translate-y-1/2 shadow-[0_0_10px_rgba(239,68,68,0.8)]"></div>
                    <div className="absolute top-1/2 left-0 w-full h-px bg-cyan-500/50"></div>
                    <div className="absolute left-1/2 top-0 h-full w-px bg-cyan-500/50"></div>
                </div>
             </div>

             <div className="absolute bottom-2 right-2 text-[10px] font-mono bg-black/70 px-2 py-1 rounded text-cyan-400">
                 {videoRef.current?.videoWidth}x{videoRef.current?.videoHeight} @ {fps}Hz
             </div>
        </div>

        {/* Stats & Controls Panel */}
        {/* Use min-h to ensure stats don't get crushed */}
        <div className="flex-grow grid grid-cols-2 gap-2 md:gap-4 relative min-h-[140px]">
             {/* Intensity Card */}
             <div className="bg-gray-900/50 rounded-xl p-2 md:p-4 border border-gray-800 flex flex-col justify-center items-center">
                <span className="text-gray-400 text-[10px] md:text-sm uppercase tracking-widest font-mono mb-1">Intensity</span>
                <span className="text-2xl md:text-4xl font-bold text-white tabular-nums">{currentBrightness.toFixed(0)}</span>
                <div className="w-full h-1.5 md:h-2 bg-gray-800 mt-2 md:mt-4 rounded-full overflow-hidden">
                    <div 
                        className="h-full bg-gradient-to-r from-cyan-500 to-blue-600 transition-all duration-75" 
                        style={{width: `${(currentBrightness / 255) * 100}%`}}
                    ></div>
                </div>
             </div>

             {/* Sample Rate & Controls Card */}
             <div className="bg-gray-900/50 rounded-xl p-2 md:p-4 border border-gray-800 flex flex-col justify-between">
                <div className="flex flex-col items-center justify-center flex-grow">
                    <span className="text-gray-400 text-[10px] md:text-sm uppercase tracking-widest font-mono mb-1">Sampling Rate</span>
                    <span className="text-3xl md:text-5xl font-bold text-green-400 tabular-nums tracking-tighter">{fps}</span>
                    <span className="text-[10px] md:text-xs text-gray-600 font-mono mt-1">Hz (Frames / Sec)</span>
                </div>
                
                {/* Control Footer - Optimized for small spaces */}
                <div className="mt-2 pt-2 border-t border-gray-800 w-full">
                    <div className="grid grid-cols-4 gap-1">
                        <div className="flex flex-col items-center">
                             <label className="text-[8px] text-gray-500 font-mono uppercase mb-0.5">RES</label>
                             <select 
                                value={targetResolution} 
                                onChange={(e) => setTargetResolution(e.target.value as keyof typeof RESOLUTIONS)}
                                className="bg-gray-800 text-[9px] md:text-[10px] text-gray-300 border border-gray-700 rounded px-1 py-0.5 outline-none focus:border-cyan-500 font-mono w-full text-center"
                            >
                                {Object.keys(RESOLUTIONS).map(res => (
                                    <option key={res} value={res}>{res}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex flex-col items-center">
                             <label className="text-[8px] text-gray-500 font-mono uppercase mb-0.5">FPS</label>
                             <select 
                                value={targetFps} 
                                onChange={(e) => setTargetFps(Number(e.target.value))}
                                className="bg-gray-800 text-[9px] md:text-[10px] text-gray-300 border border-gray-700 rounded px-1 py-0.5 outline-none focus:border-cyan-500 font-mono w-full text-center"
                            >
                                <option value="30">30</option>
                                <option value="60">60</option>
                                <option value="120">120</option>
                                <option value="240">MAX</option>
                            </select>
                        </div>
                        <div className="flex flex-col items-center">
                            <label className="text-[8px] text-gray-500 font-mono uppercase mb-0.5">HZ</label>
                             <select 
                                value={fftMaxFreq} 
                                onChange={(e) => setFftMaxFreq(Number(e.target.value))}
                                className="bg-gray-800 text-[9px] md:text-[10px] text-gray-300 border border-gray-700 rounded px-1 py-0.5 outline-none focus:border-fuchsia-500 font-mono w-full text-center"
                            >
                                <option value="20">20</option>
                                <option value="40">40</option>
                                <option value="60">60</option>
                            </select>
                        </div>
                        <div className="flex flex-col items-center justify-end">
                            {/* Spacer to align with labels */}
                            <div className="h-[13px] mb-0.5"></div> 
                             <button 
                                onClick={handleReset}
                                className="w-full flex items-center justify-center bg-red-900/20 hover:bg-red-900/40 border border-red-900/50 text-red-400 text-[9px] rounded py-1 transition-colors font-mono uppercase"
                            >
                                RST
                            </button>
                        </div>
                    </div>
                </div>
             </div>
        </div>

        <canvas ref={canvasRef} width={SAMPLE_BOX_SIZE} height={SAMPLE_BOX_SIZE} className="hidden" />
      </div>

      {/* Charts Area */}
      <div className="flex-grow flex flex-col gap-2 md:gap-4 min-h-0">
        <div className="h-1/2 min-h-0">
            <Oscilloscope data={timeSeriesData} fps={fps} />
        </div>
        <div className="h-1/2 min-h-0">
            <SpectrumAnalyzer 
                data={fftData} 
                maxFrequency={fftMaxFreq} 
                maxY={fftMaxY}
            />
        </div>
      </div>
    </div>
  );
};

export default CameraProcessor;