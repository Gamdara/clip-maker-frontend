import { Download, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Button } from './ui/Button';
import { VideoPlayer } from './ui/VideoPlayer';
import type { JobStatusResponse } from '../types/api';

interface VideoPreviewProps {
  status: JobStatusResponse;
  videoUrl: string;
  onDownload: () => void;
  onProcessAnother: () => void;
}

export const VideoPreview = ({
  status,
  videoUrl,
  onDownload,
  onProcessAnother,
}: VideoPreviewProps) => {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header with back button */}
      <header className="glass-blur fixed top-0 left-0 right-0 z-50 border-b border-border/50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-primary" />
            <span className="text-xl font-bold">CaptionAI</span>
          </div>
          <Button
            variant="ghost"
            size="default"
            onClick={onProcessAnother}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Process Another
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 pt-24 pb-20 px-6">
        <div className="max-w-5xl mx-auto space-y-8 animate-fadeIn">
          {/* Success Message */}
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 border-2 border-primary animate-scaleIn">
              <CheckCircle2 className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold">
              Your Video is <span className="text-gradient">Ready!</span>
            </h1>
            <p className="text-lg text-muted-foreground">
              Preview your captioned video below or download it to your device
            </p>
          </div>

          {/* Video Player */}
          <div className="animate-scaleIn">
            <VideoPlayer src={videoUrl} />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              variant="hero"
              size="xl"
              onClick={onDownload}
              className="gap-2 w-full sm:w-auto"
            >
              <Download className="w-5 h-5" />
              Download Video
            </Button>
            <Button
              variant="heroOutline"
              size="xl"
              onClick={onProcessAnother}
              className="gap-2 w-full sm:w-auto"
            >
              <ArrowLeft className="w-5 h-5" />
              Process Another Video
            </Button>
          </div>

          {/* Video Info */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
              <div>
                <div className="text-sm text-muted-foreground mb-1">Job ID</div>
                <div className="font-mono text-sm">{status.job_id}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Completed At</div>
                <div className="text-sm">
                  {status.completed_at
                    ? new Date(status.completed_at).toLocaleString()
                    : 'N/A'}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Status</div>
                <div className="text-sm text-primary font-semibold">COMPLETED</div>
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
};
