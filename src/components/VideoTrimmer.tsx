import { useState, useRef, useEffect } from 'react';
import { Button } from './ui/Button';
import { TimelineBar } from './ui/TimelineBar';
import { AspectRatioSelector } from './ui/AspectRatioSelector';
import { TrimControls } from './ui/TrimControls';
import { ArrowLeft, Play, Pause, Check } from 'lucide-react';
import type { VideoMetadata, TrimCropSettings, AspectRatio, CropConfig } from '../types/api';
import { getPreviewUploadUrl } from '../api/client';

interface VideoTrimmerProps {
  metadata: VideoMetadata;
  url: string;
  jobId?: string; // For uploaded files
  onConfirm: (settings: TrimCropSettings) => void;
  onCancel: () => void;
}

// Calculate crop config based on aspect ratio
const calculateCropForRatio = (
  ratio: AspectRatio,
  videoWidth: number,
  videoHeight: number
): CropConfig | null => {
  if (ratio === 'original') return null;

  const ratios: Record<string, [number, number]> = {
    '9:16': [9, 16],
    '16:9': [16, 9],
    '1:1': [1, 1],
    '4:5': [4, 5],
  };

  const [rw, rh] = ratios[ratio] || [videoWidth, videoHeight];
  const targetRatio = rw / rh;
  const currentRatio = videoWidth / videoHeight;

  let cropWidth: number, cropHeight: number;

  if (targetRatio > currentRatio) {
    // Width-limited
    cropWidth = videoWidth;
    cropHeight = videoWidth / targetRatio;
  } else {
    // Height-limited
    cropHeight = videoHeight;
    cropWidth = videoHeight * targetRatio;
  }

  return {
    x: (videoWidth - cropWidth) / 2,
    y: (videoHeight - cropHeight) / 2,
    width: cropWidth,
    height: cropHeight,
    sourceWidth: videoWidth,
    sourceHeight: videoHeight,
  };
};

