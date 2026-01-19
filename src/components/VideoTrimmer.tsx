import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from './ui/Button';
import { TimelineBar } from './ui/TimelineBar';
import { AspectRatioSelector } from './ui/AspectRatioSelector';
import { TrimControls } from './ui/TrimControls';
import { ArrowLeft, Check, Play, Pause, Volume2, VolumeX, Maximize } from 'lucide-react';
import type { VideoMetadata, TrimCropSettings, AspectRatio, CropConfig } from '../types/api';
import { getPreviewUploadUrl } from '../api/client';
import { useYouTubePlayer } from '../hooks/useYouTubePlayer';

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
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('original');
  const [cropConfig, setCropConfig] = useState<CropConfig | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(100);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [isDraggingCrop, setIsDraggingCrop] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number; cropX: number; cropY: number } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const cropOverlayRef = useRef<HTMLDivElement>(null);

  const isYouTube = metadata.source_type === 'youtube';

  // YouTube player hook
  const youtubePlayer = useYouTubePlayer({
    videoId: metadata.video_id || '',
    startTime,
    endTime,
    onTimeUpdate: (time) => {
      if (isYouTube) {
        setCurrentTime(time);
      }
    },
  });

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

      // Stop at end time and loop back to start
      if (video.currentTime >= endTime) {
        video.pause();
        video.currentTime = startTime;
      }

      // If somehow before start time, seek to start
      if (video.currentTime < startTime && !video.paused) {
        video.currentTime = startTime;
      }
    };

    const handlePlay = () => {
      // When user clicks play, ensure we're within bounds
      if (video.currentTime < startTime || video.currentTime >= endTime) {
        video.currentTime = startTime;
      }
    };

    const handleSeeked = () => {
      setCurrentTime(video.currentTime);
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('play', handlePlay);
    video.addEventListener('seeked', handleSeeked);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('seeked', handleSeeked);
    };
  }, [isYouTube, startTime, endTime]);

  // Sync timeline seek with video
  const handleSeek = useCallback((time: number) => {
    setCurrentTime(time);
    if (isYouTube) {
      youtubePlayer.seekTo(time);
    } else if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  }, [isYouTube, youtubePlayer]);

  const handleConfirm = () => {
    onConfirm({
      startTime,
      endTime,
      crop: cropConfig,
    });
  };

  // Toggle fullscreen
  const handleFullscreen = async () => {
    if (!videoContainerRef.current) return;

    try {
      if (!document.fullscreenElement) {
        await videoContainerRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error('Fullscreen error:', err);
    }
  };

  // Toggle mute
  const handleToggleMute = () => {
    if (isYouTube) {
      youtubePlayer.toggleMute();
      setIsMuted(!isMuted);
    } else if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
    }
  };

  // Handle volume change
  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
    if (isYouTube) {
      youtubePlayer.setVolume(newVolume);
    } else if (videoRef.current) {
      videoRef.current.volume = newVolume / 100;
      videoRef.current.muted = newVolume === 0;
    }
  };

  // Handle progress bar click
  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current) return;

    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;

    // Calculate time within trim range
    const newTime = startTime + (percentage * trimDuration);
    handleSeek(Math.max(startTime, Math.min(endTime, newTime)));
  };

  // Handle crop drag start
  const handleCropDragStart = (e: React.MouseEvent) => {
    if (!cropConfig || !cropOverlayRef.current) return;
    e.preventDefault();

    setIsDraggingCrop(true);
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      cropX: cropConfig.x,
      cropY: cropConfig.y,
    });
  };

  // Handle crop drag move
  useEffect(() => {
    if (!isDraggingCrop || !dragStart || !cropConfig || !videoContainerRef.current) return;

    const handleMouseMove = (e: MouseEvent) => {
      const container = videoContainerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();

      // Calculate movement in pixels relative to container
      const deltaX = e.clientX - dragStart.x;
      const deltaY = e.clientY - dragStart.y;

      // Convert pixel movement to video coordinates
      const scaleX = metadata.width / rect.width;
      const scaleY = metadata.height / rect.height;

      let newX = dragStart.cropX + (deltaX * scaleX);
      let newY = dragStart.cropY + (deltaY * scaleY);

      // Clamp to video bounds
      newX = Math.max(0, Math.min(metadata.width - cropConfig.width, newX));
      newY = Math.max(0, Math.min(metadata.height - cropConfig.height, newY));

      setCropConfig({
        ...cropConfig,
        x: newX,
        y: newY,
      });
    };

    const handleMouseUp = () => {
      setIsDraggingCrop(false);
      setDragStart(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingCrop, dragStart, cropConfig, metadata.width, metadata.height]);

  // Toggle play/pause
  const handleTogglePlay = () => {
    if (isYouTube) {
      youtubePlayer.togglePlay();
    } else if (videoRef.current) {
      if (videoRef.current.paused) {
        if (videoRef.current.currentTime < startTime || videoRef.current.currentTime >= endTime) {
          videoRef.current.currentTime = startTime;
        }
        videoRef.current.play();
      } else {
        videoRef.current.pause();
      }
    }
  };

  // Track if upload video is playing
  const [isUploadPlaying, setIsUploadPlaying] = useState(false);
  useEffect(() => {
    if (!videoRef.current || isYouTube) return;
    const video = videoRef.current;

    const onPlay = () => setIsUploadPlaying(true);
    const onPause = () => setIsUploadPlaying(false);

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);

    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
    };
  }, [isYouTube]);

  const isPlaying = isYouTube ? youtubePlayer.isPlaying : isUploadPlaying;

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

  // Progress within trim range for display
  const trimDuration = endTime - startTime;
  const progressInTrim = Math.max(0, Math.min(1, (currentTime - startTime) / trimDuration));

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
                <div ref={videoContainerRef} className="relative bg-black aspect-video">
                  {isYouTube ? (
                    // YouTube IFrame API player
                    <div
                      id={youtubePlayer.containerId}
                      className="absolute inset-0 w-full h-full"
                    />
                  ) : (
                    // HTML5 Video for uploads
                    <video
                      ref={videoRef}
                      src={jobId ? getPreviewUploadUrl(jobId) : url}
                      className="absolute inset-0 w-full h-full object-contain"
                    />
                  )}

                  {/* Click overlay for play/pause when no crop */}
                  {!cropOverlayStyle && (
                    <div
                      className="absolute inset-0 cursor-pointer z-10"
                      onClick={handleTogglePlay}
                      style={{ bottom: '80px' }} // Leave space for controls
                    />
                  )}

                  {/* Crop Overlay */}
                  {cropOverlayStyle && (
                    <div className="absolute inset-0">
                      {/* Dark overlay with mask - clickable for play/pause */}
                      <svg
                        className="absolute inset-0 w-full h-full cursor-pointer"
                        onClick={handleTogglePlay}
                        style={{ pointerEvents: 'auto' }}
                      >
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
                      {/* Draggable crop box */}
                      <div
                        ref={cropOverlayRef}
                        className={`absolute border-2 border-white/80 ${
                          isDraggingCrop ? 'cursor-grabbing' : 'cursor-grab'
                        }`}
                        style={cropOverlayStyle}
                        onMouseDown={handleCropDragStart}
                      >
                        {/* Rule of thirds grid */}
                        <div className="absolute inset-0 pointer-events-none">
                          <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/20" />
                          <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/20" />
                          <div className="absolute top-1/3 left-0 right-0 h-px bg-white/20" />
                          <div className="absolute top-2/3 left-0 right-0 h-px bg-white/20" />
                        </div>
                        {/* Move icon in center */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="w-8 h-8 rounded-full bg-black/50 flex items-center justify-center">
                            <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20" />
                            </svg>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Control Bar at bottom */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 pt-8">
                    {/* Progress bar - clickable */}
                    <div
                      ref={progressBarRef}
                      className="mb-3 cursor-pointer group"
                      onClick={handleProgressClick}
                    >
                      <div className="h-1 group-hover:h-2 bg-white/30 rounded-full overflow-hidden transition-all">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${progressInTrim * 100}%` }}
                        />
                      </div>
                    </div>

                    {/* Controls */}
                    <div className="flex items-center gap-4">
                      {/* Play/Pause */}
                      <button
                        onClick={handleTogglePlay}
                        className="text-white hover:text-primary transition-colors"
                        disabled={isYouTube && !youtubePlayer.isReady}
                      >
                        {isPlaying ? (
                          <Pause className="w-6 h-6" />
                        ) : (
                          <Play className="w-6 h-6" />
                        )}
                      </button>

                      {/* Volume with slider */}
                      <div
                        className="relative flex items-center"
                        onMouseEnter={() => setShowVolumeSlider(true)}
                        onMouseLeave={() => setShowVolumeSlider(false)}
                      >
                        <button
                          onClick={handleToggleMute}
                          className="text-white hover:text-primary transition-colors"
                        >
                          {isMuted || volume === 0 ? (
                            <VolumeX className="w-5 h-5" />
                          ) : (
                            <Volume2 className="w-5 h-5" />
                          )}
                        </button>

                        {/* Volume slider */}
                        <div
                          className={`ml-2 overflow-hidden transition-all duration-200 ${
                            showVolumeSlider ? 'w-20 opacity-100' : 'w-0 opacity-0'
                          }`}
                        >
                          <div className="relative w-full h-4 flex items-center">
                            {/* Background track */}
                            <div className="absolute w-full h-1 bg-white/30 rounded-full" />
                            {/* Filled track */}
                            <div
                              className="absolute h-1 bg-primary rounded-full"
                              style={{ width: `${isMuted ? 0 : volume}%` }}
                            />
                            {/* Input slider */}
                            <input
                              type="range"
                              min="0"
                              max="100"
                              value={isMuted ? 0 : volume}
                              onChange={(e) => handleVolumeChange(Number(e.target.value))}
                              className="absolute w-full h-1 appearance-none cursor-pointer bg-transparent
                                [&::-webkit-slider-thumb]:appearance-none
                                [&::-webkit-slider-thumb]:w-3
                                [&::-webkit-slider-thumb]:h-3
                                [&::-webkit-slider-thumb]:rounded-full
                                [&::-webkit-slider-thumb]:bg-white
                                [&::-webkit-slider-thumb]:hover:bg-primary
                                [&::-webkit-slider-thumb]:transition-colors
                                [&::-webkit-slider-thumb]:shadow-md"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Time display */}
                      <span className="text-white text-sm font-mono">
                        {formatTime(currentTime)} / {formatTime(metadata.duration)}
                      </span>

                      {/* Spacer */}
                      <div className="flex-1" />

                      {/* Fullscreen */}
                      <button
                        onClick={handleFullscreen}
                        className="text-white hover:text-primary transition-colors"
                      >
                        <Maximize className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Trim Range Indicator */}
                <div className="px-4 py-2 bg-muted/30 border-t border-border text-xs text-muted-foreground flex items-center justify-between">
                  <span>
                    Trim: {formatTime(startTime)} - {formatTime(endTime)}
                  </span>
                  <span>
                    Duration: {formatTime(endTime - startTime)}
                  </span>
                </div>
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

              {/* Tips */}
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                <h3 className="text-sm font-semibold mb-2 text-primary">Tips</h3>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• Drag handles on timeline to set trim range</li>
                  <li>• Video will loop within the selected range</li>
                  <li>• Select aspect ratio to see crop preview</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

// Helper function to format time as MM:SS
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
