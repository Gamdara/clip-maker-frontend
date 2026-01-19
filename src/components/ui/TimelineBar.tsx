import { useState, useRef, useEffect, useCallback } from 'react';

interface TimelineBarProps {
  duration: number;
  startTime: number;
  endTime: number;
  currentTime: number;
  onStartChange: (time: number) => void;
  onEndChange: (time: number) => void;
  onSeek: (time: number) => void;
}

const formatTime = (seconds: number): string => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const TimelineBar = ({
  duration,
  startTime,
  endTime,
  currentTime,
  onStartChange,
  onEndChange,
  onSeek
}: TimelineBarProps) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<'start' | 'end' | 'playhead' | null>(null);

  const startPercent = (startTime / duration) * 100;
  const endPercent = (endTime / duration) * 100;
  const currentPercent = (currentTime / duration) * 100;

  const getTimeFromPosition = useCallback((clientX: number): number => {
    if (!trackRef.current) return 0;
    const rect = trackRef.current.getBoundingClientRect();
    const percent = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    return (percent / 100) * duration;
  }, [duration]);

  const handleMouseDown = (type: 'start' | 'end' | 'playhead') => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(type);
  };

  const handleTrackClick = (e: React.MouseEvent) => {
    if (dragging) return;
    const time = getTimeFromPosition(e.clientX);
    onSeek(Math.max(startTime, Math.min(endTime, time)));
  };

  useEffect(() => {
    if (!dragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const time = getTimeFromPosition(e.clientX);

      if (dragging === 'start') {
        // Start cannot go past end - 1 second
        onStartChange(Math.max(0, Math.min(time, endTime - 1)));
      } else if (dragging === 'end') {
        // End cannot go before start + 1 second
        onEndChange(Math.min(duration, Math.max(time, startTime + 1)));
      } else if (dragging === 'playhead') {
        onSeek(Math.max(startTime, Math.min(endTime, time)));
      }
    };

    const handleMouseUp = () => {
      setDragging(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, duration, startTime, endTime, getTimeFromPosition, onStartChange, onEndChange, onSeek]);

  const clipDuration = endTime - startTime;

  return (
    <div className="mt-6 px-2">
      {/* Time labels */}
      <div className="flex justify-between text-xs text-muted-foreground mb-2">
        <span>{formatTime(startTime)}</span>
        <span className="text-primary font-medium">{formatTime(clipDuration)} selected</span>
        <span>{formatTime(duration)}</span>
      </div>

      {/* Timeline track */}
      <div
        ref={trackRef}
        className="relative h-14 bg-secondary/50 rounded-xl cursor-pointer overflow-hidden border border-border"
        onClick={handleTrackClick}
      >
        {/* Inactive region left (dimmed) */}
        <div
          className="absolute inset-y-0 left-0 bg-black/40"
          style={{ width: `${startPercent}%` }}
        />

        {/* Inactive region right (dimmed) */}
        <div
          className="absolute inset-y-0 right-0 bg-black/40"
          style={{ width: `${100 - endPercent}%` }}
        />

        {/* Active region highlight */}
        <div
          className="absolute inset-y-0 bg-primary/10 border-y-2 border-primary/50"
          style={{ left: `${startPercent}%`, width: `${endPercent - startPercent}%` }}
        />

        {/* Start handle (green) */}
        <div
          className="absolute top-0 bottom-0 w-3 bg-green-500 cursor-ew-resize flex items-center justify-center hover:bg-green-400 transition-colors z-20 rounded-l"
          style={{ left: `calc(${startPercent}% - 6px)` }}
          onMouseDown={handleMouseDown('start')}
        >
          <div className="w-0.5 h-8 bg-white/80 rounded" />
        </div>

        {/* End handle (red) */}
        <div
          className="absolute top-0 bottom-0 w-3 bg-red-500 cursor-ew-resize flex items-center justify-center hover:bg-red-400 transition-colors z-20 rounded-r"
          style={{ left: `calc(${endPercent}% - 6px)` }}
          onMouseDown={handleMouseDown('end')}
        >
          <div className="w-0.5 h-8 bg-white/80 rounded" />
        </div>

        {/* Playhead (white line) */}
        <div
          className="absolute top-0 bottom-0 w-1 bg-white cursor-ew-resize z-30 shadow-lg"
          style={{ left: `calc(${currentPercent}% - 2px)` }}
          onMouseDown={handleMouseDown('playhead')}
        >
          {/* Playhead top indicator */}
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-white rounded-full shadow-md" />
        </div>
      </div>

      {/* Instructions */}
      <div className="flex justify-center gap-6 mt-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded bg-green-500" />
          Drag to set start
        </span>
        <span className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded bg-red-500" />
          Drag to set end
        </span>
        <span className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded bg-white border border-border" />
          Current position
        </span>
      </div>
    </div>
  );
};
