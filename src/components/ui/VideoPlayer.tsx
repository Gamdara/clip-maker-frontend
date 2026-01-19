import { forwardRef } from 'react';

interface VideoPlayerProps {
  src: string;
  className?: string;
}

export const VideoPlayer = forwardRef<HTMLVideoElement, VideoPlayerProps>(
  ({ src, className = '' }, ref) => {
    return (
      <div className="relative w-full rounded-2xl overflow-hidden border-2 border-border shadow-elevated bg-card">
        <video
          ref={ref}
          src={src}
          controls
          className={`w-full h-auto ${className}`}
          controlsList="nodownload"
          style={{ maxHeight: '70vh' }}
        >
          Your browser does not support the video tag.
        </video>
      </div>
    );
  }
);

VideoPlayer.displayName = 'VideoPlayer';
