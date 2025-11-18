import React, { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  ReferenceDot,
  Label
} from 'recharts';

interface FrequencyBin {
  frequency: number;
  magnitude: number;
}

interface SpectrumAnalyzerProps {
  data: FrequencyBin[];
  maxFrequency: number; 
  maxY: number;
}

const SpectrumAnalyzer: React.FC<SpectrumAnalyzerProps> = ({ data, maxFrequency, maxY }) => {
  
  // Calculate the peak frequency bin for the current frame
  const peakPoint = useMemo(() => {
    if (!data || data.length === 0) return null;
    // Find the bin with maximum magnitude
    return data.reduce((max, current) => 
        current.magnitude > max.magnitude ? current : max
    , data[0]);
  }, [data]);

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex justify-between items-center mb-2 px-2">
        <h3 className="text-fuchsia-400 font-mono text-sm uppercase tracking-wider">Frequency Domain (FFT)</h3>
        <div className="flex gap-4 text-xs text-gray-500 font-mono">
            <span>Range: 5-{maxFrequency}Hz</span>
            <span>Peak Scale: {maxY.toFixed(0)}</span>
        </div>
      </div>
      <div className="flex-grow bg-gray-900/50 rounded-lg border border-gray-800 overflow-hidden relative">
        <div className="absolute inset-0">
            <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis 
                    dataKey="frequency" 
                    type="number" 
                    stroke="#4b5563"
                    tick={{fill: '#4b5563', fontSize: 10, fontFamily: 'monospace'}}
                    tickFormatter={(val) => Number(val).toFixed(1)}
                    domain={[5, maxFrequency]} 
                    allowDataOverflow={true}
                    unit="Hz"
                    minTickGap={20}
                />
                <YAxis 
                    hide={false} 
                    stroke="#4b5563"
                    tick={{fill: '#4b5563', fontSize: 10, fontFamily: 'monospace'}}
                    width={30}
                    domain={[0, maxY]}
                    allowDataOverflow={true}
                />
                <Tooltip 
                    contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', color: '#f3f4f6' }}
                    itemStyle={{ color: '#e879f9' }}
                    formatter={(value: number) => [value.toFixed(2), 'Mag']}
                    labelFormatter={(label: number) => `${Number(label).toFixed(1)} Hz`}
                    isAnimationActive={false}
                />
                <Area 
                    type="monotone" 
                    dataKey="magnitude" 
                    stroke="#e879f9" 
                    fill="#e879f9" 
                    fillOpacity={0.2}
                    isAnimationActive={false}
                />
                {peakPoint && peakPoint.magnitude > 1 && (
                    <ReferenceDot
                        x={peakPoint.frequency}
                        y={peakPoint.magnitude}
                        r={3}
                        fill="#ffffff"
                        stroke="none"
                        // Fixed: Removed invalid 'isFront' prop that caused type errors
                    >
                        <Label
                            value={`${peakPoint.frequency.toFixed(1)} Hz`}
                            position="top"
                            offset={10}
                            fill="#ffffff"
                            fontSize={10}
                            fontFamily="monospace"
                            fontWeight="bold"
                            style={{ 
                                textShadow: '0px 1px 2px rgba(0,0,0,0.8)',
                                backgroundColor: 'rgba(0,0,0,0.5)' 
                            }}
                        />
                    </ReferenceDot>
                )}
            </AreaChart>
            </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default SpectrumAnalyzer;