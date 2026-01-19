import { useState, useEffect } from 'react';
import { Button } from './ui/Button';
import { Save, Plus, Trash2, ChevronDown, ChevronUp, AlertTriangle, X, RotateCcw } from 'lucide-react';
import type { Caption } from '../types/api';

// Bad words list (same as backend)
const BAD_WORDS = new Set([
  "fuck", "fucking", "fucked", "fucker", "fucks",
  "shit", "shitting", "shitty",
  "bitch", "bitches", "bitching",
  "ass", "asshole", "asses",
  "damn", "damned", "dammit",
  "hell",
  "crap",
  "dick", "dicks",
  "cock", "cocks",
  "pussy", "pussies",
  "bastard", "bastards",
  "slut", "sluts",
  "whore", "whores",
  "cunt", "cunts",
]);

type CensorMode = 'none' | 'full' | 'first' | 'first_last' | 'vowels';

interface CaptionEditorProps {
  jobId: string;
  onSave: (captions: Caption[]) => void;
  onSkip: () => void;
  isLoading?: boolean;
}

// Find all bad words in captions
const findBadWords = (captions: Caption[]): string[] => {
  const found: Set<string> = new Set();
  captions.forEach(caption => {
    caption.text.split(/\s+/).forEach(word => {
      const base = word.replace(/[.,!?;:]/g, '').toLowerCase();
      if (BAD_WORDS.has(base)) {
        found.add(base);
      }
    });
  });
  return Array.from(found);
};

// Censor a single word based on mode
const censorWord = (word: string, mode: CensorMode): string => {
  // Extract trailing punctuation
  let punct = '';
  let base = word;
  while (base && /[.,!?;:]/.test(base[base.length - 1])) {
    punct = base[base.length - 1] + punct;
    base = base.slice(0, -1);
  }

  const baseLower = base.toLowerCase();
  if (!BAD_WORDS.has(baseLower)) return word;

  if (mode === 'none') return word;

  if (mode === 'full') {
    // Full censor: ****
    return '*'.repeat(base.length) + punct;
  }

  if (mode === 'first') {
    // Keep first letter: f***
    if (base.length <= 1) return '*' + punct;
    return base[0] + '*'.repeat(base.length - 1) + punct;
  }

  if (mode === 'first_last') {
    // Keep first and last: f**k
    if (base.length <= 2) return base[0] + '*' + punct;
    return base[0] + '*'.repeat(base.length - 2) + base[base.length - 1] + punct;
  }

  if (mode === 'vowels') {
    // Replace vowels only: f*ck
    const vowels = new Set(['a', 'e', 'i', 'o', 'u', 'A', 'E', 'I', 'O', 'U']);
    const censored = base.split('').map(c => vowels.has(c) ? '*' : c).join('');
    return censored + punct;
  }

  return word;
};

// Apply censor to all captions
const applyCensor = (captions: Caption[], mode: CensorMode): Caption[] => {
  return captions.map(caption => ({
    ...caption,
    text: caption.text.split(/\s+/).map(word => censorWord(word, mode)).join(' ')
  }));
};

