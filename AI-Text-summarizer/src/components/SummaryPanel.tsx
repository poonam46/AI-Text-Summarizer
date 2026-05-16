import React, { useState } from 'react';
import { ThumbsUp, ThumbsDown, Copy, Check, Loader2, Zap } from 'lucide-react';
import { summarizeText } from '../services/gemini';
import { db, auth, collection, addDoc, serverTimestamp } from '../lib/firebase';

interface SummaryPanelProps {
  content: string;
  docId: string;
  onSummaryGenerated?: (summary: string) => void;
}

export default function SummaryPanel({ content, docId, onSummaryGenerated }: SummaryPanelProps) {
  const [summary, setSummary] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [rated, setRated] = useState<'up' | 'down' | null>(null);

  const length = 'short';

  const calculateStats = (text: string) => {
    const words = text.trim().split(/\s+/).length;
    const readingTime = Math.ceil(words / 200);
    return { words, readingTime };
  };

  const originalStats = calculateStats(content);
  const summaryStats = summary ? calculateStats(summary) : null;
  const compressionRatio = summaryStats ? Math.round((1 - summaryStats.words / originalStats.words) * 100) : null;

  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);
    setRated(null);
    try {
      const result = await summarizeText(content, length);
      setSummary(result);
      if (onSummaryGenerated) onSummaryGenerated(result);
      
      // Save to Firestore
      if (auth.currentUser) {
        await addDoc(collection(db, 'summaries'), {
          docId,
          userId: auth.currentUser.uid,
          length,
          text: result,
          createdAt: serverTimestamp()
        });
      }
    } catch (error: any) {
      console.error('Summarization error:', error);
      if (error?.status === 'RESOURCE_EXHAUSTED' || error?.message?.includes('429')) {
        setError("API Quota exceeded. Please wait a moment or try again tomorrow.");
      } else {
        setError("Failed to generate summary. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (summary) {
      navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRate = async (rating: 'up' | 'down') => {
    if (!summary || rated || !auth.currentUser) return;
    setRated(rating);
    try {
      await addDoc(collection(db, 'feedback'), {
        userId: auth.currentUser.uid,
        targetType: 'summary',
        targetId: docId, // Simplified for now
        rating,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Feedback error:', error);
    }
  };

  return (
    <div className="glass-morphism rounded-[32px] p-8 shadow-sm">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center border border-emerald-500/20">
            <Zap className="w-5 h-5 text-emerald-400" />
          </div>
          <h2 className="text-[24px] font-display font-bold text-white">Short Summary</h2>
        </div>
      </div>

      {!summary && !isLoading ? (
        <div className="flex flex-col items-center justify-center py-12 border border-dashed border-white/10 rounded-[24px] bg-white/[0.02]">
          <div className="flex items-center gap-8 mb-8">
            <div className="text-center">
              <p className="text-[11px] font-bold uppercase tracking-widest text-white/20 mb-1">Original</p>
              <p className="text-[20px] font-display font-bold text-white">{originalStats.words} words</p>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="text-center">
              <p className="text-[11px] font-bold uppercase tracking-widest text-white/20 mb-1">Read Time</p>
              <p className="text-[20px] font-display font-bold text-white">{originalStats.readingTime} min</p>
            </div>
          </div>
          <p className="text-white/40 mb-6 font-medium">Select length and generate summary</p>
          <button
            onClick={handleGenerate}
            className="bg-white text-black px-8 py-3 rounded-full font-bold hover:scale-105 transition-all"
          >
            Generate Summary
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/20 mb-1">Words</p>
              <p className="text-[18px] font-display font-bold text-white">{summaryStats?.words}</p>
            </div>
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/20 mb-1">Reduction</p>
              <p className="text-[18px] font-display font-bold text-emerald-400">-{compressionRatio}%</p>
            </div>
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/20 mb-1">Read Time</p>
              <p className="text-[18px] font-display font-bold text-white">{summaryStats?.readingTime} min</p>
            </div>
          </div>

          <div className="relative bg-white/[0.03] border border-white/5 rounded-[24px] p-8 min-h-[200px]">
            {isLoading ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
              </div>
            ) : error ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8">
                <p className="text-red-400 font-medium mb-4">{error}</p>
                <button
                  onClick={handleGenerate}
                  className="text-[13px] font-bold uppercase tracking-wider text-white/40 hover:text-white transition-colors"
                >
                  Try Again
                </button>
              </div>
            ) : (
              <p className="text-[18px] leading-relaxed text-white/80 whitespace-pre-wrap">{summary}</p>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => handleRate('up')}
                className={`p-3 rounded-full transition-all ${rated === 'up' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-white/40 hover:text-white'}`}
              >
                <ThumbsUp className="w-5 h-5" />
              </button>
              <button 
                onClick={() => handleRate('down')}
                className={`p-3 rounded-full transition-all ${rated === 'down' ? 'bg-red-500/20 text-red-400' : 'bg-white/5 text-white/40 hover:text-white'}`}
              >
                <ThumbsDown className="w-5 h-5" />
              </button>
            </div>
            <div className="flex items-center gap-6">
              <button
                onClick={handleGenerate}
                disabled={isLoading}
                className="text-[13px] font-bold uppercase tracking-wider text-white/40 hover:text-white transition-colors"
              >
                Regenerate
              </button>
              <button
                onClick={handleCopy}
                className="flex items-center gap-2 bg-white text-black px-6 py-3 rounded-full font-bold hover:scale-105 transition-all"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
