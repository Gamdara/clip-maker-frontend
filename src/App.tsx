import { useState, useEffect } from 'react';
import { Hero } from './components/Hero';
import { UploadZone } from './components/UploadZone';
import { ProcessingView } from './components/ProcessingView';
import { VideoPreview } from './components/VideoPreview';
import { CaptionEditor } from './components/CaptionEditor';
import { VideoTrimmer } from './components/VideoTrimmer';
import { useJobStatusWebSocket } from './hooks/useJobStatusWebSocket';
import { processUrl, extractMetadata, uploadVideoForPreview } from './api/client';
import { Target, Globe, Film } from 'lucide-react';
import { JobStatus, type Caption, type VideoMetadata, type TrimCropSettings } from './types/api';

function App() {
  const [jobId, setJobId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'upload' | 'trimming' | 'processing' | 'editing' | 'preview'>('upload');
  const [videoMetadata, setVideoMetadata] = useState<VideoMetadata | null>(null);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const { status } = useJobStatusWebSocket(jobId);

  // Watch for completion and transition to preview
  useEffect(() => {
    if (!status) return;

    if (status.status === JobStatus.COMPLETED) {
      setViewMode('preview');
    } else if (status.status === JobStatus.EDITING) {
      setViewMode('editing');
    } else if (viewMode !== 'trimming' && viewMode !== 'upload') {
      // Keep in processing mode for other states (pending, downloading, transcribing, rendering)
      setViewMode('processing');
    }
  }, [status, viewMode]);

  const handleCaptionSave = async (captions: Caption[]) => {
    if (!jobId) return;

    try {
      setLoading(true);
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/captions/${jobId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(captions)
        }
      );

      if (!response.ok) {
        throw new Error('Failed to save captions');
      }

      // Auto-transition back to processing view (rendering will start)
      setViewMode('processing');
    } catch (err) {
      console.error('Failed to save captions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSkipEditing = async () => {
    if (!jobId) return;

    try {
      setLoading(true);
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/captions/${jobId}/skip`,
        { method: 'POST' }
      );

      if (!response.ok) {
        throw new Error('Failed to skip editing');
      }

      // Auto-transition back to processing view (rendering will start)
      setViewMode('processing');
    } catch (err) {
      console.error('Failed to skip editing:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    setLoading(true);
    try {
      // Upload file for preview and get metadata
      const result = await uploadVideoForPreview(file);
      setJobId(result.job_id);
      setVideoMetadata(result.metadata);
      setPendingUrl(null);
      setViewMode('trimming');
    } catch (err) {
      console.error('Upload failed:', err);
      setViewMode('upload');
    } finally {
      setLoading(false);
    }
  };

  const handleUrlSubmit = async (url: string) => {
    setLoading(true);
    try {
      // Extract metadata first without downloading
      const metadata = await extractMetadata(url);
      setVideoMetadata(metadata);
      setPendingUrl(url);
      setJobId(null);
      setViewMode('trimming');
    } catch (err) {
      console.error('Metadata extraction failed:', err);
      setViewMode('upload');
    } finally {
      setLoading(false);
    }
  };

  const handleTrimConfirm = async (settings: TrimCropSettings) => {
    setLoading(true);
    setViewMode('processing');
    try {
      if (pendingUrl) {
        // YouTube URL - process with trim/crop settings
        const result = await processUrl(pendingUrl, settings);
        setJobId(result.job_id);
      } else if (jobId) {
        // File upload - already uploaded, start processing with settings
        const response = await fetch(
          `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/process-upload/${jobId}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              start_time: settings.startTime,
              end_time: settings.endTime,
              crop: settings.crop ? {
                x: Math.round(settings.crop.x),
                y: Math.round(settings.crop.y),
                width: Math.round(settings.crop.width),
                height: Math.round(settings.crop.height),
                source_width: settings.crop.sourceWidth,
                source_height: settings.crop.sourceHeight,
              } : null
            })
          }
        );
        if (!response.ok) {
          throw new Error('Failed to start processing');
        }
      }
    } catch (err) {
      console.error('Processing failed:', err);
      setViewMode('upload');
    } finally {
      setLoading(false);
      setPendingUrl(null);
      setVideoMetadata(null);
    }
  };

  const handleTrimCancel = () => {
    setViewMode('upload');
    setPendingUrl(null);
    setVideoMetadata(null);
    setJobId(null);
  };

  const handleDownload = () => {
    if (jobId) {
      const link = document.createElement('a');
      link.href = `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/download/${jobId}`;
      link.download = `captioned_${jobId}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleProcessAnother = () => {
    setJobId(null);
    setViewMode('upload');
  };

  // Show video trimmer when trimming
  if (viewMode === 'trimming' && videoMetadata) {
    return (
      <VideoTrimmer
        metadata={videoMetadata}
        url={pendingUrl || ''}
        jobId={jobId || undefined}
        onConfirm={handleTrimConfirm}
        onCancel={handleTrimCancel}
      />
    );
  }

  // Show caption editor when editing
  if (viewMode === 'editing' && jobId) {
    return (
      <CaptionEditor
        jobId={jobId}
        onSave={handleCaptionSave}
        onSkip={handleSkipEditing}
        isLoading={loading}
      />
    );
  }

  // Show preview when complete
  if (viewMode === 'preview' && status && jobId) {
    const videoUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/preview/${jobId}`;
    return (
      <VideoPreview
        status={status}
        videoUrl={videoUrl}
        onDownload={handleDownload}
        onProcessAnother={handleProcessAnother}
      />
    );
  }

  // Show processing view while processing
  if (viewMode === 'processing' && status) {
    return <ProcessingView status={status} onDownload={handleDownload} />;
  }

  // Show hero + upload zone
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="glass-blur fixed top-0 left-0 right-0 z-50 border-b border-border/50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-primary" />
            <span className="text-xl font-bold">CaptionAI</span>
          </div>
          <nav className="hidden md:flex gap-8">
            <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition">Features</a>
            <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition">How it Works</a>
            <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition">Pricing</a>
          </nav>
          <button className="px-4 py-2 rounded-lg bg-gradient-primary text-white text-sm font-medium hover:opacity-90 transition">
            Get Started
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 pt-24 pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          <Hero />

          <div className="mt-12">
            <UploadZone
              onFileSelect={handleFileUpload}
              onUrlSubmit={handleUrlSubmit}
              isLoading={loading}
            />
          </div>

          {/* Stats Section */}
          <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="flex items-center justify-center gap-4">
              <Target className="w-8 h-8 text-primary flex-shrink-0" />
              <div className="text-left">
                <div className="text-4xl font-bold text-gradient">99%</div>
                <div className="text-sm text-muted-foreground">Accuracy Rate</div>
              </div>
            </div>
            <div className="flex items-center justify-center gap-4">
              <Globe className="w-8 h-8 text-primary flex-shrink-0" />
              <div className="text-left">
                <div className="text-4xl font-bold text-gradient">100+</div>
                <div className="text-sm text-muted-foreground">Languages Supported</div>
              </div>
            </div>
            <div className="flex items-center justify-center gap-4">
              <Film className="w-8 h-8 text-primary flex-shrink-0" />
              <div className="text-left">
                <div className="text-4xl font-bold text-gradient">2M+</div>
                <div className="text-sm text-muted-foreground">Videos Processed</div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-gradient-primary" />
            <span className="font-bold">CaptionAI</span>
          </div>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <a href="#" className="hover:text-foreground transition">Privacy</a>
            <a href="#" className="hover:text-foreground transition">Terms</a>
            <a href="#" className="hover:text-foreground transition">Contact</a>
          </div>
          <div className="text-sm text-muted-foreground">
            © 2024 CaptionAI. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
