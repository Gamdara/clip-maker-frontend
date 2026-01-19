import { useState } from 'react';
import { Upload, Link as LinkIcon } from 'lucide-react';
import { Button } from './ui/Button';

interface UploadZoneProps {
  onFileSelect: (file: File) => void;
  onUrlSubmit: (url: string) => void;
  isLoading?: boolean;
}

export const UploadZone = ({ onFileSelect, onUrlSubmit, isLoading }: UploadZoneProps) => {
  const [mode, setMode] = useState<'file' | 'url'>('file');
  const [url, setUrl] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('video/')) {
      onFileSelect(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onUrlSubmit(url.trim());
      setUrl('');
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6 animate-scaleIn">
      {/* Mode Toggle */}
      <div className="flex items-center justify-center gap-3">
        <Button
          variant={mode === 'file' ? 'hero' : 'heroOutline'}
          size="default"
          onClick={() => setMode('file')}
          className="gap-2"
        >
          <Upload className="w-4 h-4" />
          Upload File
        </Button>
        <Button
          variant={mode === 'url' ? 'hero' : 'heroOutline'}
          size="default"
          onClick={() => setMode('url')}
          className="gap-2"
        >
          <LinkIcon className="w-4 h-4" />
          YouTube URL
        </Button>
      </div>

      {mode === 'file' ? (
        <label
          htmlFor="file-upload"
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`bg-gradient-surface border-2 border-dashed rounded-2xl p-12 text-center transition-all min-h-[280px] flex flex-col justify-center cursor-pointer ${
            isDragging
              ? 'border-primary bg-primary/5 shadow-glow'
              : 'border-border hover:border-primary hover:shadow-glow'
          } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <Upload className={`w-12 h-12 mx-auto mb-4 ${isDragging ? 'text-primary' : 'text-coral-400'}`} />
          <h3 className="text-xl font-semibold mb-2">
            Drag & drop your video here
          </h3>
          <p className="text-muted-foreground mb-6">
            Supports MP4, MOV, AVI, MKV up to 500MB
          </p>

          <div className="flex items-center justify-center rounded-xl font-medium transition-all duration-200 bg-gradient-primary text-white shadow-glow hover:opacity-90 hover:shadow-lg h-12 px-8 text-base mx-auto">
            Browse Files
          </div>
          <input
            id="file-upload"
            type="file"
            accept="video/*"
            onChange={handleFileChange}
            className="hidden"
            disabled={isLoading}
          />
        </label>
      ) : (
        <div className="border-2 border-dashed border-border rounded-2xl p-12 min-h-[280px] flex flex-col justify-center">
          <form onSubmit={handleUrlSubmit} className="space-y-4">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://youtube.com/watch?v=..."
              className="w-full h-12 px-4 bg-secondary/50 border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition-all"
              disabled={isLoading}
            />
            <Button
              type="submit"
              variant="hero"
              size="lg"
              className="w-full"
              isLoading={isLoading}
              disabled={!url.trim() || isLoading}
            >
              Generate Captions
            </Button>
          </form>
        </div>
      )}
    </div>
  );
};
