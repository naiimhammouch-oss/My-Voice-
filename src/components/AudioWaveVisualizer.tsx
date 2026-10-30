import React, { useEffect, useRef } from 'react';

interface AudioWaveVisualizerProps {
  analyser?: AnalyserNode | null;
  isPlaying?: boolean;
  isRecording?: boolean;
  barColor?: string;
  glowColor?: string;
  height?: number;
  barCount?: number;
}

export const AudioWaveVisualizer: React.FC<AudioWaveVisualizerProps> = ({
  analyser,
  isPlaying = false,
  isRecording = false,
  barColor = '#06b6d4',
  glowColor = '#3b82f6',
  height = 70,
  barCount = 48,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameId = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let bufferLength = analyser ? analyser.frequencyBinCount : barCount;
    let dataArray = analyser ? new Uint8Array(bufferLength) : new Uint8Array(barCount);

    let phase = 0;

    const render = () => {
      const width = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, width, h);

      if (analyser && (isPlaying || isRecording)) {
        analyser.getByteFrequencyData(dataArray);
      } else {
        // Idle ambient gentle breathing wave
        phase += 0.04;
      }

      const barWidth = (width / barCount) - 2;

      for (let i = 0; i < barCount; i++) {
        let value = 0;
        if (analyser && (isPlaying || isRecording)) {
          // Sample from frequency spectrum
          const binIndex = Math.floor((i / barCount) * (bufferLength / 2));
          value = dataArray[binIndex] || 0;
          // Soften extreme low/highs
          value = Math.min(255, value * 1.1);
        } else {
          // Ambient breathing motion
          const wave1 = Math.sin(phase + (i * 0.25));
          const wave2 = Math.cos(phase * 0.7 + (i * 0.15));
          const norm = (wave1 + wave2 + 2) / 4;
          value = 18 + norm * 26;
        }

        const barHeight = Math.max(4, (value / 255) * (h - 8));
        const x = i * (barWidth + 2);
        const y = (h - barHeight) / 2;

        // Gradient for bars
        const grad = ctx.createLinearGradient(0, y, 0, y + barHeight);
        if (isRecording) {
          grad.addColorStop(0, '#f43f5e'); // crimson red pulse
          grad.addColorStop(1, '#fb7185');
        } else if (isPlaying) {
          grad.addColorStop(0, '#06b6d4'); // cyan
          grad.addColorStop(0.5, '#3b82f6'); // blue
          grad.addColorStop(1, '#8b5cf6'); // violet
        } else {
          grad.addColorStop(0, '#334155');
          grad.addColorStop(1, '#1e293b');
        }

        ctx.fillStyle = grad;
        // Rounded bar caps
        ctx.beginPath();
        const radius = Math.min(barWidth / 2, barHeight / 2);
        ctx.roundRect(x, y, Math.max(1, barWidth), barHeight, radius);
        ctx.fill();
      }

      animationFrameId.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [analyser, isPlaying, isRecording, barCount, barColor, glowColor]);

  return (
    <div className="relative w-full overflow-hidden rounded-xl bg-slate-950/70 p-2 border border-slate-800/80 shadow-inner">
      <canvas
        ref={canvasRef}
        width={600}
        height={height}
        className="w-full h-full block"
      />
      {/* Studio grid overlay line */}
      <div className="absolute inset-x-0 top-1/2 h-[1px] bg-cyan-500/10 pointer-events-none" />
    </div>
  );
};