export const CaptionEditor = ({ jobId, onSave, onSkip: _onSkip, isLoading }: CaptionEditorProps) => {
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [originalCaptions, setOriginalCaptions] = useState<Caption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [badWordsFound, setBadWordsFound] = useState<string[]>([]);
  const [showBadWordModal, setShowBadWordModal] = useState(false);
  const [showRevertModal, setShowRevertModal] = useState(false);

  // Fetch captions on mount
  useEffect(() => {
    const fetchCaptions = async () => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/captions/${jobId}`
        );
        if (!response.ok) throw new Error('Failed to fetch captions');
        const data = await response.json();
        setCaptions(data.captions);
        setOriginalCaptions(JSON.parse(JSON.stringify(data.captions))); // Deep copy for revert

        // Check for bad words
        const found = findBadWords(data.captions);
        setBadWordsFound(found);
        if (found.length > 0) {
          setShowBadWordModal(true);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load captions');
      } finally {
        setLoading(false);
      }
    };

    fetchCaptions();
  }, [jobId]);

  // Format timestamp for display (seconds → HH:MM:SS.mmm)
  const formatTime = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  };

  // Parse timestamp input (HH:MM:SS.mmm → seconds)
  const parseTime = (timeStr: string): number => {
    const parts = timeStr.split(':');
    if (parts.length !== 3) return 0;

    const hours = parseFloat(parts[0] || '0');
    const minutes = parseFloat(parts[1] || '0');
    const seconds = parseFloat(parts[2] || '0');

    return hours * 3600 + minutes * 60 + seconds;
  };

  // Update caption text
  const updateText = (index: number, text: string) => {
    const updated = [...captions];
    updated[index].text = text;
    setCaptions(updated);
  };

  // Update caption start time
  const updateStart = (index: number, timeStr: string) => {
    const seconds = parseTime(timeStr);
    const updated = [...captions];
    updated[index].start = seconds;
    setCaptions(updated);
  };

  // Update caption end time
  const updateEnd = (index: number, timeStr: string) => {
    const seconds = parseTime(timeStr);
    const updated = [...captions];
    updated[index].end = seconds;
    setCaptions(updated);
  };

  // Delete caption
  const deleteCaption = (index: number) => {
    setCaptions(captions.filter((_, i) => i !== index));
  };

  // Add new caption
  const addCaption = () => {
    const lastCaption = captions[captions.length - 1];
    const newStart = lastCaption ? lastCaption.end : 0;
    const newEnd = newStart + 2.0;

    setCaptions([
      ...captions,
      { text: 'New caption', start: newStart, end: newEnd }
    ]);
  };

  // Toggle expand/collapse
  const toggleExpand = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  // Handle censor mode selection
  const handleCensorSelect = (mode: CensorMode) => {
    const censored = applyCensor(captions, mode);
    setCaptions(censored);
    setShowBadWordModal(false);
    setBadWordsFound([]);
  };

  // Handle revert changes
  const handleRevertChanges = () => {
    setCaptions(JSON.parse(JSON.stringify(originalCaptions)));
    setShowRevertModal(false);
    // Re-check for bad words after revert
    const found = findBadWords(originalCaptions);
    setBadWordsFound(found);
    if (found.length > 0) {
      setShowBadWordModal(true);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading captions...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Bad Word Modal */}
      {showBadWordModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl max-w-md w-full p-6 animate-fadeIn">
            <div className="flex items-start gap-4 mb-4">
              <div className="p-3 rounded-full bg-yellow-500/10">
                <AlertTriangle className="w-6 h-6 text-yellow-500" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-foreground mb-1">Bad Words Detected</h3>
                <p className="text-sm text-muted-foreground">
                  Found {badWordsFound.length} bad word{badWordsFound.length > 1 ? 's' : ''}: {badWordsFound.map(w => `"${w}"`).join(', ')}
                </p>
              </div>
              <button
                onClick={() => setShowBadWordModal(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-muted-foreground mb-4">
              Choose how you want to censor these words:
            </p>

            <div className="space-y-2">
              <button
                onClick={() => handleCensorSelect('full')}
                className="w-full p-3 text-left bg-secondary/50 hover:bg-secondary border border-border rounded-xl transition-colors"
              >
                <div className="font-medium text-foreground">Full Censor</div>
                <div className="text-sm text-muted-foreground">fuck → ****</div>
              </button>

              <button
                onClick={() => handleCensorSelect('first')}
                className="w-full p-3 text-left bg-secondary/50 hover:bg-secondary border border-border rounded-xl transition-colors"
              >
                <div className="font-medium text-foreground">Keep First Letter</div>
                <div className="text-sm text-muted-foreground">fuck → f***</div>
              </button>

              <button
                onClick={() => handleCensorSelect('first_last')}
                className="w-full p-3 text-left bg-secondary/50 hover:bg-secondary border border-border rounded-xl transition-colors"
              >
                <div className="font-medium text-foreground">Keep First & Last</div>
                <div className="text-sm text-muted-foreground">fuck → f**k</div>
              </button>

              <button
                onClick={() => handleCensorSelect('vowels')}
                className="w-full p-3 text-left bg-secondary/50 hover:bg-secondary border border-border rounded-xl transition-colors"
              >
                <div className="font-medium text-foreground">Censor Vowels Only</div>
                <div className="text-sm text-muted-foreground">fuck → f*ck</div>
              </button>

              <button
                onClick={() => handleCensorSelect('none')}
                className="w-full p-3 text-left bg-secondary/50 hover:bg-secondary border border-border rounded-xl transition-colors"
              >
                <div className="font-medium text-foreground">No Censor</div>
                <div className="text-sm text-muted-foreground">Keep original text</div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revert Confirmation Modal */}
      {showRevertModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl max-w-md w-full p-6 animate-fadeIn">
            <div className="flex items-start gap-4 mb-4">
              <div className="p-3 rounded-full bg-yellow-500/10">
                <AlertTriangle className="w-6 h-6 text-yellow-500" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-foreground mb-1">Revert All Changes?</h3>
                <p className="text-sm text-muted-foreground">
                  This will discard all your edits and restore the original captions from transcription.
                </p>
              </div>
              <button
                onClick={() => setShowRevertModal(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                variant="heroOutline"
                size="default"
                onClick={() => setShowRevertModal(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="hero"
                size="default"
                onClick={handleRevertChanges}
                className="flex-1 gap-2 bg-yellow-600 hover:bg-yellow-700"
              >
                <RotateCcw className="w-4 h-4" />
                Revert Changes
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="glass-blur fixed top-0 left-0 right-0 z-50 border-b border-border/50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-primary" />
            <span className="text-xl font-bold">Caption Editor</span>
          </div>
          <div className="flex gap-3">
            <Button
              variant="heroOutline"
              size="default"
              onClick={() => setShowRevertModal(true)}
              disabled={isLoading}
              className="gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Revert Changes
            </Button>
            <Button
              variant="hero"
              size="default"
              onClick={() => onSave(captions)}
              disabled={isLoading}
              className="gap-2"
            >
              <Save className="w-4 h-4" />
              Save & Render
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 pt-24 pb-20 px-6">
        <div className="max-w-5xl mx-auto space-y-6 animate-fadeIn">
          {/* Title Section */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold">
              Edit Your <span className="text-gradient">Captions</span>
            </h1>
            <p className="text-muted-foreground">
              {captions.length} segments • Review and edit before rendering
            </p>
          </div>

          {/* Add Caption Button */}
          <div className="flex justify-end">
            <Button
              variant="heroOutline"
              size="sm"
              onClick={addCaption}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Caption
            </Button>
          </div>

          {/* Caption List */}
          <div className="space-y-3">
            {captions.map((caption, index) => (
              <div
                key={index}
                className="bg-card border border-border rounded-xl overflow-hidden transition-all hover:border-primary/50"
              >
                {/* Compact View */}
                <div
                  className="p-4 flex items-center gap-4 cursor-pointer"
                  onClick={() => toggleExpand(index)}
                >
                  <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold">
                    {index + 1}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-primary font-mono mb-1">
                      {formatTime(caption.start)} → {formatTime(caption.end)}
                    </div>
                    <div className="text-foreground truncate">
                      {caption.text}
                    </div>
                  </div>

                  <div className="flex-shrink-0 flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteCaption(index);
                      }}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    {expandedIndex === index ? (
                      <ChevronUp className="w-5 h-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                </div>

                {/* Expanded Edit View */}
                {expandedIndex === index && (
                  <div className="px-4 pb-4 space-y-4 border-t border-border pt-4">
                    {/* Text Editor */}
                    <div>
                      <label className="text-sm text-muted-foreground mb-2 block">
                        Caption Text
                      </label>
                      <textarea
                        value={caption.text}
                        onChange={(e) => updateText(index, e.target.value)}
                        className="w-full min-h-[80px] px-4 py-3 bg-secondary/50 border border-border rounded-xl text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition-all"
                        placeholder="Enter caption text..."
                      />
                    </div>

                    {/* Timestamp Editors */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm text-muted-foreground mb-2 block">
                          Start Time (HH:MM:SS.mmm)
                        </label>
                        <input
                          type="text"
                          value={formatTime(caption.start)}
                          onChange={(e) => updateStart(index, e.target.value)}
                          className="w-full h-10 px-4 bg-secondary/50 border border-border rounded-xl text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition-all"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-muted-foreground mb-2 block">
                          End Time (HH:MM:SS.mmm)
                        </label>
                        <input
                          type="text"
                          value={formatTime(caption.end)}
                          onChange={(e) => updateEnd(index, e.target.value)}
                          className="w-full h-10 px-4 bg-secondary/50 border border-border rounded-xl text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition-all"
                        />
                      </div>
                    </div>

                    {/* Duration Display */}
                    <div className="text-sm text-muted-foreground">
                      Duration: {(caption.end - caption.start).toFixed(2)}s
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Empty State */}
          {captions.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">No captions yet</p>
              <Button onClick={addCaption} variant="hero">
                <Plus className="w-4 h-4 mr-2" />
                Add First Caption
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
