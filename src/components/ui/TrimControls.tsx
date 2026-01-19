import { Scissors, RotateCcw } from 'lucide-react';
import { Button } from './Button';

interface TrimControlsProps {
  startTime: number;
  endTime: number;
  duration: number;
  onStartChange: (time: number) => void;
  onEndChange: (time: number) => void;
}

const formatTimeInput = (seconds: number): string => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
};

const parseTimeInput = (timeStr: string): number => {
  const parts = timeStr.split(':');
  let hours = 0, minutes = 0, seconds = 0;

  if (parts.length === 3) {
    hours = parseFloat(parts[0] || '0');
    minutes = parseFloat(parts[1] || '0');
    seconds = parseFloat(parts[2] || '0');
  } else if (parts.length === 2) {
    minutes = parseFloat(parts[0] || '0');
    seconds = parseFloat(parts[1] || '0');
  } else {
    seconds = parseFloat(parts[0] || '0');
  }

  return hours * 3600 + minutes * 60 + seconds;
};

export const TrimControls = ({
  startTime,
  endTime,
  duration,
  onStartChange,
  onEndChange
}: TrimControlsProps) => {
  const clipDuration = endTime - startTime;

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-4">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <Scissors className="w-4 h-4 text-primary" />
        Trim Points
      </h3>

      {/* Start Time */}
      <div>
        <label className="text-xs text-muted-foreground mb-1.5 block">Start Time</label>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={formatTimeInput(startTime)}
            onChange={(e) => {
              const time = parseTimeInput(e.target.value);
              if (!isNaN(time) && time >= 0 && time < endTime) {
                onStartChange(time);
              }
            }}
            className="flex-1 h-9 px-3 bg-secondary/50 border border-border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition-all"
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onStartChange(0)}
            title="Reset to start"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* End Time */}
      <div>
        <label className="text-xs text-muted-foreground mb-1.5 block">End Time</label>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={formatTimeInput(endTime)}
            onChange={(e) => {
              const time = parseTimeInput(e.target.value);
              if (!isNaN(time) && time > startTime && time <= duration) {
                onEndChange(time);
              }
            }}
            className="flex-1 h-9 px-3 bg-secondary/50 border border-border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition-all"
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEndChange(duration)}
            title="Reset to end"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Clip Duration */}
      <div className="pt-3 border-t border-border">
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Clip Duration</span>
          <span className="font-mono text-primary font-medium">
            {formatTimeInput(clipDuration)}
          </span>
        </div>
        <div className="flex justify-between items-center mt-1">
          <span className="text-xs text-muted-foreground">Original Duration</span>
          <span className="font-mono text-xs text-muted-foreground">
            {formatTimeInput(duration)}
          </span>
        </div>
      </div>
    </div>
  );
};
