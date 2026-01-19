import { useEffect, useRef, useState, useCallback } from 'react';

// YouTube IFrame API types
declare global {
  interface Window {
    YT: {
      Player: new (
        elementId: string,
        config: {
          videoId: string;
          playerVars?: Record<string, number | string>;
          events?: {
            onReady?: (event: { target: YTPlayer }) => void;
            onStateChange?: (event: { data: number; target: YTPlayer }) => void;
          };
        }
      ) => YTPlayer;
      PlayerState: {
        UNSTARTED: number;
        ENDED: number;
        PLAYING: number;
        PAUSED: number;
        BUFFERING: number;
        CUED: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

interface YTPlayer {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  destroy: () => void;
  mute: () => void;
  unMute: () => void;
  isMuted: () => boolean;
  setVolume: (volume: number) => void;
  getVolume: () => number;
}

interface UseYouTubePlayerOptions {
  videoId: string;
  startTime?: number;
  endTime?: number;
  onTimeUpdate?: (time: number) => void;
  onReady?: () => void;
}

// Load YouTube IFrame API script
let apiLoadPromise: Promise<void> | null = null;

const loadYouTubeAPI = (): Promise<void> => {
  if (apiLoadPromise) return apiLoadPromise;

  apiLoadPromise = new Promise((resolve) => {
    // Check if already loaded
    if (window.YT && window.YT.Player) {
      resolve();
      return;
    }

    // Set callback before loading script
    window.onYouTubeIframeAPIReady = () => {
      resolve();
    };

    // Load script
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    document.body.appendChild(script);
  });

  return apiLoadPromise;
};

export const useYouTubePlayer = ({
  videoId,
  startTime = 0,
  endTime,
  onTimeUpdate,
  onReady,
}: UseYouTubePlayerOptions) => {
  const playerRef = useRef<YTPlayer | null>(null);
  const containerIdRef = useRef(`yt-player-${Math.random().toString(36).slice(2)}`);
  const timeUpdateIntervalRef = useRef<number | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  // Store bounds in ref to avoid recreating player on every change
  const boundsRef = useRef({ startTime, endTime });
  boundsRef.current = { startTime, endTime };

  // Initialize player
  useEffect(() => {
    let mounted = true;

    const initPlayer = async () => {
      await loadYouTubeAPI();

      if (!mounted) return;

      // Destroy existing player
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }

      // Create new player
      playerRef.current = new window.YT.Player(containerIdRef.current, {
        videoId,
        playerVars: {
          controls: 0, // Hide YouTube controls, use custom
          disablekb: 1, // Disable keyboard
          modestbranding: 1,
          rel: 0, // Don't show related videos at end
          fs: 0, // Disable fullscreen button
          playsinline: 1,
          showinfo: 0,
        },
        events: {
          onReady: (event) => {
            if (!mounted) return;
            setIsReady(true);
            // Seek to start time
            event.target.seekTo(boundsRef.current.startTime, true);
            onReady?.();
          },
          onStateChange: (event) => {
            if (!mounted) return;

            const playing = event.data === window.YT.PlayerState.PLAYING;
            setIsPlaying(playing);

            if (playing) {
              // Start time update interval
              timeUpdateIntervalRef.current = window.setInterval(() => {
                if (!playerRef.current) return;

                const time = playerRef.current.getCurrentTime();
                setCurrentTime(time);
                onTimeUpdate?.(time);

                // Check bounds
                const { startTime: start, endTime: end } = boundsRef.current;
                if (end !== undefined && time >= end) {
                  playerRef.current.pauseVideo();
                  playerRef.current.seekTo(start, true);
                }
              }, 100);
            } else {
              // Clear interval when paused
              if (timeUpdateIntervalRef.current) {
                clearInterval(timeUpdateIntervalRef.current);
                timeUpdateIntervalRef.current = null;
              }
            }
          },
        },
      });
    };

    initPlayer();

    return () => {
      mounted = false;
      if (timeUpdateIntervalRef.current) {
        clearInterval(timeUpdateIntervalRef.current);
      }
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [videoId]); // Only reinitialize on videoId change

  // Play within bounds
  const play = useCallback(() => {
    if (!playerRef.current || !isReady) return;

    const current = playerRef.current.getCurrentTime();
    const { startTime: start, endTime: end } = boundsRef.current;

    // If outside bounds, seek to start first
    if (current < start || (end !== undefined && current >= end)) {
      playerRef.current.seekTo(start, true);
    }

    playerRef.current.playVideo();
  }, [isReady]);

  // Pause
  const pause = useCallback(() => {
    if (!playerRef.current || !isReady) return;
    playerRef.current.pauseVideo();
  }, [isReady]);

  // Toggle play/pause
  const togglePlay = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  // Seek to specific time
  const seekTo = useCallback((time: number) => {
    if (!playerRef.current || !isReady) return;

    const { startTime: start, endTime: end } = boundsRef.current;

    // Clamp to bounds
    let targetTime = time;
    if (targetTime < start) targetTime = start;
    if (end !== undefined && targetTime > end) targetTime = end;

    playerRef.current.seekTo(targetTime, true);
    setCurrentTime(targetTime);
    onTimeUpdate?.(targetTime);
  }, [isReady, onTimeUpdate]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (!playerRef.current || !isReady) return;

    try {
      // Check if muted by getting volume
      const isMuted = playerRef.current.isMuted?.() ?? false;
      if (isMuted) {
        playerRef.current.unMute();
      } else {
        playerRef.current.mute();
      }
    } catch {
      // Fallback if isMuted doesn't exist
      playerRef.current.mute();
    }
  }, [isReady]);

  // Set volume (0-100)
  const setVolume = useCallback((volume: number) => {
    if (!playerRef.current || !isReady) return;
    playerRef.current.setVolume(Math.max(0, Math.min(100, volume)));
    // Unmute if setting volume > 0
    if (volume > 0) {
      playerRef.current.unMute();
    }
  }, [isReady]);

  // Get current volume
  const getVolume = useCallback(() => {
    if (!playerRef.current || !isReady) return 100;
    return playerRef.current.getVolume();
  }, [isReady]);

  return {
    containerId: containerIdRef.current,
    isReady,
    isPlaying,
    currentTime,
    play,
    pause,
    togglePlay,
    seekTo,
    toggleMute,
    setVolume,
    getVolume,
  };
};
