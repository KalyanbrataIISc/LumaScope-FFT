import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip
} from 'recharts';

interface DataPoint {
  index: number;
  value: number;
  timestamp: number;
}

interface OscilloscopeProps {
  data: DataPoint[];
  fps: number;
}

const Oscilloscope: React.FC<OscilloscopeProps> = ({ data, fps }) => {
  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex justify-between items-center mb-2 px-2">
        <h3 className="text-cyan-400 font-mono text-sm uppercase tracking-wider">Time Domain (Brightness)</h3>
        <span className="text-xs text-gray-500 font-mono">Live Feed • ~{fps} FPS</span>
      </div>
      <div className="flex-grow bg-gray-900/50 rounded-lg border border-gray-800 overflow-hidden relative">
        <div className="absolute inset-0">
            <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                {/* 
                    Using 'dataMin' and 'dataMax' allows the chart to slide smoothly 
                    with the window of data provided by the parent.
                */}
                <XAxis 
                    dataKey="timestamp" 
                    type="number" 
                    domain={['dataMin', 'dataMax']} 
                    hide={true} 
                    interval="preserveStartEnd"
                />
                <YAxis 
                    domain={[0, 255]} 
                    stroke="#4b5563" 
                    tick={{fill: '#4b5563', fontSize: 10, fontFamily: 'monospace'}}
                    width={30}
                />
                <Tooltip 
                    contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', color: '#f3f4f6' }}
                    itemStyle={{ color: '#22d3ee' }}
                    formatter={(value: number) => [value.toFixed(1), 'Luma']}
                    labelFormatter={() => ''}
                    isAnimationActive={false}
                />
                <Line 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#22d3ee" 
                    strokeWidth={2} 
                    dot={false} 
                    isAnimationActive={false} 
                />
            </LineChart>
            </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default Oscilloscope;