export const VideoTrimmer = ({
  metadata,
  url,
  jobId,
  onConfirm,
  onCancel
}: VideoTrimmerProps) => {
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(metadata.duration);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('original');
  const [cropConfig, setCropConfig] = useState<CropConfig | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const isYouTube = metadata.source_type === 'youtube';

  // Update crop when aspect ratio changes
  useEffect(() => {
    const newCrop = calculateCropForRatio(aspectRatio, metadata.width, metadata.height);
    setCropConfig(newCrop);
  }, [aspectRatio, metadata.width, metadata.height]);

  // Handle video time update for uploaded files
  useEffect(() => {
    if (!videoRef.current || isYouTube) return;

    const video = videoRef.current;
    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);

      // Stop at end time
      if (video.currentTime >= endTime) {
        video.pause();
        setIsPlaying(false);
        video.currentTime = startTime;
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => video.removeEventListener('timeupdate', handleTimeUpdate);
  }, [isYouTube, startTime, endTime]);

  const handlePlayPause = () => {
    if (isYouTube) {
      // For YouTube, we can't control playback easily
      setIsPlaying(!isPlaying);
      return;
    }

    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
    } else {
      if (videoRef.current.currentTime < startTime || videoRef.current.currentTime >= endTime) {
        videoRef.current.currentTime = startTime;
      }
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (time: number) => {
    setCurrentTime(time);
    if (videoRef.current && !isYouTube) {
      videoRef.current.currentTime = time;
    }
  };

  const handleConfirm = () => {
    onConfirm({
      startTime,
      endTime,
      crop: cropConfig,
    });
  };

  // Calculate crop overlay dimensions for preview
  const getCropOverlayStyle = () => {
    if (!cropConfig) return null;

    const cropX = (cropConfig.x / metadata.width) * 100;
    const cropY = (cropConfig.y / metadata.height) * 100;
    const cropW = (cropConfig.width / metadata.width) * 100;
    const cropH = (cropConfig.height / metadata.height) * 100;

    return {
      left: `${cropX}%`,
      top: `${cropY}%`,
      width: `${cropW}%`,
      height: `${cropH}%`,
    };
  };

  const cropOverlayStyle = getCropOverlayStyle();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="glass-blur fixed top-0 left-0 right-0 z-50 border-b border-border/50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            <div className="h-6 w-px bg-border" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-primary" />
              <span className="text-xl font-bold">Trim & Crop</span>
            </div>
          </div>
          <Button
            variant="hero"
            size="default"
            onClick={handleConfirm}
            className="gap-2"
          >
            <Check className="w-4 h-4" />
            Continue
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 pt-24 pb-8 px-6">
        <div className="max-w-6xl mx-auto">
          {/* Title */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold mb-1 truncate max-w-2xl mx-auto">
              {metadata.title}
            </h1>
            <p className="text-sm text-muted-foreground">
              {metadata.width}x{metadata.height} • {Math.floor(metadata.duration / 60)}:{Math.floor(metadata.duration % 60).toString().padStart(2, '0')}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Video Preview */}
            <div className="lg:col-span-3">
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                {/* Video Container */}
                <div className="relative aspect-video bg-black">
                  {isYouTube ? (
                    // YouTube Embed
                    <iframe
                      ref={iframeRef}
                      src={`${metadata.embed_url}?enablejsapi=1&start=${Math.floor(startTime)}`}
                      className="absolute inset-0 w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    // HTML5 Video for uploads
                    <video
                      ref={videoRef}
                      src={jobId ? getPreviewUploadUrl(jobId) : url}
                      className="absolute inset-0 w-full h-full object-contain"
                      controls={false}
                    />
                  )}

                  {/* Crop Overlay */}
                  {cropOverlayStyle && (
                    <div className="absolute inset-0 pointer-events-none">
                      {/* Darkened areas outside crop */}
                      <svg className="absolute inset-0 w-full h-full">
                        <defs>
                          <mask id="crop-mask">
                            <rect width="100%" height="100%" fill="white" />
                            <rect
                              x={cropOverlayStyle.left}
                              y={cropOverlayStyle.top}
                              width={cropOverlayStyle.width}
                              height={cropOverlayStyle.height}
                              fill="black"
                            />
                          </mask>
                        </defs>
                        <rect
                          width="100%"
                          height="100%"
                          fill="rgba(0,0,0,0.6)"
                          mask="url(#crop-mask)"
                        />
                      </svg>

                      {/* Crop border */}
                      <div
                        className="absolute border-2 border-white/80"
                        style={cropOverlayStyle}
                      >
                        {/* Rule of thirds grid */}
                        <div className="absolute inset-0">
                          <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/20" />
                          <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/20" />
                          <div className="absolute top-1/3 left-0 right-0 h-px bg-white/20" />
                          <div className="absolute top-2/3 left-0 right-0 h-px bg-white/20" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Play/Pause Button (for uploads only) */}
                {!isYouTube && (
                  <div className="p-4 border-t border-border flex justify-center">
                    <Button
                      variant="heroOutline"
                      size="sm"
                      onClick={handlePlayPause}
                      className="gap-2"
                    >
                      {isPlaying ? (
                        <>
                          <Pause className="w-4 h-4" />
                          Pause
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4" />
                          Preview Clip
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>

              {/* Timeline */}
              <TimelineBar
                duration={metadata.duration}
                startTime={startTime}
                endTime={endTime}
                currentTime={currentTime}
                onStartChange={setStartTime}
                onEndChange={setEndTime}
                onSeek={handleSeek}
              />
            </div>

            {/* Controls Panel */}
            <div className="space-y-4">
              <AspectRatioSelector
                selected={aspectRatio}
                onChange={setAspectRatio}
              />
              <TrimControls
                startTime={startTime}
                endTime={endTime}
                duration={metadata.duration}
                onStartChange={setStartTime}
                onEndChange={setEndTime}
              />

              {/* Crop Info */}
              {cropConfig && (
                <div className="bg-card border border-border rounded-xl p-4">
                  <h3 className="text-sm font-semibold mb-2">Crop Preview</h3>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div className="flex justify-between">
                      <span>Output Size</span>
                      <span className="font-mono">
                        {Math.round(cropConfig.width)}x{Math.round(cropConfig.height)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Aspect Ratio</span>
                      <span className="font-mono">{aspectRatio}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
