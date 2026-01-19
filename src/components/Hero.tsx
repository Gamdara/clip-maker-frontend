import { Zap } from 'lucide-react';

export const Hero = () => {
  return (
    <div className="text-center space-y-6 py-12 animate-fadeIn">
      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-card/50 border border-border">
        <Zap className="w-4 h-4 text-primary" />
        <span className="text-sm text-muted-foreground">Powered by AI</span>
      </div>

      <h1 className="text-5xl md:text-7xl font-bold leading-tight">
        Generate Captions <br />
        <span className="text-gradient">In Seconds</span>
      </h1>

      <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
        Upload any video or paste a YouTube link. Our AI will transcribe and
        generate accurate captions you can download instantly.
      </p>
    </div>
  );
};
