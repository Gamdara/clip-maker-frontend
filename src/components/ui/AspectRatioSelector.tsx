import { Monitor, Smartphone, Square, RectangleVertical, Crop } from 'lucide-react';
import type { AspectRatio } from '../../types/api';

interface AspectRatioSelectorProps {
  selected: AspectRatio;
  onChange: (ratio: AspectRatio) => void;
}

const ASPECT_RATIOS = [
  { id: 'original' as const, label: 'Original', icon: Monitor },
  { id: '9:16' as const, label: '9:16', sublabel: 'TikTok/Reels', icon: Smartphone },
  { id: '16:9' as const, label: '16:9', sublabel: 'YouTube', icon: Monitor },
  { id: '1:1' as const, label: '1:1', sublabel: 'Instagram', icon: Square },
  { id: '4:5' as const, label: '4:5', sublabel: 'IG Post', icon: RectangleVertical },
];

export const AspectRatioSelector = ({ selected, onChange }: AspectRatioSelectorProps) => {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <Crop className="w-4 h-4 text-primary" />
        Aspect Ratio
      </h3>
      <div className="grid grid-cols-3 gap-2">
        {ASPECT_RATIOS.map(ratio => (
          <button
            key={ratio.id}
            onClick={() => onChange(ratio.id)}
            className={`flex flex-col items-center p-3 rounded-lg border transition-all ${
              selected === ratio.id
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border hover:border-primary/50 text-foreground'
            }`}
          >
            <ratio.icon className="w-5 h-5 mb-1.5" />
            <span className="text-xs font-medium">{ratio.label}</span>
            {ratio.sublabel && (
              <span className="text-[10px] text-muted-foreground">{ratio.sublabel}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};
