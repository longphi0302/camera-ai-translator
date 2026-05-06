
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, X, Volume2, VolumeX, Play, Pause, Info, AlertCircle, Sparkles, Mic, MicOff, Languages, BookOpen, MessageSquare, Zap, User, Target, Search, UserRound, UserRoundPlus, Maximize2, Upload, Image as ImageIcon, Download, Video } from 'lucide-react';
import { analyzeMedia, translateText, lookupWord, identifyPoint } from './services/geminiService';
import { RecognitionResult, TranslationResponse, GrammarToken } from './types';

const LANGUAGES = [
  { label: 'Anh', code: 'en-US', name: 'English' },
  { label: 'Việt', code: 'vi-VN', name: 'Vietnamese' },
];

const TOPICS = [
  "Tổng quát",
  "Y tế & Sức khỏe",
  "Khoa học & Tự nhiên",
  "Công nghệ & Kỹ thuật",
  "Giáo dục & Học thuật",
  "Thời trang & Phong cách",
  "Lịch sử & Văn hóa",
  "Nghệ thuật & Thiết kế",
  "Ẩm thực & Dinh dưỡng",
  "Kinh doanh & Tài chính"
];

const GRAMMAR_COLORS: Record<string, string> = {
  noun: 'bg-yellow-400/20 text-yellow-500 border-yellow-500/30',
  verb: 'bg-red-400/20 text-red-500 border-red-500/30',
  adj: 'bg-cyan-400/20 text-cyan-500 border-cyan-500/30',
  adv: 'bg-purple-400/20 text-purple-500 border-purple-500/30',
  prep: 'bg-orange-400/20 text-orange-500 border-orange-500/30',
  pron: 'bg-green-400/20 text-green-500 border-green-500/30',
  conj: 'bg-pink-400/20 text-pink-500 border-pink-500/30',
  other: 'bg-white/10 text-white/60 border-white/20'
};

const HighlightedText: React.FC<{ 
  text: string; 
  activeRange: [number, number] | null; 
  className?: string; 
  style?: React.CSSProperties;
  id?: string;
}> = ({ text, activeRange, className, style, id }) => {
  if (!activeRange || !text) return <p id={id} className={className} style={style}>{text}</p>;
  
  const [start, length] = activeRange;
  // Safety checks to prevent slicing errors
  const safeStart = Math.max(0, Math.min(start, text.length));
  const safeLength = Math.max(0, Math.min(length, text.length - safeStart));

  const before = text.slice(0, safeStart);
  const active = text.slice(safeStart, safeStart + safeLength);
  const after = text.slice(safeStart + safeLength);

  return (
    <p className={className} style={style}>
      {before}
      <span className="bg-yellow-400 text-black px-0.5 rounded transition-all duration-75 shadow-[0_0_15px_rgba(250,204,21,0.6)] font-bold">{active}</span>
      {after}
    </p>
  );
};

const SubtitleOverlay = ({ 
  text, 
  pos, 
  onChange,
  fontSize,
  onFontSizeChange,
  width,
  onWidthChange,
  activeRange
}: { 
  text: string; 
  pos: { x: number; y: number }; 
  onChange: (p: { x: number; y: number }) => void;
  fontSize: number;
  onFontSizeChange: (s: number) => void;
  width: number;
  onWidthChange: (w: number) => void;
  activeRange: [number, number] | null;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showControls, setShowControls] = useState(false);

  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging || !containerRef.current?.parentElement) return;
      const rect = containerRef.current.parentElement.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      
      const x = ((clientX - rect.left) / rect.width) * 100;
      const y = ((clientY - rect.top) / rect.height) * 100;
      
      onChange({ 
        x: Math.max(5, Math.min(95, x)), 
        y: Math.max(5, Math.min(95, y)) 
      });
    };

    const stopDragging = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', stopDragging);
      window.addEventListener('touchmove', handleMove);
      window.addEventListener('touchend', stopDragging);
    }

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', stopDragging);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', stopDragging);
    };
  }, [isDragging, onChange]);

  if (!text) return null;

  return (
    <div 
      ref={containerRef}
      style={{ left: `${pos.x}%`, top: `${pos.y}%`, width: `${width}%`, transform: 'translate(-50%, -50%)' }}
      className={`absolute z-[200] text-center cursor-move transition-transform ${isDragging ? 'scale-105' : ''}`}
      onMouseDown={(e) => { e.stopPropagation(); setIsDragging(true); }}
      onTouchStart={(e) => { e.stopPropagation(); setIsDragging(true); }}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      <div className="bg-black/70 backdrop-blur-xl px-8 py-4 rounded-[32px] border border-white/20 shadow-2xl relative group">
        <HighlightedText 
          text={text}
          activeRange={activeRange}
          className="text-white font-black italic tracking-tight leading-snug drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
          style={{ fontSize: `${fontSize}px` }}
        />

        {/* Controls Overlay */}
        {(showControls || isDragging) && (
          <div className="absolute -top-16 left-1/2 -translate-x-1/2 bg-black/90 backdrop-blur-md p-3 rounded-2xl border border-white/10 flex items-center gap-4 shadow-2xl pointer-events-auto" onMouseDown={e => e.stopPropagation()}>
            <div className="flex flex-col gap-1">
              <span className="text-[8px] font-black text-white/40 uppercase">Cỡ chữ</span>
              <input 
                type="range" min="12" max="64" value={fontSize} 
                onChange={(e) => onFontSizeChange(parseInt(e.target.value))}
                className="w-24 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
            </div>
            <div className="w-px h-6 bg-white/10" />
            <div className="flex flex-col gap-1">
              <span className="text-[8px] font-black text-white/40 uppercase">Độ rộng</span>
              <input 
                type="range" min="30" max="95" value={width} 
                onChange={(e) => onWidthChange(parseInt(e.target.value))}
                className="w-24 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
            </div>
          </div>
        )}
      </div>
      {(isDragging) && (
        <div className="absolute -inset-4 border-2 border-dashed border-cyan-400/50 rounded-[40px] animate-pulse -z-10" />
      )}
    </div>
  );
};

const ARPopup = ({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) => (
  <div className="absolute inset-0 z-[100] bg-black/95 backdrop-blur-2xl flex flex-col p-6 animate-in slide-in-from-bottom-5 duration-300 rounded-3xl overflow-hidden shadow-2xl border border-white/5 mx-4 my-4">
    <div className="flex justify-between items-center mb-6">
      <div className="flex flex-col">
        <span className="text-[10px] font-black uppercase text-cyan-400 tracking-widest">AR Insight</span>
        <h2 className="text-2xl font-black text-white">{title}</h2>
      </div>
      <button onClick={onClose} className="w-10 h-10 glass rounded-full flex items-center justify-center border border-white/10 active:scale-90 transition-all">
        <X size={20} />
      </button>
    </div>
    <div className="flex-1 overflow-y-auto no-scrollbar pb-10">
      {children}
    </div>
  </div>
);

const InteractiveParagraph: React.FC<{ 
  text: string; 
  className?: string; 
  onWordClick: (word: string) => void;
  activeId?: string | null;
  activeRange?: [number, number] | null;
  id?: string;
}> = ({ text, className, onWordClick, activeId, activeRange, id }) => {
  // If we have an active range for pronunciation, use HighlightedText logic
  if (activeRange) {
    return <HighlightedText id={id} text={text} activeRange={activeRange} className={className} />;
  }

  const words = text.split(/(\s+)/);
  return (
    <div id={id} className={className}>
      {words.map((word, i) => {
        const cleanWord = word.replace(/[^a-zA-Z]/g, '');
        const isActuallyWord = cleanWord.length > 1;
        if (isActuallyWord) {
          return (
            <span 
              key={i} 
              onClick={(e) => {
                e.stopPropagation();
                onWordClick(cleanWord);
              }}
              className="cursor-pointer hover:text-cyan-400 hover:underline decoration-cyan-400/50 transition-colors inline-block"
            >
              {word}
            </span>
          );
        }
        return <span key={i}>{word}</span>;
      })}
    </div>
  );
};

const ObjectCrop: React.FC<{ src: string; box: [number, number, number, number]; mediaType: 'image' | 'video' | null }> = ({ src, box, mediaType }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!src || !box || !canvasRef.current) return;
    
    const media = mediaType === 'video' ? document.createElement('video') : new Image();
    media.src = src;
    media.crossOrigin = "anonymous";
    
    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const [ymin, xmin, ymax, xmax] = box;
      
      const sourceW = media instanceof HTMLVideoElement ? media.videoWidth : media.width;
      const sourceH = media instanceof HTMLVideoElement ? media.videoHeight : media.height;

      // Adjust box coords if they aren't provided by AI (safety fallback)
      const sy = (ymin / 1000) * sourceH;
      const sx = (xmin / 1000) * sourceW;
      const sw = Math.max(10, ((xmax - xmin) / 1000) * sourceW);
      const sh = Math.max(10, ((ymax - ymin) / 1000) * sourceH);

      canvas.width = 400;
      canvas.height = (sh / sw) * 400;
      
      ctx.drawImage(media, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    };

    if (media instanceof HTMLImageElement) {
      media.onload = draw;
    } else {
      media.onloadedmetadata = () => {
        media.onseeked = draw;
        media.currentTime = 0.1;
      };
    }
  }, [src, box, mediaType]);

  return <canvas ref={canvasRef} className="w-full h-full object-cover" />;
};

const App: React.FC = () => {
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isIdentifying, setIsIdentifying] = useState(false);
  const [capturedMedia, setCapturedMedia] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [result, setResult] = useState<RecognitionResult | null>(null);
  
  const [lookupResult, setLookupResult] = useState<any>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [spotResult, setSpotResult] = useState<RecognitionResult | null>(null);
  const [isSpotAnalyzing, setIsSpotAnalyzing] = useState(false);
  const [spotCoords, setSpotCoords] = useState<{ x: number, y: number, w?: number, h?: number } | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number, y: number } | null>(null);
  const [dragCurrent, setDragCurrent] = useState<{ x: number, y: number } | null>(null);
  const [isBoxDragging, setIsBoxDragging] = useState(false);
  
  const [error, setError] = useState<string | null>(null);
  const [voiceGender, setVoiceGender] = useState<'male' | 'female'>('female');
  const [debugStatus, setDebugStatus] = useState<string>("Sẵn sàng");
  const [activeTab, setActiveTab] = useState<'camera' | 'doc'>('camera');
  const [readAllMode, setReadAllMode] = useState<'en' | 'vi' | 'both'>('both');
  const [currentSubtitle, setCurrentSubtitle] = useState<string | null>(null);
  const [subtitlePos, setSubtitlePos] = useState({ x: 50, y: 85 });
  const [subtitleFontSize, setSubtitleFontSize] = useState(24);
  const [subtitleWidth, setSubtitleWidth] = useState(80);
  const [activePopup, setActivePopup] = useState<'vocab' | 'exercise' | 'lesson' | null>(null);
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isAnswerChecked, setIsAnswerChecked] = useState(false);
  const [isAutoDetectOn, setIsAutoDetectOn] = useState(true);
  const [score, setScore] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  
  const [framePos, setFramePos] = useState({ x: 50, y: 50 }); 
  const [frameSize, setFrameSize] = useState({ w: 40, h: 30 });
  const [mediaHeight, setMediaHeight] = useState(250); // Default height in px
  const [mediaWidth, setMediaWidth] = useState(100); // Default width in %
  const [interactionMode, setInteractionMode] = useState<'none' | 'dragging' | 'resizing' | 'headerResizing'>('none');
  
  const [speakingTextId, setSpeakingTextId] = useState<string | null>(null);
  const [activeCharRange, setActiveCharRange] = useState<[number, number] | null>(null);

  const [sourceLang, setSourceLang] = useState(LANGUAGES[0]);
  const [targetLang, setTargetLang] = useState(LANGUAGES[1]);
  const [isListening, setIsListening] = useState(false);
  const [transcribedText, setTranscribedText] = useState("");
  const [translationResult, setTranslationResult] = useState<TranslationResponse | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);

  const [selectedTopic, setSelectedTopic] = useState(TOPICS[0]);
  const [customPrompt, setCustomPrompt] = useState("");
  const [isPlayingAll, setIsPlayingAll] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(true);
  const [isVideoMuted, setIsVideoMuted] = useState(true);
  const playbackVideoRef = useRef<HTMLVideoElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const playQueueRef = useRef<{ text: string; lang: string; id: string }[]>([]);
  const captureCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const startCamera = async () => {
    try {
      setDebugStatus("Đang mở camera...");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraActive(true);
        setDebugStatus("Camera đã sẵn sàng");
      }
    } catch (err) {
      setError("Vui lòng cấp quyền camera.");
    }
  };

  const getBestVoice = useCallback((langCode: string, gender: 'male' | 'female') => {
    const voices = window.speechSynthesis.getVoices();
    const langPrefix = langCode.split('-')[0];
    const filtered = voices.filter(v => v.lang.startsWith(langPrefix));
    
    // Expressive Female/Male priorities with local preference for mobile boundary reliability
    const priorities = gender === 'female' 
      ? ['Google vi-VN', 'Linh', 'Google Vietnamese', 'Mai', 'Lan', 'Microsoft An', 'Samantha', 'Aria', 'Jenny', 'Google US English', 'Victoria', 'Zira', 'Female']
      : ['Google US English', 'Alex', 'Guy', 'Microsoft David', 'Male'];

    // 1st pass: Match name + localService (Crucial for iOS/Android word boundary)
    for (const name of priorities) {
      const found = filtered.find(v => v.name.includes(name) && v.localService);
      if (found) return found;
    }
    
    // 2nd pass: Match name (any service)
    for (const name of priorities) {
      const found = filtered.find(v => v.name.includes(name));
      if (found) return found;
    }
    
    // 3rd pass: Match exact lang code local
    const exactLocal = filtered.find(v => v.lang === langCode && v.localService);
    if (exactLocal) return exactLocal;

    return filtered[0] || null;
  }, []);

  const handleSpeech = (text: string, lang: string = 'en-US', id: string = 'global', onEnd?: () => void) => {
    if (!window.speechSynthesis) return;
    
    // Clear and reset only if not part of a queue or if explicit
    if (!onEnd) {
      window.speechSynthesis.cancel();
      setSpeakingTextId(null);
      setActiveCharRange(null);
    }
    
    if (!text || text.trim().length === 0) {
      onEnd?.();
      return;
    }

    const normalizedText = text.trim().replace(/\s+/g, ' ');
    const utterance = new SpeechSynthesisUtterance(normalizedText);
    
    const voice = getBestVoice(lang, voiceGender);
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang; 
    } else {
      utterance.lang = lang;
    }
    
    utterance.rate = 0.9;
    utterance.pitch = (voiceGender === 'female' && voice?.name.includes('Samantha')) ? 1.1 : 1.0;

    utterance.onboundary = (event) => {
      // ... boundary logic remains same
      if (event.name === 'word') {
        const charIndex = event.charIndex;
        let charLength = event.charLength;
        if (charLength === undefined || charLength === 0) {
          const remaining = normalizedText.substring(charIndex);
          const nextBoundary = remaining.search(/[\s,.;:!?()[\]{}]/);
          charLength = nextBoundary === -1 ? remaining.length : nextBoundary;
        }
        requestAnimationFrame(() => {
          setActiveCharRange([charIndex, charLength]);
        });
      }
    };

    utterance.onstart = () => {
      setSpeakingTextId(id);
      setCurrentSubtitle(normalizedText);
      // Auto scroll to current element
      const element = document.getElementById(id);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    };

    utterance.onend = () => { 
      setSpeakingTextId(null); 
      setActiveCharRange(null); 
      setCurrentSubtitle(null);
      if (onEnd) onEnd();
    };

    utterance.onerror = (e) => { 
      setSpeakingTextId(null); 
      setActiveCharRange(null); 
      if (onEnd) onEnd();
    };

    currentUtteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const playAllNarrative = () => {
    if (!result) return;
    setIsPlayingAll(true);
    
    const queue: { text: string; lang: string; id: string }[] = [];
    
    const addEn = readAllMode === 'en' || readAllMode === 'both';
    const addVi = readAllMode === 'vi' || readAllMode === 'both';

    // 1. Title
    if (addEn) queue.push({ text: result.en, lang: 'en-US', id: 'title-en' });
    if (addVi) queue.push({ text: result.vi, lang: 'vi-VN', id: 'title-vi' });
    
    // 2. Expert Insights
    if (addVi && result.expert_insights) {
      if (result.expert_insights.scientific) queue.push({ text: "Thông tin khoa học: " + result.expert_insights.scientific, lang: 'vi-VN', id: 'insight-sci' });
      if (result.expert_insights.technical) queue.push({ text: "Về kỹ thuật: " + result.expert_insights.technical, lang: 'vi-VN', id: 'insight-tech' });
      if (result.expert_insights.educational) queue.push({ text: "Giá trị giáo dục: " + result.expert_insights.educational, lang: 'vi-VN', id: 'insight-edu' });
      
      // 2.1 Food Additives (Toxicology Analysis)
      if (result.expert_insights.additives && result.expert_insights.additives.length > 0) {
        result.expert_insights.additives.forEach((add, idx) => {
          queue.push({ 
            text: `Phân tích chất phụ gia ${add.code} - ${add.name}. Tác dụng: ${add.function}. Tác hại: ${add.harmful_effects}. Liều lượng an toàn: ${add.dosage}. Thời gian đào thải: ${add.metabolism_time}. Hệ lụy lâu dài: ${add.long_term_risks}`, 
            lang: 'vi-VN', 
            id: `additive-${idx}` 
          });
        });
      }

      if (result.expert_insights.fashion) {
          queue.push({ text: "Phân tích thời trang: " + result.expert_insights.fashion.style_analysis, lang: 'vi-VN', id: 'insight-fashion' });
      }
    }

    // 2.2 Main Lessons
    if (addVi && result.main_lessons && result.main_lessons.length > 0) {
      result.main_lessons.forEach((lesson, idx) => {
        queue.push({ 
          text: `Bài học ${idx + 1}: ${lesson.title}. ${lesson.content}`, 
          lang: 'vi-VN', 
          id: `lesson-${idx}` 
        });
      });
    }
    
    // 3. Details
    if (addEn) queue.push({ text: result.details_en, lang: 'en-US', id: 'details-en' });
    if (addVi) queue.push({ text: result.details_vi, lang: 'vi-VN', id: 'details-vi' });

    // 4. Examples
    if (addEn) queue.push({ text: "Example: " + result.example_en, lang: 'en-US', id: 'ex-en' });
    if (addVi) queue.push({ text: "Dịch ví dụ: " + result.example_vi, lang: 'vi-VN', id: 'ex-vi' });

    playQueueRef.current = queue;

    const processQueue = () => {
      if (playQueueRef.current.length === 0) {
        setIsPlayingAll(false);
        return;
      }
      const item = playQueueRef.current.shift()!;
      handleSpeech(item.text, item.lang, item.id, () => {
        setTimeout(processQueue, 500);
      });
    };

    window.speechSynthesis.cancel();
    processQueue();
  };

  const downloadHtmlReport = () => {
    if (!result || !capturedMedia) return;

    const htmlContent = `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Báo cáo: ${result.en}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Inter', sans-serif; background-color: #0b0c10; color: #fff; line-height: 1.6; }
        .glass { background: rgba(255, 255, 255, 0.03); backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 40px; }
        .highlight { background: #22d3ee; color: #000; padding: 0 4px; border-radius: 8px; font-weight: 800; transition: all 0.3s; }
        .token { display: inline-block; padding: 2px 8px; border-radius: 8px; font-size: 0.8rem; font-weight: bold; margin-bottom: 4px; }
        .mono { font-family: 'JetBrains Mono', monospace; }
        @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
        .speaking { border-color: #22d3ee; box-shadow: 0 0 20px rgba(34, 211, 238, 0.2); }
    </style>
</head>
<body class="p-6 md:p-12 max-w-5xl mx-auto pb-32">
    <header class="mb-12 text-center">
        <div class="inline-block px-4 py-1 rounded-full border border-cyan-500/30 text-cyan-400 text-[10px] font-black uppercase tracking-widest mb-4">Gemini AR Lens Report</div>
        <h1 id="title-en" class="text-6xl md:text-7xl font-black text-white tracking-tighter mb-2 italic">${result.en}</h1>
        <p class="text-2xl mono text-cyan-400/60 mb-4">${result.ipa}</p>
        <h2 id="title-vi" class="text-3xl font-bold text-white/40">${result.vi}</h2>
    </header>

    <div class="glass overflow-hidden shadow-2xl mb-12">
        ${mediaType === 'video' 
            ? `<video src="${capturedMedia}" controls class="w-full h-auto max-h-[600px] object-contain bg-black"></video>` 
            : `<img src="${capturedMedia}" class="w-full h-auto max-h-[600px] object-contain bg-black" />`
        }
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <!-- Main Analysis -->
        <div class="lg:col-span-2 space-y-8">
            <section class="glass p-8">
                <h3 class="text-cyan-400 font-black uppercase text-[10px] tracking-widest mb-6">Mô tả Chi tiết (Analysis)</h3>
                <p id="det-en" class="text-3xl font-bold text-white leading-tight mb-6">${result.details_en}</p>
                <div class="h-px bg-white/5 mb-6"></div>
                <p id="det-vi" class="text-xl text-white/50">${result.details_vi}</p>
            </section>

            <section class="glass p-8">
                <h3 class="text-purple-400 font-black uppercase text-[10px] tracking-widest mb-6">Ngữ pháp (Grammar Analysis)</h3>
                <div class="flex flex-wrap gap-4">
                    ${(result.grammar_analysis || []).map(g => `
                        <div class="p-4 rounded-3xl bg-white/5 border border-white/5 flex flex-col gap-1">
                            <span class="text-[10px] font-black uppercase tracking-widest opacity-40">${g.type}</span>
                            <span class="text-lg font-bold">${g.text}</span>
                            <span class="text-xs italic text-cyan-400">${g.explanation_vi}</span>
                        </div>
                    `).join('')}
                </div>
            </section>

            <section class="glass p-8">
                <h3 class="text-yellow-400 font-black uppercase text-[10px] tracking-widest mb-6">Ví dụ tiêu biểu (Usage Example)</h3>
                <p id="ex-en" class="text-2xl font-black italic text-white/90 mb-4">"${result.example_en}"</p>
                <p id="ex-vi" class="text-lg text-white/30">→ ${result.example_vi}</p>
            </section>

            ${result.main_lessons?.length ? `
                <section class="glass p-8 border-purple-500/20">
                    <h3 class="text-purple-400 font-black uppercase text-[10px] tracking-widest mb-6">Bài học Cốt lõi (Main Lessons)</h3>
                    <div class="space-y-6">
                        ${(result.main_lessons || []).map(l => `
                            <div>
                                <h4 class="text-xl font-bold text-white mb-2">${l.title}</h4>
                                <p class="text-white/60 text-sm">${l.content}</p>
                            </div>
                        `).join('')}
                    </div>
                </section>
            ` : ''}

            ${result.exercises?.length ? `
                <section class="glass p-8 border-yellow-500/20">
                    <h3 class="text-yellow-400 font-black uppercase text-[10px] tracking-widest mb-6">Luyện tập (Practice)</h3>
                    <div class="space-y-8">
                        ${result.exercises.map((ex, i) => `
                            <div class="space-y-4">
                                <p class="text-lg font-bold">${i + 1}. ${ex.question}</p>
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    ${ex.options.map(opt => `
                                        <div class="p-3 rounded-xl bg-white/5 border border-white/5 text-sm ${opt === ex.correct_answer ? 'border-green-500/50 text-green-400' : ''}">
                                            ${opt}
                                        </div>
                                    `).join('')}
                                </div>
                                <p class="text-xs text-white/40 italic">Giải thích: ${ex.explanation}</p>
                            </div>
                        `).join('')}
                    </div>
                </section>
            ` : ''}

            ${result.expert_insights?.additives?.length ? `
                <section class="space-y-4">
                    <h3 class="text-red-500 font-black uppercase text-[10px] tracking-widest flex items-center gap-2">
                        <span>Toxicology Analysis</span>
                    </h3>
                    ${(result.expert_insights?.additives || []).map((a, i) => `
                        <div class="glass p-8 border-red-500/20 bg-red-500/5">
                            <div class="flex items-center gap-4 mb-6">
                                <div class="w-16 h-16 bg-red-500 text-black flex items-center justify-center rounded-2xl font-black text-2xl">${a.code}</div>
                                <div>
                                    <h4 class="text-2xl font-black text-white">${a.name}</h4>
                                    <span class="text-[10px] font-bold text-red-400/60 uppercase tracking-widest">High risk additive</span>
                                </div>
                            </div>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                                <div class="bg-black/20 p-4 rounded-2xl"><span class="block text-[8px] uppercase font-black opacity-40 mb-1">Tác dụng</span>${a.function}</div>
                                <div class="bg-red-950/20 p-4 rounded-2xl"><span class="block text-[8px] uppercase font-black text-red-400 mb-1">Tác hại</span>${a.harmful_effects}</div>
                                <div class="bg-black/20 p-4 rounded-2xl"><span class="block text-[8px] uppercase font-black opacity-40 mb-1">Đào thải</span>${a.metabolism_time}</div>
                                <div class="bg-red-500/10 p-4 rounded-2xl"><span class="block text-[8px] uppercase font-black text-red-300 mb-1">Hệ lụy lâu dài</span>${a.long_term_risks}</div>
                            </div>
                        </div>
                    `).join('')}
                </section>
            ` : ''}
        </div>

        <!-- Sidebar Insights -->
        <div class="space-y-6">
                    ${result.expert_insights?.scientific ? `
                <div class="glass p-6 border-blue-500/10">
                    <h3 class="text-blue-400 font-extrabold uppercase text-[10px] tracking-widest mb-3">Scientific Insight</h3>
                    <p id="sci-text" class="text-sm leading-relaxed opacity-70">${result.expert_insights.scientific}</p>
                </div>
            ` : ''}

            ${result.expert_insights?.technical ? `
                <div class="glass p-6 border-cyan-500/10">
                    <h3 class="text-cyan-400 font-extrabold uppercase text-[10px] tracking-widest mb-3">Technical Data</h3>
                    <p id="tech-text" class="text-sm leading-relaxed opacity-70">${result.expert_insights.technical}</p>
                </div>
            ` : ''}

            <div class="glass p-6">
                <h3 class="text-white/20 font-extrabold uppercase text-[10px] tracking-widest mb-4">Vocabulary Breakdown</h3>
                <div class="space-y-4">
                    ${(result.vocabulary_breakdown || []).map(v => `
                        <div class="border-b border-white/5 pb-3">
                            <span class="text-lg font-bold block">${v.term}</span>
                            <span class="text-[10px] mono opacity-40">${v.ipa}</span>
                            <p class="text-sm text-cyan-400/80">${v.meaning_vi}</p>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    </div>

    <footer class="fixed bottom-0 left-0 w-full p-8 flex justify-center pointer-events-none">
        <button onclick="playAll()" class="pointer-events-auto bg-cyan-500 text-black px-12 py-6 rounded-full font-black text-xl shadow-[0_0_50px_rgba(34,211,238,0.4)] hover:scale-105 active:scale-95 transition-all">
            PHÁT BÁO CÁO GIỌNG NÓI
        </button>
    </footer>

    <script>
        const synth = window.speechSynthesis;
        function play(text, lang, id) {
            synth.cancel();
            const utter = new SpeechSynthesisUtterance(text);
            utter.lang = lang;
            const el = document.getElementById(id);
            utter.onstart = () => { if(el) el.classList.add('highlight', 'speaking'); el?.scrollIntoView({behavior:'smooth', block:'center'}); };
            utter.onend = () => { if(el) el.classList.remove('highlight', 'speaking'); };
            synth.speak(utter);
            return utter;
        }

        async function playAll() {
            const queue = [
                {t: "${result.en}", l: "en-US", id: "title-en"},
                {t: "${result.vi}", l: "vi-VN", id: "title-vi"},
                ${result.expert_insights?.scientific ? `{t: "Phân tích khoa học: ${result.expert_insights.scientific.replace(/"/g, "'")}", l: "vi-VN", id: "sci-text"},` : ''}
                ${result.expert_insights?.technical ? `{t: "Cấu tạo kỹ thuật: ${result.expert_insights.technical.replace(/"/g, "'")}", l: "vi-VN", id: "tech-text"},` : ''}
                {t: "Mô tả chi tiết bằng tiếng Anh: ${result.details_en.replace(/"/g, "'")}", l: "en-US", id: "det-en"},
                {t: "Bản dịch tiếng Việt: ${result.details_vi.replace(/"/g, "'")}", l: "vi-VN", id: "det-vi"},
                {t: "Câu ví dụ: ${result.example_en.replace(/"/g, "'")}", l: "en-US", id: "ex-en"},
                {t: "Nghĩa là: ${result.example_vi.replace(/"/g, "'")}", l: "vi-VN", id: "ex-vi"}
            ];

            let i = 0;
            function next() {
                if(i >= queue.length) return;
                const item = queue[i++];
                const u = play(item.t, item.l, item.id);
                u.onend = () => {
                    const el = document.getElementById(item.id);
                    if(el) el.classList.remove('highlight', 'speaking');
                    setTimeout(next, 800);
                };
            }
            next();
        }
    </script>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${result.en.replace(/[^a-z0-9]/gi, '_')}_MasterReport.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };
    
  const handleWordLookup = async (word: string) => {
    if (!result) return;
    setIsLookingUp(true);
    try {
      const info = await lookupWord(word, result.details_en);
      setLookupResult(info);
      if (info.term) {
        handleSpeech(info.term, 'en-US');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLookingUp(false);
    }
  };

  const handlePointAnalysis = async (x: number, y: number, w?: number, h?: number) => {
    if (!capturedMedia) return;
    setSpotCoords({ x, y, w, h });
    setIsSpotAnalyzing(true);
    try {
      let analysisData = capturedMedia;
      let analysisMime = mediaType === 'video' ? 'video/mp4' : 'image/jpeg';

      // Optimization: If it's a video, capture the CURRENT frame instead of sending the whole video
      if (mediaType === 'video' && playbackVideoRef.current) {
        const video = playbackVideoRef.current;
        const canvas = document.createElement('canvas');
        
        // Resize for performance
        const MAX_DIM = 1080;
        let width = video.videoWidth;
        let height = video.videoHeight;
        if (width > MAX_DIM || height > MAX_DIM) {
          const ratio = width / height;
          if (width > height) {
            width = MAX_DIM;
            height = MAX_DIM / ratio;
          } else {
            height = MAX_DIM;
            width = MAX_DIM * ratio;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx && canvas.width > 0) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          analysisData = canvas.toDataURL('image/jpeg', 0.8);
          analysisMime = 'image/jpeg';
        }
      }

      const res = await identifyPoint(
        analysisData, 
        analysisMime, 
        { x, y, width: w, height: h }, 
        selectedTopic
      );
      setSpotResult(res);
      if (res && res.en) {
        handleSpeech(res.en, 'en-US');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSpotAnalyzing(false);
    }
  };

  const getRelativeCoords = (e: React.MouseEvent | React.TouchEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    return {
      x: ((clientX - rect.left) / rect.width) * 100,
      y: ((clientY - rect.top) / rect.height) * 100
    };
  };

  const onMediaMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isAutoDetectOn) return;
    e.stopPropagation();
    const coords = getRelativeCoords(e);
    setDragStart(coords);
    setDragCurrent(coords);
    setIsBoxDragging(true);
  };

  const onMediaMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isBoxDragging || !dragStart) return;
    const coords = getRelativeCoords(e);
    setDragCurrent(coords);
  };

  const onMediaMouseUp = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isBoxDragging || !dragStart || !dragCurrent) {
      setIsBoxDragging(false);
      return;
    }
    
    setIsBoxDragging(false);
    const dx = Math.abs(dragCurrent.x - dragStart.x);
    const dy = Math.abs(dragCurrent.y - dragStart.y);

    if (dx < 1 && dy < 1) {
      // Just a click
      handlePointAnalysis(dragStart.x, dragStart.y);
    } else {
      // A region selection
      const x = Math.min(dragStart.x, dragCurrent.x);
      const y = Math.min(dragStart.y, dragCurrent.y);
      handlePointAnalysis(x, y, dx, dy);
    }
    
    setDragStart(null);
    setDragCurrent(null);
  };

  const handleInteraction = (e: React.MouseEvent | React.TouchEvent) => {
    if (interactionMode === 'none' || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;

    if (interactionMode === 'headerResizing') {
      const newHeight = Math.max(100, Math.min(clientY - rect.top, window.innerHeight * 0.8));
      const newWidth = Math.max(30, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
      setMediaHeight(newHeight);
      setMediaWidth(newWidth);
      return;
    }

    if (interactionMode === 'dragging') {
      setFramePos({ 
        x: Math.max(frameSize.w / 2, Math.min(100 - frameSize.w / 2, x)), 
        y: Math.max(frameSize.h / 2, Math.min(100 - frameSize.h / 2, y)) 
      });
    } else if (interactionMode === 'resizing') {
      const halfW = Math.abs(x - framePos.x);
      const halfH = Math.abs(y - framePos.y);
      setFrameSize({
        w: Math.max(10, Math.min(90, halfW * 2)),
        h: Math.max(10, Math.min(90, halfH * 2))
      });
    }
  };

  const handleCapture = async () => {
    if (!videoRef.current || isIdentifying || result || isListening) return;
    const canvas = captureCanvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    const video = videoRef.current;
    const vW = video.videoWidth;
    const vH = video.videoHeight;

    const cropW = (frameSize.w / 100) * vW;
    const cropH = (frameSize.h / 100) * vH;
    const cropX = ((framePos.x - frameSize.w / 2) / 100) * vW;
    const cropY = ((framePos.y - frameSize.h / 2) / 100) * vH;

    canvas.width = cropW;
    canvas.height = cropH;
    context.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
    
    const base64Image = canvas.toDataURL('image/jpeg', 0.9);
    setMediaType('image');
    processMedia(base64Image, 'image/jpeg');
  };

  const getVideoFirstFrame = (videoUrl: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.src = videoUrl;
      video.crossOrigin = "anonymous";
      video.muted = true;
      video.playsInline = true;
      
      const timeout = setTimeout(() => {
        video.src = "";
        reject(new Error("Timeout khi trích xuất frame video (5s)."));
      }, 5000);

      video.onloadedmetadata = () => {
        video.currentTime = 0.1;
      };

      video.onseeked = () => {
        clearTimeout(timeout);
        const canvas = document.createElement('canvas');
        
        // Resize for performance: max 1080p
        const MAX_DIM = 1080;
        let width = video.videoWidth;
        let height = video.videoHeight;
        
        if (width > MAX_DIM || height > MAX_DIM) {
          const ratio = width / height;
          if (width > height) {
            width = MAX_DIM;
            height = MAX_DIM / ratio;
          } else {
            height = MAX_DIM;
            width = MAX_DIM * ratio;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx && canvas.width > 0) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          video.src = "";
          resolve(dataUrl);
        } else {
          video.src = "";
          reject(new Error("Lỗi khởi tạo canvas."));
        }
      };

      video.onerror = () => {
        clearTimeout(timeout);
        video.src = "";
        reject(new Error("Lỗi tải video."));
      };
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      const isVideo = file.type.startsWith('video');
      setMediaType(isVideo ? 'video' : 'image');
      setIsCameraActive(false);
      processMedia(base64, file.type);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const processMedia = async (base64Media: string, mimeType: string) => {
    setIsIdentifying(true);
    setCapturedMedia(base64Media);
    setResult(null);
    setError(null);
    setDebugStatus(`Khởi động phân tích theo chủ đề ${selectedTopic}...`);
    try {
      let analysisData = base64Media;
      let analysisMime = mimeType;

      if (mimeType.startsWith('video/')) {
        setDebugStatus("Đang trích xuất ảnh từ video để tăng tốc độ...");
        try {
          analysisData = await getVideoFirstFrame(base64Media);
          analysisMime = 'image/jpeg';
          setDebugStatus("Trích xuất xong. Đang gửi dữ liệu đến AI...");
        } catch (vErr: any) {
          console.warn("Frame extraction failed:", vErr);
          setDebugStatus("Trích xuất ảnh lỗi, đang thử gửi toàn bộ video (có thể lâu)...");
        }
      } else {
        setDebugStatus("Đang gửi hình ảnh đến AI...");
      }

      const aiResult = await analyzeMedia(analysisData, analysisMime, selectedTopic, customPrompt);
      setResult(aiResult);
      setDebugStatus("Hoàn tất phân tích!");
      handleSpeech(aiResult.en, 'en-US', 'title-en');
    } catch (err: any) {
      console.error("Analysis Error:", err);
      setError(err.message || "AI không thể phân tích nội dung này. Hãy thử lại.");
      setDebugStatus("Phân tích lỗi.");
    } finally {
      setIsIdentifying(false);
    }
  };

  const toggleListening = async () => {
    if (isListening) { recognitionRef.current?.stop(); return; }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const rec = new SpeechRecognition();
    rec.lang = sourceLang.code;
    rec.onstart = () => setIsListening(true);
    rec.onresult = (e: any) => {
      const text = e.results[0][0].transcript;
      setTranscribedText(text);
      setIsTranslating(true);
      translateText(text, sourceLang.name, targetLang.name).then(res => {
        setTranslationResult(res);
        handleSpeech(res.translated_text, targetLang.code, 'translation');
        setIsTranslating(false);
      });
    };
    rec.onend = () => setIsListening(false);
    recognitionRef.current = rec;
    rec.start();
  };

  const handleDownload = () => {
    if (!result) return;

    const htmlContent = `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Gemini AR Lens - ${result.en}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Inter', sans-serif; background-color: #000; color: white; margin: 0; padding: 20px; }
        .glass { background: rgba(25, 25, 25, 0.6); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .highlight { background-color: #facc15; color: #000; padding: 0 2px; border-radius: 4px; box-shadow: 0 0 15px rgba(250,204,21,0.6); font-weight: 700; transition: all 0.1s ease; }
    </style>
</head>
<body class="min-h-screen flex flex-col items-center py-10">
    <div class="max-w-2xl w-full glass rounded-[48px] border border-cyan-500/20 shadow-2xl overflow-hidden mb-10">
        ${capturedMedia ? `<img src="${capturedMedia}" class="w-full h-80 object-cover border-b border-cyan-500/20" />` : ''}
        
        <div class="p-8 md:p-12">
            <div class="flex justify-between items-start mb-10">
                <div class="flex-1">
                    <h1 id="title-en" class="text-5xl md:text-6xl font-black text-cyan-400 leading-tight mb-2">${result.en}</h1>
                    <p class="text-xl font-mono opacity-40 mb-4">${result.ipa}</p>
                    <p class="text-4xl font-black text-white/90">${result.vi}</p>
                </div>
                <button onclick="speak('${result.en.replace(/'/g, "\\'")}', 'en-US', 'title-en')" class="p-6 bg-cyan-500 rounded-[24px] text-black shadow-lg active:scale-95 transition-all">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 10v3a1 1 0 0 0 1 1h1.5L9 19V5l-4.5 5H3a1 1 0 0 0-1 1Z"/><path d="M11 14c.64.1 1.39.3 2.5 1.5"/><path d="M11 10c.64-.1 1.39-.3 2.5-1.5"/><path d="M15 8c.5 1 1.5 2 1.5 4s-1 3-1.5 4"/><path d="M19 5c1 2 2.5 4 2.5 7s-1.5 5-2.5 7"/></svg>
                </button>
            </div>

            <div class="space-y-8 mb-12">
                <!-- Expert Insights -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    ${result.expert_insights?.scientific ? `
                        <div class="bg-white/5 rounded-[32px] p-6 border border-white/5">
                            <h3 class="text-blue-400 uppercase text-[10px] font-black tracking-widest mb-3">Khoa học</h3>
                            <p class="text-white/80 text-sm leading-relaxed">${result.expert_insights.scientific}</p>
                        </div>
                    ` : ''}
                    ${result.expert_insights?.medical ? `
                        <div class="bg-red-500/10 rounded-[32px] p-6 border border-red-500/20">
                            <h3 class="text-red-400 uppercase text-[10px] font-black tracking-widest mb-3">Y tế</h3>
                            <p class="text-white/80 text-sm leading-relaxed">${result.expert_insights.medical}</p>
                        </div>
                    ` : ''}
                    ${result.expert_insights?.technical ? `
                        <div class="bg-white/5 rounded-[32px] p-6 border border-white/5">
                            <h3 class="text-cyan-400 uppercase text-[10px] font-black tracking-widest mb-3">Kỹ thuật</h3>
                            <p class="text-white/80 text-sm leading-relaxed">${result.expert_insights.technical}</p>
                        </div>
                    ` : ''}
                    ${result.expert_insights?.educational ? `
                        <div class="bg-white/5 rounded-[32px] p-6 border border-white/5">
                            <h3 class="text-yellow-400 uppercase text-[10px] font-black tracking-widest mb-3">Giáo dục</h3>
                            <p class="text-white/80 text-sm leading-relaxed">${result.expert_insights.educational}</p>
                        </div>
                    ` : ''}
                </div>

                ${result.expert_insights?.fashion ? `
                    <div class="bg-purple-500/10 rounded-[32px] p-8 border border-purple-500/20">
                        <h3 class="text-purple-400 uppercase text-[10px] font-black tracking-widest mb-6">Fashion Specialist Analysis</h3>
                        <div class="grid grid-cols-2 gap-4 mb-4">
                            <div class="bg-black/20 p-4 rounded-2xl border border-white/5">
                                <span class="text-[8px] text-white/40 block">Lứa tuổi</span>
                                <span class="font-bold text-white">${result.expert_insights.fashion.age_group}</span>
                            </div>
                            <div class="bg-black/20 p-4 rounded-2xl border border-white/5">
                                <span class="text-[8px] text-white/40 block">Giá tiền</span>
                                <span class="font-bold text-cyan-400">${result.expert_insights.fashion.estimated_price}</span>
                            </div>
                        </div>
                        <div class="p-6 bg-purple-500/5 rounded-2xl border border-purple-500/10">
                            <h3 class="text-[8px] text-purple-400/60 uppercase mb-2">Nhận xét phong cách</h3>
                            <p class="text-xl font-bold text-purple-50">${result.expert_insights.fashion.style_analysis}</p>
                        </div>
                    </div>
                ` : ''}

                <div class="bg-white/5 rounded-[40px] p-8 border border-white/5">
                    <div class="flex items-center justify-between mb-6">
                        <h2 class="text-cyan-400/80 uppercase text-xs font-black tracking-widest flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                            Phân tích ngoại hình
                        </h2>
                        <div class="flex gap-2">
                            <button onclick="speak('${result.details_en.replace(/'/g, "\\'")}', 'en-US', 'details-en')" class="p-2 bg-white/10 rounded-xl hover:bg-cyan-500/20 transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 10v3a1 1 0 0 0 1 1h1.5L9 19V5l-4.5 5H3a1 1 0 0 0-1 1Z"/><path d="M11 14c.64.1 1.39.3 2.5 1.5"/><path d="M11 10c.64-.1 1.39-.3 2.5-1.5"/><path d="M15 8c.5 1 1.5 2 1.5 4s-1 3-1.5 4"/><path d="M19 5c1 2 2.5 4 2.5 7s-1.5 5-2.5 7"/></svg>
                            </button>
                            <button onclick="speak('${result.details_vi.replace(/'/g, "\\'")}', 'vi-VN', 'details-vi')" class="p-2 bg-white/10 rounded-xl hover:bg-cyan-500/20 transition-colors">
                                <span class="text-[10px] font-bold">VI</span>
                            </button>
                        </div>
                    </div>
                    <p id="details-en" class="text-2xl font-bold leading-relaxed mb-6 text-white/90">${result.details_en}</p>
                    <p id="details-vi" class="text-2xl font-medium leading-relaxed text-white/60 border-t border-white/5 pt-6">${result.details_vi}</p>
                </div>

                ${result.is_human ? `
                <div class="bg-cyan-500/10 rounded-[40px] p-8 border border-cyan-500/20">
                    <div class="flex items-center justify-between mb-6">
                        <h2 class="text-cyan-400 uppercase text-xs font-black tracking-widest flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                            Dự đoán đời sống (AI)
                        </h2>
                        <div class="flex gap-2">
                            <button onclick="speak('${(result.predictions_en || "").replace(/'/g, "\\'")}', 'en-US', 'pred-en')" class="p-2 bg-white/10 rounded-xl hover:bg-cyan-500/20 transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 10v3a1 1 0 0 0 1 1h1.5L9 19V5l-4.5 5H3a1 1 0 0 0-1 1Z"/><path d="M11 14c.64.1 1.39.3 2.5 1.5"/><path d="M11 10c.64-.1 1.39-.3 2.5-1.5"/><path d="M15 8c.5 1 1.5 2 1.5 4s-1 3-1.5 4"/><path d="M19 5c1 2 2.5 4 2.5 7s-1.5 5-2.5 7"/></svg>
                            </button>
                            <button onclick="speak('${(result.predictions_vi || "").replace(/'/g, "\\'")}', 'vi-VN', 'pred-vi')" class="p-2 bg-white/10 rounded-xl hover:bg-cyan-500/20 transition-colors">
                                <span class="text-[10px] font-bold">VI</span>
                            </button>
                        </div>
                    </div>
                    <p id="pred-en" class="text-3xl font-black text-cyan-100 mb-4">${result.predictions_en || ''}</p>
                    <p id="pred-vi" class="text-3xl font-bold text-cyan-400/80 border-t border-cyan-400/10 pt-6">${result.predictions_vi || ''}</p>
                </div>
                ` : ''}
            </div>

            <div class="mb-12">
                <div class="flex items-center justify-between mb-6">
                    <h2 class="text-white/40 uppercase text-xs font-black tracking-widest flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m13 2-2 2.5h3L12 7h3l-4 5h3l-2 7h2l4.2-11H15l3-4.5h-3l2-2.5h-4Z"/></svg>
                        Cấu trúc câu ví dụ
                    </h2>
                    <button onclick="speak('${result.example_en.replace(/'/g, "\\'")}', 'en-US', 'example-en')" class="p-2 bg-white/10 rounded-xl hover:bg-cyan-500/20 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 10v3a1 1 0 0 0 1 1h1.5L9 19V5l-4.5 5H3a1 1 0 0 0-1 1Z"/><path d="M11 14c.64.1 1.39.3 2.5 1.5"/><path d="M11 10c.64-.1 1.39-.3 2.5-1.5"/><path d="M15 8c.5 1 1.5 2 1.5 4s-1 3-1.5 4"/><path d="M19 5c1 2 2.5 4 2.5 7s-1.5 5-2.5 7"/></svg>
                    </button>
                </div>
                <div class="bg-white/5 rounded-[40px] p-8 border border-white/5">
                    <p id="example-en" class="text-3xl font-black text-white/90 italic leading-tight mb-6">${result.example_en}</p>
                    <p class="text-xl text-white/40 border-t border-white/5 pt-6">${result.example_vi}</p>
                </div>
            </div>

            <div>
                <h2 class="text-white/40 uppercase text-xs font-black tracking-widest mb-6 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M8 7h6"/><path d="M8 11h8"/></svg>
                    Từ vựng chuyên sâu
                </h2>
                <div class="space-y-6">
                    ${(result.vocabulary_breakdown || []).map((v, i) => `
                        <div class="bg-white/5 p-8 rounded-[40px] border border-white/5 flex items-center justify-between group">
                            <div class="flex-1 pr-6">
                                <div class="flex items-center gap-3 mb-2">
                                    <span id="vocab-${i}" class="text-2xl font-black text-cyan-400">${v.term}</span>
                                    <span class="text-[10px] px-3 py-1 bg-cyan-400/20 text-cyan-400 rounded-xl font-black uppercase">${v.type}</span>
                                </div>
                                <p class="text-base font-mono opacity-40 mb-2">${v.ipa}</p>
                                <p class="text-xl font-semibold text-white/90">${v.meaning_vi}</p>
                            </div>
                            <button onclick="speak('${v.term.replace(/'/g, "\\'")}', 'en-US', 'vocab-${i}')" class="p-5 bg-white/5 rounded-[20px] hover:bg-cyan-500/20 transition-all">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 10v3a1 1 0 0 0 1 1h1.5L9 19V5l-4.5 5H3a1 1 0 0 0-1 1Z"/><path d="M11 14c.64.1 1.39.3 2.5 1.5"/><path d="M11 10c.64-.1 1.39-.3 2.5-1.5"/><path d="M15 8c.5 1 1.5 2 1.5 4s-1 3-1.5 4"/><path d="M19 5c1 2 2.5 4 2.5 7s-1.5 5-2.5 7"/></svg>
                            </button>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    </div>

    <div class="text-white/20 text-sm font-bold uppercase tracking-widest">Generated by Gemini AR Lens</div>

    <script>
        function getBestVoice(langCode) {
            const voices = window.speechSynthesis.getVoices();
            const langPrefix = langCode.split('-')[0];
            const filtered = voices.filter(v => v.lang.startsWith(langPrefix));
            
            const priorities = ['Samantha', 'Aria', 'Jenny', 'Google US English', 'Victoria', 'Zira', 'Female', 'Alex', 'Guy', 'Microsoft David', 'Male'];

            for (const name of priorities) {
                const found = filtered.find(v => v.name.includes(name) && v.localService);
                if (found) return found;
            }
            for (const name of priorities) {
                const found = filtered.find(v => v.name.includes(name));
                if (found) return found;
            }
            return filtered[0] || null;
        }

        function speak(text, lang, elementId) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            const voice = getBestVoice(lang);
            if (voice) {
                utterance.voice = voice;
                utterance.lang = voice.lang;
            } else {
                utterance.lang = lang;
            }
            utterance.rate = 0.9;
            
            const element = document.getElementById(elementId);
            const originalHTML = element.innerHTML;
            const originalText = text;

            utterance.onboundary = (event) => {
                if (event.name === 'word') {
                    const charIndex = event.charIndex;
                    let charLength = event.charLength;
                    if (charLength === undefined || charLength === 0) {
                        const remaining = originalText.substring(charIndex);
                        const nextBoundary = remaining.search(/[\\s,.;:!?()[\\]{}]/);
                        charLength = nextBoundary === -1 ? remaining.length : nextBoundary;
                    }
                    
                    const before = originalText.slice(0, charIndex);
                    const active = originalText.slice(charIndex, charIndex + charLength);
                    const after = originalText.slice(charIndex + charLength);
                    
                    element.innerHTML = before + '<span class="highlight">' + active + '</span>' + after;
                }
            };

            utterance.onend = () => {
                element.innerHTML = originalHTML;
            };

            window.speechSynthesis.speak(utterance);
        }
        
        // Load voices
        window.speechSynthesis.getVoices();
        window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
    </script>
</body>
</html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gemini-ar-lens-${result.en.toLowerCase().replace(/\s+/g, '-')}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const close = () => {
    setResult(null);
    setTranslationResult(null);
    setTranscribedText("");
    window.speechSynthesis.cancel();
    setSpeakingTextId(null);
    setActiveCharRange(null);
  };

  useEffect(() => {
    // Initial load of voices
    window.speechSynthesis.getVoices();
    const handleVoicesChanged = () => window.speechSynthesis.getVoices();
    window.speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged);
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
      window.speechSynthesis.cancel();
    };
  }, []);

  return (
    <div 
      ref={containerRef}
      className={`relative w-full h-[100dvh] bg-black overflow-hidden flex flex-col text-white ${result ? 'overflow-y-auto' : ''}`}
      onMouseMove={handleInteraction}
      onTouchMove={handleInteraction}
      onMouseUp={() => setInteractionMode('none')}
      onTouchEnd={() => setInteractionMode('none')}
    >
      {/* Sticky Media Section */}
      {result && capturedMedia && (
        <div 
          className="sticky top-0 z-[60] bg-black shadow-2xl transition-[height,width] duration-75 ease-out select-none mx-auto overflow-visible"
          style={{ height: `${mediaHeight}px`, width: `${mediaWidth}%` }}
        >
          <div 
            className={`relative w-full h-full overflow-hidden rounded-b-3xl group ${isAutoDetectOn ? 'cursor-crosshair' : 'cursor-default'}`}
            onMouseDown={onMediaMouseDown}
            onMouseMove={onMediaMouseMove}
            onMouseUp={onMediaMouseUp}
            onTouchStart={onMediaMouseDown}
            onTouchMove={onMediaMouseMove}
            onTouchEnd={onMediaMouseUp}
          >
            {mediaType === 'video' ? (
              <div className="relative w-full h-full">
                <video 
                  ref={playbackVideoRef}
                  src={capturedMedia} 
                  autoPlay 
                  loop 
                  muted={isVideoMuted} 
                  playsInline 
                  className="w-full h-full object-cover"
                />
                {/* Video Controls Overlay */}
                <div className="absolute bottom-4 left-4 flex gap-2 z-40">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      if (playbackVideoRef.current) {
                        if (isVideoPlaying) {
                          playbackVideoRef.current.pause();
                        } else {
                          playbackVideoRef.current.play();
                        }
                        setIsVideoPlaying(!isVideoPlaying);
                      }
                    }}
                    className="w-10 h-10 bg-black/50 backdrop-blur-md rounded-xl flex items-center justify-center text-white border border-white/20 active:scale-90 transition-all font-black"
                  >
                    {isVideoPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsVideoMuted(!isVideoMuted);
                    }}
                    className="w-10 h-10 bg-black/50 backdrop-blur-md rounded-xl flex items-center justify-center text-white border border-white/20 active:scale-90 transition-all font-black"
                  >
                    {isVideoMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                  </button>
                </div>
              </div>
            ) : (
              <img 
                src={capturedMedia} 
                className="w-full h-full object-cover pointer-events-none" 
                alt="Captured"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
            
            <SubtitleOverlay 
              text={currentSubtitle || ""} 
              pos={subtitlePos} 
              onChange={setSubtitlePos}
              fontSize={subtitleFontSize}
              onFontSizeChange={setSubtitleFontSize}
              width={subtitleWidth}
              onWidthChange={setSubtitleWidth}
              activeRange={activeCharRange}
            />

            {/* Spot Analysis Ring/Box */}
            {spotCoords && (
              <div 
                className={`absolute pointer-events-none transition-all duration-300 border-2 ${isSpotAnalyzing ? 'border-yellow-400 animate-pulse' : 'border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.5)]'}`}
                style={spotCoords.w && spotCoords.h ? {
                  left: `${spotCoords.x}%`, 
                  top: `${spotCoords.y}%`,
                  width: `${spotCoords.w}%`,
                  height: `${spotCoords.h}%`,
                  borderRadius: '12px'
                } : {
                  left: `${spotCoords.x}%`, 
                  top: `${spotCoords.y}%`,
                  width: '32px',
                  height: '32px',
                  transform: 'translate(-50%, -50%)',
                  borderRadius: '50%'
                }}
              >
                {isSpotAnalyzing && (
                  <div className="absolute inset-0 border border-white/50 animate-ping opacity-50" style={{ borderRadius: spotCoords.w ? '12px' : '50%' }} />
                )}
                {!spotCoords.w && (
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-1 bg-white rounded-full" />
                )}
              </div>
            )}

            {/* Active Drawing Box */}
            {isBoxDragging && dragStart && dragCurrent && (
              <div 
                className="absolute border-2 border-dashed border-cyan-400 bg-cyan-400/20 rounded-xl pointer-events-none z-50 shadow-[0_0_30px_rgba(34,211,238,0.3)]"
                style={{
                  left: `${Math.min(dragStart.x, dragCurrent.x)}%`,
                  top: `${Math.min(dragStart.y, dragCurrent.y)}%`,
                  width: `${Math.abs(dragCurrent.x - dragStart.x)}%`,
                  height: `${Math.abs(dragCurrent.y - dragStart.y)}%`
                }}
              >
                <div className="absolute -top-6 left-0 bg-cyan-500 text-black text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-tighter shadow-lg">
                  Đang chọn vùng phân tích...
                </div>
              </div>
            )}

            {/* Word Lookup Popup (Small Overlay) */}
            {lookupResult && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[150] w-[80%] max-w-sm">
                <div className="bg-black/90 backdrop-blur-xl border border-cyan-500/30 p-4 rounded-3xl shadow-2xl animate-in fade-in zoom-in duration-200">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="text-cyan-400 font-black text-lg">{lookupResult.term}</h4>
                      <p className="text-[10px] font-mono opacity-50 uppercase">{lookupResult.ipa}</p>
                    </div>
                    <button onClick={() => setLookupResult(null)} className="text-white/40 hover:text-white"><X size={16}/></button>
                  </div>
                  <p className="text-sm font-bold text-white mb-2">{lookupResult.meaning_vi}</p>
                  <p className="text-[10px] text-white/60 italic leading-snug">{lookupResult.explanation}</p>
                </div>
              </div>
            )}

            {/* Spot Result Popup */}
            {spotResult && (
              <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-[150] w-[92%] max-w-md" onClick={(e) => e.stopPropagation()}>
                <div className="bg-white text-black p-5 rounded-[40px] shadow-2xl animate-in slide-in-from-bottom-5 duration-300 relative group overflow-hidden border border-white/50">
                  <div className="flex gap-4 items-start">
                    <div className="w-24 h-24 rounded-3xl overflow-hidden bg-zinc-100 flex-shrink-0 shadow-inner border border-black/5">
                      {capturedMedia && spotResult.box_2d && (
                        <ObjectCrop src={capturedMedia} box={spotResult.box_2d} mediaType={mediaType} />
                      )}
                    </div>
                    <div className="flex-1 pt-1">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="text-2xl font-black leading-tight tracking-tight">{spotResult.en}</h4>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSpeech(spotResult.en, 'en-US');
                          }}
                          className="w-10 h-10 bg-cyan-500 rounded-2xl flex items-center justify-center text-white active:scale-95 transition-all shadow-lg shadow-cyan-500/30"
                        >
                          <Volume2 size={18} />
                        </button>
                      </div>
                      <p className="text-xs font-mono font-black text-cyan-600 mb-2 uppercase tracking-widest">{spotResult.ipa}</p>
                      <div className="bg-zinc-50 p-3 rounded-2xl border border-black/[0.03]">
                        <p className="text-base font-black leading-snug">{spotResult.vi}</p>
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setSpotResult(null);
                      setSpotCoords(null);
                    }}
                    className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center bg-black/5 hover:bg-black/10 rounded-full text-black/60 transition-all active:scale-90 z-10"
                    title="Đóng"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
            )}

            {/* Interactive Shortcut Icons */}
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-3 z-30">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setActivePopup('vocab');
                }}
                className="w-12 h-12 glass rounded-2xl flex items-center justify-center border border-cyan-500/30 hover:bg-cyan-500/20 active:scale-95 transition-all shadow-2xl"
              >
                <BookOpen size={24} className="text-cyan-400" />
              </button>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setActivePopup('exercise');
                }}
                className="w-12 h-12 glass rounded-2xl flex items-center justify-center border border-yellow-500/30 hover:bg-yellow-500/20 active:scale-95 transition-all shadow-2xl"
              >
                <Target size={24} className="text-yellow-400" />
              </button>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setActivePopup('lesson');
                }}
                className="w-12 h-12 glass rounded-2xl flex items-center justify-center border border-purple-500/30 hover:bg-purple-500/20 active:scale-95 transition-all shadow-2xl"
              >
                <Sparkles size={24} className="text-purple-400" />
              </button>
            </div>

            {/* Top Action Bar */}
            <div className="absolute top-4 right-4 flex gap-2 z-50">
               <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setIsAutoDetectOn(!isAutoDetectOn);
                }} 
                className={`flex items-center gap-2 px-3 h-10 rounded-full border transition-all active:scale-95 ${isAutoDetectOn ? 'bg-cyan-500 border-cyan-400 text-black font-black' : 'bg-black/40 border-white/20 text-white/60 font-bold'}`}
              >
                <div className={`w-2 h-2 rounded-full ${isAutoDetectOn ? 'bg-black animate-pulse' : 'bg-white/40'}`} />
                <span className="text-[10px] uppercase tracking-wider">{isAutoDetectOn ? 'Detech ON' : 'Detech OFF'}</span>
              </button>
               <button 
                onClick={(e) => {
                  e.stopPropagation();
                  close();
                }} 
                className="w-10 h-10 glass rounded-full flex items-center justify-center border border-white/20 active:scale-90 transition-all text-white"
              >
                <X size={20} />
              </button>
            </div>

            {/* Resize Handle (Corner for W+H) */}
            <div 
              className="absolute bottom-0 right-0 w-12 h-12 cursor-nwse-resize flex items-end justify-end p-2 group/handle z-20"
              onMouseDown={(e) => {
                e.stopPropagation();
                setInteractionMode('headerResizing');
              }}
              onTouchStart={(e) => {
                e.stopPropagation();
                setInteractionMode('headerResizing');
              }}
            >
              <div className="w-8 h-8 glass rounded-tl-2xl flex items-center justify-center text-cyan-400 group-hover/handle:text-white transition-colors">
                <Maximize2 size={16} />
              </div>
            </div>

            {/* Bottom Handle (H only) */}
            <div 
              className="absolute bottom-0 left-0 right-0 h-4 cursor-ns-resize flex items-center justify-center group/h-handle z-10"
              onMouseDown={(e) => {
                e.stopPropagation();
                setInteractionMode('headerResizing');
              }}
              onTouchStart={(e) => {
                e.stopPropagation();
                setInteractionMode('headerResizing');
              }}
            >
              <div className="w-10 h-1 bg-white/20 rounded-full group-hover/h-handle:bg-cyan-500/50 transition-colors" />
            </div>
          </div>
        </div>
      )}

      {/* Target Frame UI */}
      {isCameraActive && !result && !isIdentifying && (
        <div 
          style={{ 
            left: `${framePos.x}%`, 
            top: `${framePos.y}%`,
            width: `${frameSize.w}%`,
            height: `${frameSize.h}%`
          }}
          className="absolute z-20 -translate-x-1/2 -translate-y-1/2 pointer-events-auto"
        >
          <div 
            className={`w-full h-full border-4 rounded-[32px] flex items-center justify-center transition-all relative ${interactionMode !== 'none' ? 'border-cyan-400 bg-cyan-400/20 shadow-[0_0_50px_rgba(34,211,238,0.5)]' : 'border-cyan-400/60 bg-cyan-400/5'}`}
            onMouseDown={() => setInteractionMode('dragging')}
            onTouchStart={() => setInteractionMode('dragging')}
          >
            <Target size={32} className={`transition-transform ${interactionMode === 'dragging' ? 'scale-125 text-cyan-400' : 'text-cyan-400/30'}`} />
            
            <div 
              onMouseDown={(e) => { e.stopPropagation(); setInteractionMode('resizing'); }}
              onTouchStart={(e) => { e.stopPropagation(); setInteractionMode('resizing'); }}
              className="absolute -bottom-4 -right-4 w-12 h-12 bg-cyan-500 rounded-full border-4 border-black flex items-center justify-center cursor-se-resize shadow-lg active:scale-125 transition-transform"
            >
              <Maximize2 size={20} className="text-black rotate-45" />
            </div>

            <div className="absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap px-3 py-1 bg-black/80 border border-cyan-400/30 rounded-full text-[9px] font-bold uppercase tracking-widest">
              {interactionMode === 'resizing' ? 'Đang thu phóng' : 'Kéo để di chuyển'}
            </div>
          </div>
        </div>
      )}

      {/* Camera Viewport */}
      <div className="absolute inset-0 z-0 bg-black">
        <video ref={videoRef} autoPlay playsInline muted className={`w-full h-full object-cover transition-opacity ${isCameraActive ? 'opacity-100' : 'opacity-0'}`} />
        <canvas ref={captureCanvasRef} className="hidden" />
      </div>

      {/* Header UI */}
      <div className="absolute top-6 left-6 right-6 z-50 flex justify-between items-start pointer-events-none">
        <div className="flex flex-col gap-2 pointer-events-auto">
          <div className="px-3 py-1.5 bg-black/80 rounded-xl border border-white/20 shadow-xl">
            <p className="text-[10px] font-mono text-cyan-400 font-bold uppercase tracking-tight">{debugStatus}</p>
          </div>
          {result && (
            <button 
              onClick={downloadHtmlReport}
              className="w-12 h-12 glass rounded-2xl flex items-center justify-center border border-cyan-500/20 shadow-xl active:scale-90 transition-all text-cyan-400"
              title="Tải về báo cáo HTML"
            >
              <Download size={20} />
            </button>
          )}
        </div>
        <button 
          onClick={() => setVoiceGender(v => v === 'male' ? 'female' : 'male')}
          className="w-12 h-12 glass rounded-2xl flex items-center justify-center border border-white/10 shadow-xl pointer-events-auto active:scale-90 transition-all"
        >
          {voiceGender === 'female' ? <UserRound size={20} className="text-pink-400" /> : <UserRoundPlus size={20} className="text-blue-400" />}
        </button>
      </div>

      {/* Main Controls */}
      {isCameraActive && !result && !error && (
        <div className="absolute bottom-12 left-0 right-0 z-20 flex flex-col items-center gap-6">
           {/* Topic & Prompt Picker */}
           <div className="w-full max-w-sm px-6 flex flex-col gap-3">
             <div className="flex gap-2">
                <select 
                  value={selectedTopic}
                  onChange={(e) => setSelectedTopic(e.target.value)}
                  className="flex-1 glass border border-white/20 rounded-2xl px-4 py-3 text-sm font-bold text-cyan-400 appearance-none outline-none focus:border-cyan-400 transition-all"
                >
                  {TOPICS.map(t => <option key={t} value={t} className="bg-zinc-900">{t}</option>)}
                </select>
                <div className="w-12 h-12 glass rounded-2xl flex items-center justify-center text-white/50 border border-white/10">
                  <BookOpen size={20} />
                </div>
             </div>
             <input 
                type="text" 
                placeholder="Yêu cầu riêng cho AI (tùy chọn)..." 
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                className="w-full glass border border-white/20 rounded-2xl px-5 py-3 text-sm font-medium outline-none focus:border-cyan-400 transition-all placeholder:text-white/20"
             />
           </div>

           <div className="flex items-center gap-6">
              <button 
                onClick={toggleListening} 
                className={`w-14 h-14 rounded-2xl glass flex items-center justify-center border border-white/10 ${isListening ? 'bg-red-500/50 scale-110' : ''} transition-all`}
                title="Dịch giọng nói"
              >
                {isListening ? <MicOff size={24} className="animate-pulse" /> : <Mic size={24} />}
              </button>
              
              <button onClick={handleCapture} className="w-20 h-20 rounded-full bg-white flex items-center justify-center shadow-white/20 active:scale-95 transition-all" title="Chụp để phân tích">
                <div className="w-16 h-16 rounded-full bg-cyan-500 flex items-center justify-center"><Search size={28} className="text-white" /></div>
              </button>

              <button 
                onClick={() => fileInputRef.current?.click()} 
                className="w-14 h-14 rounded-2xl glass flex items-center justify-center border border-white/10 active:scale-95 transition-all group relative"
                title="Tải lên"
              >
                <div className="absolute -top-1 -right-1 flex gap-0.5">
                  <div className="w-4 h-4 bg-cyan-500 rounded-full flex items-center justify-center border-2 border-black">
                    <ImageIcon size={8} className="text-white" />
                  </div>
                  <div className="w-4 h-4 bg-purple-500 rounded-full flex items-center justify-center border-2 border-black">
                    <Video size={8} className="text-white" />
                  </div>
                </div>
                <Upload size={24} className="text-cyan-400" />
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                accept="image/*,video/*" 
                className="hidden" 
              />
           </div>
           <p className="px-5 py-2 glass rounded-full text-[10px] font-black tracking-widest uppercase text-white/50 border border-white/5">
             Detec đối tượng hoặc Tải ảnh/Video lên
           </p>
        </div>
      )}

      {/* Results Content */}
      {result && (
        <div className="relative z-[50] flex-1 bg-black overflow-visible pb-24">
          {/* Popups Overlays */}
          {activePopup === 'vocab' && (
            <ARPopup title="Từ vựng Chuyên sâu" onClose={() => setActivePopup(null)}>
              <div className="space-y-4">
                {(result.vocabulary_breakdown || []).map((v, i) => (
                  <div key={i} className="bg-white/5 p-6 rounded-[32px] border border-white/5 flex items-center justify-between group">
                    <div className="flex-1 pr-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xl font-black text-cyan-400">{v.term}</span>
                        <span className="text-[9px] px-2 py-0.5 bg-cyan-400/20 text-cyan-400 rounded-lg font-black uppercase">{v.type}</span>
                      </div>
                      <p className="text-sm font-mono opacity-40 mb-1">{v.ipa}</p>
                      <p className="text-base font-semibold text-white/90">{v.meaning_vi}</p>
                    </div>
                    <button onClick={() => handleSpeech(v.term, 'en-US')} className="p-4 bg-cyan-500/20 rounded-2xl flex-shrink-0 text-cyan-400"><Volume2 size={24}/></button>
                  </div>
                ))}
              </div>
            </ARPopup>
          )}

          {activePopup === 'lesson' && (
            <ARPopup title="Bài học Cốt lõi" onClose={() => setActivePopup(null)}>
              <div className="space-y-4">
                {result.main_lessons?.map((lesson, i) => (
                  <div key={i} className="bg-white/5 p-8 rounded-[40px] border border-white/5 relative group">
                    <div className="w-12 h-12 bg-purple-500/20 rounded-2xl flex items-center justify-center text-purple-400 border border-purple-500/30 mb-4">
                      <Zap size={24} />
                    </div>
                    <h3 className="text-xl font-black text-white mb-2">{lesson.title}</h3>
                    <p className="text-white/60 leading-relaxed font-medium">{lesson.content}</p>
                  </div>
                ))}
              </div>
            </ARPopup>
          )}

          {activePopup === 'exercise' && (
            <ARPopup title="Luyện tập & Thực hành" onClose={() => setActivePopup(null)}>
              <div className="space-y-6">
                <div className="flex justify-between items-center bg-white/5 p-4 rounded-3xl border border-white/10">
                  <div className="flex gap-1">
                    {(result.exercises || []).map((_, i) => (
                      <div key={i} className={`w-10 h-2 rounded-full transition-all ${i === exerciseIndex ? 'bg-cyan-500 shadow-lg shadow-cyan-500/50' : i < exerciseIndex ? 'bg-cyan-500/20' : 'bg-white/10'}`} />
                    ))}
                  </div>
                  <span className="text-[10px] font-black text-white/40 uppercase">Câu hỏi {exerciseIndex + 1}/{(result.exercises || []).length}</span>
                </div>

                {result.exercises?.[exerciseIndex] && (
                  <div className="bg-white/5 p-8 rounded-[40px] border border-white/5 relative group">
                    <div className="inline-block px-3 py-1 bg-yellow-400/20 text-yellow-500 rounded-lg text-[9px] font-black uppercase tracking-widest mb-4">
                      {result.exercises[exerciseIndex].type} practice
                    </div>
                    <InteractiveParagraph 
                      text={result.exercises[exerciseIndex].question}
                      className="text-2xl font-black text-white leading-tight mb-8"
                      onWordClick={handleWordLookup}
                    />

                    <div className="space-y-3">
                      {(result.exercises[exerciseIndex].options || []).map((option, idx) => {
                      const isCorrect = option === result.exercises[exerciseIndex].correct_answer;
                      const isSelected = option === selectedOption;
                      
                      let variant = "bg-white/5 border-white/10 text-white/70";
                      if (isAnswerChecked) {
                        if (isCorrect) variant = "bg-green-500 border-green-400 text-black shadow-lg shadow-green-500/30";
                        else if (isSelected) variant = "bg-red-500 border-red-400 text-white shadow-lg shadow-red-500/30";
                      } else if (isSelected) {
                        variant = "bg-cyan-500 border-cyan-400 text-black shadow-lg shadow-cyan-500/30";
                      }

                      return (
                        <button
                          key={idx}
                          disabled={isAnswerChecked}
                          onClick={() => setSelectedOption(option)}
                          className={`w-full p-6 rounded-[28px] border-2 text-left font-bold transition-all active:scale-[0.98] ${variant}`}
                        >
                          <div className="flex items-center gap-4">
                            <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs ${isSelected ? 'border-black/20 bg-black/10' : 'border-white/10'}`}>
                              {String.fromCharCode(65 + idx)}
                            </div>
                            {option}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {isAnswerChecked && (
                  <div className={`animate-in slide-in-from-bottom-5 p-8 rounded-[40px] border-2 ${selectedOption === result.exercises[exerciseIndex].correct_answer ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                    <div className="flex items-center gap-3 mb-3">
                      {selectedOption === result.exercises[exerciseIndex].correct_answer ? (
                        <div className="w-8 h-8 bg-green-500 text-black rounded-full flex items-center justify-center"><Target size={16} /></div>
                      ) : (
                        <div className="w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center"><AlertCircle size={16} /></div>
                      )}
                      <h4 className={`text-lg font-black uppercase tracking-tight ${selectedOption === result.exercises[exerciseIndex].correct_answer ? 'text-green-400' : 'text-red-400'}`}>
                        {selectedOption === result.exercises[exerciseIndex].correct_answer ? 'XUẤT SẮC! ĐÚNG RỒI' : 'CHƯA CHÍNH XÁC'}
                      </h4>
                    </div>
                    <p className="text-white/80 font-medium mb-4">{result.exercises[exerciseIndex].explanation}</p>
                    <button 
                      onClick={() => {
                        if (exerciseIndex < result.exercises.length - 1) {
                          setExerciseIndex(exerciseIndex + 1);
                          setSelectedOption(null);
                          setIsAnswerChecked(false);
                        } else {
                          setActivePopup(null);
                          setExerciseIndex(0);
                          setSelectedOption(null);
                          setIsAnswerChecked(false);
                        }
                      }}
                      className="w-full py-4 bg-white text-black rounded-2xl font-black uppercase text-sm"
                    >
                      {exerciseIndex < result.exercises.length - 1 ? 'Câu kế tiếp' : 'Hoàn tất'}
                    </button>
                  </div>
                )}

                {!isAnswerChecked && (
                  <button
                    disabled={!selectedOption}
                    onClick={() => setIsAnswerChecked(true)}
                    className={`w-full py-6 rounded-[32px] font-black text-xl transition-all shadow-2xl ${selectedOption ? 'bg-cyan-500 text-black shadow-cyan-500/40' : 'bg-white/5 text-white/20 border-white/5 cursor-not-allowed'}`}
                  >
                    KIỂM TRA ĐÁP ÁN
                  </button>
                )}
              </div>
            </ARPopup>
          )}

          <div className="px-8 pt-10 pb-12">
            <div className="flex justify-between items-start mb-8">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <InteractiveParagraph 
                    text={result.en} 
                    activeRange={speakingTextId === 'title-en' ? activeCharRange : null} 
                    className="text-4xl font-black text-cyan-400 leading-tight" 
                    onWordClick={handleWordLookup}
                  />
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <button onClick={() => handleSpeech(result.en, 'en-US', 'title-en')} className="p-3 bg-cyan-500/20 rounded-2xl active:scale-90 flex-shrink-0">
                        <Volume2 size={24} className="text-cyan-400" />
                      </button>
                      <button 
                        onClick={playAllNarrative} 
                        className={`px-4 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 transition-all ${isPlayingAll ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/50' : 'bg-white/10 text-white border border-white/10'}`}
                      >
                        <Sparkles size={14} className={isPlayingAll ? 'animate-spin' : ''} />
                        {isPlayingAll ? 'Đang đọc...' : 'Đọc Toàn Bộ'}
                      </button>
                    </div>
                    {/* Read All Language Options */}
                    <div className="flex gap-1 p-1 bg-white/5 rounded-xl border border-white/5 self-start">
                      {[
                        { id: 'en', label: 'EN' },
                        { id: 'vi', label: 'VI' },
                        { id: 'both', label: 'CẢ 2' }
                      ].map((mode) => (
                        <button
                          key={mode.id}
                          onClick={() => setReadAllMode(mode.id as any)}
                          className={`px-3 py-1 text-[9px] font-black uppercase transition-all rounded-lg ${readAllMode === mode.id ? 'bg-cyan-500 text-black shadow-lg' : 'text-white/40 hover:text-white'}`}
                        >
                          {mode.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <p className="text-lg font-mono opacity-40">{result.ipa}</p>
                <div className="flex items-center gap-3 mt-2">
                  <p className="text-3xl font-black text-white/90">{result.vi}</p>
                  <button onClick={() => handleSpeech(result.vi, 'vi-VN', 'title-vi')} className="p-2 bg-white/5 rounded-xl border border-white/10"><Volume2 size={16} className="text-pink-400" /></button>
                </div>
              </div>
            </div>

            <div className="space-y-6 mb-10">
              {/* Encyclopedia Expert Insights */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Scientific */}
                {(result.expert_insights?.scientific_en || result.expert_insights?.scientific_vi) && (
                  <div id="insight-sci" className="bg-white/5 rounded-[24px] p-5 border border-white/5 group relative">
                    <h3 className="text-[10px] font-black uppercase text-blue-400 mb-3 tracking-widest flex items-center gap-2">
                      <Zap size={12}/> Encyclopedia: Khoa học (Science)
                    </h3>
                    <div className="space-y-4">
                      {result.expert_insights.scientific_en && (
                        <div className="relative group/text">
                          <p className="text-xs uppercase font-black text-white/20 mb-1 tracking-tighter">English</p>
                          <HighlightedText 
                            text={result.expert_insights.scientific_en} 
                            activeRange={speakingTextId === 'insight-sci-en' ? activeCharRange : null}
                            className="text-sm font-medium leading-relaxed text-white/90"
                          />
                          <button onClick={() => handleSpeech(result.expert_insights?.scientific_en || "", 'en-US', 'insight-sci-en')} className="absolute -top-1 right-0 p-1.5 opacity-0 group-hover/text:opacity-100 transition-opacity bg-blue-500/10 rounded-lg"><Volume2 size={12} className="text-blue-400" /></button>
                        </div>
                      )}
                      {result.expert_insights.scientific_vi && (
                        <div className="relative group/text border-t border-white/5 pt-3">
                          <p className="text-xs uppercase font-black text-white/20 mb-1 tracking-tighter">Tiếng Việt</p>
                          <HighlightedText 
                            text={result.expert_insights.scientific_vi} 
                            activeRange={speakingTextId === 'insight-sci-vi' ? activeCharRange : null}
                            className="text-sm font-medium leading-relaxed text-white/80 italic"
                          />
                          <button onClick={() => handleSpeech(result.expert_insights?.scientific_vi || "", 'vi-VN', 'insight-sci-vi')} className="absolute -top-1 right-0 p-1.5 opacity-0 group-hover/text:opacity-100 transition-opacity bg-blue-500/10 rounded-lg"><Volume2 size={12} className="text-blue-400" /></button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Technical */}
                {(result.expert_insights?.technical_en || result.expert_insights?.technical_vi) && (
                  <div id="insight-tech" className="bg-white/5 rounded-[24px] p-5 border border-white/5 group relative">
                    <h3 className="text-[10px] font-black uppercase text-cyan-400 mb-3 tracking-widest flex items-center gap-2">
                      <Target size={12}/> Kỹ thuật & Công nghệ (Tech)
                    </h3>
                    <div className="space-y-4">
                      {result.expert_insights.technical_en && (
                        <div className="relative group/text">
                          <p className="text-xs uppercase font-black text-white/20 mb-1 tracking-tighter">English</p>
                          <HighlightedText 
                            text={result.expert_insights.technical_en} 
                            activeRange={speakingTextId === 'insight-tech-en' ? activeCharRange : null}
                            className="text-sm font-medium leading-relaxed text-white/90"
                          />
                          <button onClick={() => handleSpeech(result.expert_insights?.technical_en || "", 'en-US', 'insight-tech-en')} className="absolute -top-1 right-0 p-1.5 opacity-0 group-hover/text:opacity-100 transition-opacity bg-cyan-500/10 rounded-lg"><Volume2 size={12} className="text-cyan-400" /></button>
                        </div>
                      )}
                      {result.expert_insights.technical_vi && (
                        <div className="relative group/text border-t border-white/5 pt-3">
                          <p className="text-xs uppercase font-black text-white/20 mb-1 tracking-tighter">Tiếng Việt</p>
                          <HighlightedText 
                            text={result.expert_insights.technical_vi} 
                            activeRange={speakingTextId === 'insight-tech-vi' ? activeCharRange : null}
                            className="text-sm font-medium leading-relaxed text-white/80 italic"
                          />
                          <button onClick={() => handleSpeech(result.expert_insights?.technical_vi || "", 'vi-VN', 'insight-tech-vi')} className="absolute -top-1 right-0 p-1.5 opacity-0 group-hover/text:opacity-100 transition-opacity bg-cyan-500/10 rounded-lg"><Volume2 size={12} className="text-cyan-400" /></button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Educational */}
                {(result.expert_insights?.educational_en || result.expert_insights?.educational_vi) && (
                  <div id="insight-edu" className="bg-white/5 rounded-[24px] p-5 border border-white/5 group relative">
                    <h3 className="text-[10px] font-black uppercase text-yellow-400 mb-3 tracking-widest flex items-center gap-2">
                      <BookOpen size={12}/> Giáo dục & Bài học (Lesson)
                    </h3>
                    <div className="space-y-4">
                      {result.expert_insights.educational_en && (
                        <div className="relative group/text">
                          <p className="text-xs uppercase font-black text-white/20 mb-1 tracking-tighter">English</p>
                          <HighlightedText 
                            text={result.expert_insights.educational_en} 
                            activeRange={speakingTextId === 'insight-edu-en' ? activeCharRange : null}
                            className="text-sm font-medium leading-relaxed text-white/90"
                          />
                          <button onClick={() => handleSpeech(result.expert_insights?.educational_en || "", 'en-US', 'insight-edu-en')} className="absolute -top-1 right-0 p-1.5 opacity-0 group-hover/text:opacity-100 transition-opacity bg-yellow-500/10 rounded-lg"><Volume2 size={12} className="text-yellow-400" /></button>
                        </div>
                      )}
                      {result.expert_insights.educational_vi && (
                        <div className="relative group/text border-t border-white/5 pt-3">
                          <p className="text-xs uppercase font-black text-white/20 mb-1 tracking-tighter">Tiếng Việt</p>
                          <HighlightedText 
                            text={result.expert_insights.educational_vi} 
                            activeRange={speakingTextId === 'insight-edu-vi' ? activeCharRange : null}
                            className="text-sm font-medium leading-relaxed text-white/80 italic"
                          />
                          <button onClick={() => handleSpeech(result.expert_insights?.educational_vi || "", 'vi-VN', 'insight-edu-vi')} className="absolute -top-1 right-0 p-1.5 opacity-0 group-hover/text:opacity-100 transition-opacity bg-yellow-500/10 rounded-lg"><Volume2 size={12} className="text-yellow-400" /></button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Fashion */}
                {result.expert_insights?.fashion && (
                  <div id="insight-fashion" className="bg-white/5 rounded-[24px] p-5 border border-white/5 group relative">
                    <h3 className="text-[10px] font-black uppercase text-pink-400 mb-3 tracking-widest flex items-center gap-2">
                      <Sparkles size={12}/> Fashion Specialist Analysis
                    </h3>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3 mb-2">
                        <div className="bg-white/5 p-2 rounded-xl">
                          <p className="text-[8px] uppercase font-black text-white/30 mb-0.5">Price</p>
                          <p className="text-[11px] font-bold text-pink-400">{result.expert_insights.fashion.estimated_price_en}</p>
                        </div>
                        <div className="bg-white/5 p-2 rounded-xl">
                          <p className="text-[8px] uppercase font-black text-white/30 mb-0.5">Age</p>
                          <p className="text-[11px] font-bold text-white/80">{result.expert_insights.fashion.age_group_en}</p>
                        </div>
                      </div>
                      
                      <div className="relative group/text">
                        <p className="text-xs uppercase font-black text-white/20 mb-1 tracking-tighter">Style Analysis (EN)</p>
                        <p className="text-sm font-medium leading-relaxed text-white/90">{result.expert_insights.fashion.style_analysis_en}</p>
                        <button onClick={() => handleSpeech(result.expert_insights?.fashion?.style_analysis_en || "", 'en-US', 'insight-fashion-en')} className="absolute -top-1 right-0 p-1.5 opacity-0 group-hover/text:opacity-100 transition-opacity bg-pink-500/10 rounded-lg"><Volume2 size={12} className="text-pink-400" /></button>
                      </div>

                      <div className="relative group/text border-t border-white/5 pt-3">
                        <p className="text-xs uppercase font-black text-white/20 mb-1 tracking-tighter">Phân tích phong cách (VI)</p>
                        <p className="text-sm font-medium leading-relaxed text-white/80 italic">{result.expert_insights.fashion.style_analysis_vi}</p>
                        <button onClick={() => handleSpeech(result.expert_insights?.fashion?.style_analysis_vi || "", 'vi-VN', 'insight-fashion-vi')} className="absolute -top-1 right-0 p-1.5 opacity-0 group-hover/text:opacity-100 transition-opacity bg-pink-500/10 rounded-lg"><Volume2 size={12} className="text-pink-400" /></button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Food Additives Toxicology Analysis */}
              {result.expert_insights?.additives && result.expert_insights.additives.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-[10px] font-black uppercase text-red-500 tracking-[0.2em] flex items-center gap-2 mb-2">
                    <AlertCircle size={14} /> Phân tích độc tính & Phụ gia (Toxicology)
                  </h3>
                  {(result.expert_insights?.additives || []).map((add, idx) => (
                    <div key={idx} id={`additive-${idx}`} className="bg-red-500/5 rounded-[32px] p-6 border border-red-500/20 group relative overflow-hidden">
                      <div className="absolute top-6 right-6">
                        <button 
                          onClick={() => handleSpeech(`Phân tích ${add.code}. ${add.name}. Tác dụng: ${add.function}. Tác hại: ${add.harmful_effects}. Đào thải: ${add.metabolism_time}`, 'vi-VN', `additive-${idx}`)} 
                          className="p-3 bg-red-500/20 rounded-2xl text-red-400 active:scale-90 transition-all"
                        >
                          <Volume2 size={20} />
                        </button>
                      </div>
                      
                      <div className="flex items-center gap-3 mb-6">
                        <div className="px-4 py-2 bg-red-500 text-black font-black rounded-xl text-lg tracking-tighter">
                          {add.code}
                        </div>
                        <div className="flex-1">
                          <h4 className="text-xl font-black text-white leading-tight">{add.name}</h4>
                          <span className="text-[8px] uppercase font-bold text-red-400/60 tracking-widest leading-none">High-Risk Substance Analysis</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4 text-left">
                        <div id={`add-func-${idx}`} className="bg-black/40 p-4 rounded-2xl border border-white/5 relative group">
                          <span className="text-[8px] uppercase text-white/40 block mb-1 font-bold tracking-widest">Tác dụng (Function)</span>
                          <HighlightedText 
                            text={add.function} 
                            activeRange={speakingTextId === `add-func-${idx}` ? activeCharRange : null}
                            className="text-sm font-medium text-white/90"
                          />
                          <button onClick={() => handleSpeech(add.function, 'vi-VN', `add-func-${idx}`)} className="absolute top-4 right-4 p-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white/5 rounded-lg"><Volume2 size={12} className="text-white/40" /></button>
                        </div>
                        
                        <div id={`add-harm-${idx}`} className="bg-red-950/20 p-4 rounded-2xl border border-red-500/10 relative group">
                          <span className="text-[8px] uppercase text-red-400 block mb-1 font-bold tracking-widest">Tác hại & Nguy cơ (Harmful Effects)</span>
                          <HighlightedText 
                            text={add.harmful_effects} 
                            activeRange={speakingTextId === `add-harm-${idx}` ? activeCharRange : null}
                            className="text-sm font-bold text-red-200"
                          />
                          <button onClick={() => handleSpeech(add.harmful_effects, 'vi-VN', `add-harm-${idx}`)} className="absolute top-4 right-4 p-2 opacity-0 group-hover:opacity-100 transition-opacity bg-red-500/10 rounded-lg"><Volume2 size={12} className="text-red-400" /></button>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div id={`add-dose-${idx}`} className="bg-black/40 p-4 rounded-2xl border border-white/5 relative group">
                            <span className="text-[8px] uppercase text-white/40 block mb-1 font-bold tracking-widest">Liều lượng (ADI)</span>
                            <HighlightedText 
                              text={add.dosage} 
                              activeRange={speakingTextId === `add-dose-${idx}` ? activeCharRange : null}
                              className="text-xs font-bold text-cyan-400"
                            />
                             <button onClick={() => handleSpeech(add.dosage, 'vi-VN', `add-dose-${idx}`)} className="absolute top-4 right-4 p-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white/5 rounded-lg"><Volume2 size={10} className="text-white/40" /></button>
                          </div>
                          <div id={`add-meta-${idx}`} className="bg-black/40 p-4 rounded-2xl border border-white/5 relative group">
                            <span className="text-[8px] uppercase text-white/40 block mb-1 font-bold tracking-widest">Đào thải</span>
                            <HighlightedText 
                              text={add.metabolism_time} 
                              activeRange={speakingTextId === `add-meta-${idx}` ? activeCharRange : null}
                              className="text-xs font-bold text-yellow-400"
                            />
                            <button onClick={() => handleSpeech(add.metabolism_time, 'vi-VN', `add-meta-${idx}`)} className="absolute top-4 right-4 p-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white/5 rounded-lg"><Volume2 size={10} className="text-white/40" /></button>
                          </div>
                        </div>

                        <div id={`add-long-${idx}`} className="bg-red-500/10 p-4 rounded-2xl border border-red-500/20 relative group">
                          <span className="text-[8px] uppercase text-red-400 block mb-1 font-bold tracking-widest">Hệ lụy lâu dài</span>
                          <HighlightedText 
                            text={add.long_term_risks} 
                            activeRange={speakingTextId === `add-long-${idx}` ? activeCharRange : null}
                            className="text-sm font-bold text-white leading-relaxed"
                          />
                          <button onClick={() => handleSpeech(add.long_term_risks, 'vi-VN', `add-long-${idx}`)} className="absolute top-4 right-4 p-2 opacity-0 group-hover:opacity-100 transition-opacity bg-red-500/10 rounded-lg"><Volume2 size={12} className="text-red-400" /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Fashion Expert Analysis */}
              {result.expert_insights?.fashion && (
                <div id="insight-fashion" className="bg-purple-600/10 rounded-[32px] p-6 border border-purple-500/20 shadow-2xl group relative overflow-hidden">
                  <div className="absolute top-6 right-6 flex gap-2">
                    <button onClick={() => handleSpeech(result.expert_insights?.fashion?.style_analysis || "", 'vi-VN', 'insight-fashion')} className="p-2 opacity-0 group-hover:opacity-100 transition-opacity bg-purple-500/20 rounded-xl"><Volume2 size={16} className="text-purple-400" /></button>
                  </div>
                  <h3 className="text-[10px] font-black uppercase text-purple-400 mb-4 tracking-widest flex items-center gap-2">
                    <Sparkles size={14}/> Fashion Specialist Analysis
                  </h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-black/40 p-4 rounded-2xl border border-white/5">
                        <span className="text-[8px] uppercase text-white/40 block mb-1">Lứa tuổi phù hợp</span>
                        <span className="font-bold text-white tracking-tight">{result.expert_insights.fashion.age_group}</span>
                      </div>
                      <div className="bg-black/40 p-4 rounded-2xl border border-white/5">
                        <span className="text-[8px] uppercase text-white/40 block mb-1">Giá tiền ước tính</span>
                        <span className="font-bold text-cyan-400 tracking-tight">{result.expert_insights.fashion.estimated_price}</span>
                      </div>
                    </div>
                    <div className="bg-black/40 p-4 rounded-2xl border border-white/5">
                      <span className="text-[8px] uppercase text-white/40 block mb-1">Màu da thích hợp</span>
                      <p className="font-bold text-white text-sm tracking-tight">{result.expert_insights.fashion.skin_tone_compatibility}</p>
                    </div>
                    <div className="p-4 bg-purple-500/5 rounded-2xl border border-purple-500/10">
                      <span className="text-[8px] uppercase text-purple-400/60 block mb-1">Nhận xét phong cách</span>
                      <HighlightedText 
                        text={result.expert_insights.fashion.style_analysis} 
                        activeRange={speakingTextId === 'insight-fashion' ? activeCharRange : null}
                        className="text-lg font-bold text-purple-50 leading-snug"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Analysis Card */}
              <div className="bg-white/5 rounded-[32px] p-6 border border-white/5 relative group">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-cyan-400/80 uppercase text-[10px] font-black tracking-widest">
                    {mediaType === 'video' ? <Video size={14}/> : <Search size={14}/>} 
                    {mediaType === 'video' ? 'Phân tích Video/Hành động' : 'Phân tích ngoại hình'}
                  </div>
                  <div className="flex gap-2 text-white">
                    <button onClick={() => handleSpeech(result.details_en, 'en-US', 'details_en')} className="p-2 bg-white/10 rounded-xl hover:bg-cyan-500/20 transition-colors"><Volume2 size={16}/></button>
                    <button onClick={() => handleSpeech(result.details_vi, 'vi-VN', 'details_vi')} className="p-2 bg-white/10 rounded-xl hover:bg-cyan-500/20 transition-colors"><span className="text-[10px] font-bold">VI</span></button>
                  </div>
                </div>
                
                <InteractiveParagraph 
                  text={result.details_en} 
                  activeRange={speakingTextId === 'details_en' ? activeCharRange : null} 
                  className="text-xl font-bold leading-relaxed mb-4 text-white/90"
                  onWordClick={handleWordLookup}
                />
                
                <div id="details-vi" className="border-t border-white/5 pt-4 group/vi relative">
                   <HighlightedText 
                    text={result.details_vi} 
                    activeRange={speakingTextId === 'details_vi' ? activeCharRange : null} 
                    className="text-xl font-medium leading-relaxed text-white/60" 
                  />
                </div>
              </div>

              {/* Predictions Card */}
              <div className="bg-cyan-500/10 rounded-[32px] p-6 border border-cyan-500/20 relative group overflow-hidden">
                <div className="flex items-center justify-between mb-4 text-white">
                  <div className="flex items-center gap-2 text-cyan-400 uppercase text-[10px] font-black tracking-widest"><Zap size={14}/> Nhận xét {mediaType === 'video' ? 'diễn biến' : 'đời sống'} (AI)</div>
                  <div className="flex gap-2">
                    <button onClick={() => handleSpeech(result.predictions_en || '', 'en-US', 'pred_en')} className="p-2 bg-white/10 rounded-xl hover:bg-cyan-500/20 transition-colors"><Volume2 size={16}/></button>
                    <button onClick={() => handleSpeech(result.predictions_vi || '', 'vi-VN', 'pred_vi')} className="p-2 bg-white/10 rounded-xl hover:bg-cyan-500/20 transition-colors"><span className="text-[10px] font-bold text-pink-400">VI</span></button>
                  </div>
                </div>
                
                <InteractiveParagraph 
                  text={result.predictions_en || ''} 
                  activeRange={speakingTextId === 'pred_en' ? activeCharRange : null} 
                  className="text-2xl font-black text-white/90 mb-3" 
                  onWordClick={handleWordLookup}
                />
                
                <div id="pred_vi" className="border-t border-cyan-400/10 pt-4">
                  <HighlightedText 
                    text={result.predictions_vi || ''} 
                    activeRange={speakingTextId === 'pred_vi' ? activeCharRange : null} 
                    className="text-2xl font-bold text-cyan-400/80" 
                  />
                </div>
              </div>
            </div>

            {/* Example Analysis Card */}
            <div className="mb-10 text-white">
              <div className="flex items-center gap-2 mb-4 text-white/40 uppercase text-[10px] font-black tracking-widest"><Sparkles size={14}/> Cấu trúc câu ví dụ</div>
              <div className="bg-white/5 rounded-[32px] p-6 border border-white/5 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[9px] font-bold text-white/30 tracking-widest uppercase">Example Analysis</span>
                  <div className="flex gap-2">
                    <button onClick={() => handleSpeech(result.example_en, 'en-US', 'example_en')} className="p-2 bg-white/10 rounded-xl hover:bg-cyan-500/20 transition-colors"><Volume2 size={16}/></button>
                    <button onClick={() => handleSpeech(result.example_vi, 'vi-VN', 'example_vi')} className="p-2 bg-white/10 rounded-xl hover:bg-cyan-500/20 transition-colors text-[10px] font-bold text-pink-400">VI</button>
                  </div>
                </div>
                <InteractiveParagraph 
                  text={result.example_en} 
                  activeRange={speakingTextId === 'example_en' ? activeCharRange : null} 
                  className="text-2xl font-black text-white/90 italic leading-tight mb-4" 
                  onWordClick={handleWordLookup}
                />
                <div id="example_vi" className="border-t border-white/5 pt-4">
                   <HighlightedText 
                    text={result.example_vi} 
                    activeRange={speakingTextId === 'example_vi' ? activeCharRange : null} 
                    className="text-base text-white/40" 
                  />
                </div>
              </div>
              
              <div className="flex flex-wrap gap-2 mb-6">
                {(result.grammar_analysis || []).map((token, i) => (
                  <div key={i} className={`px-3 py-2 rounded-xl border text-sm font-bold flex flex-col items-center gap-1 shadow-sm ${GRAMMAR_COLORS[token.type] || GRAMMAR_COLORS.other}`}>
                    <span>{token.text}</span>
                    <span className="text-[8px] uppercase opacity-60 tracking-tighter">{token.type}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Vocabulary Breakdown Card */}
            <div className="mb-10 text-white">
              <div className="flex items-center gap-2 mb-4 text-white/40 uppercase text-[10px] font-black tracking-widest"><BookOpen size={14}/> Từ vựng chuyên môn</div>
              <div className="space-y-4">
                {(result.vocabulary_breakdown || []).map((v, i) => (
                  <div key={i} className="bg-white/5 p-6 rounded-[32px] border border-white/5 flex items-center justify-between group">
                    <div className="flex-1 pr-4">
                      <div className="flex items-center gap-2 mb-1">
                        <HighlightedText 
                          text={v.term} 
                          activeRange={speakingTextId === `v-${i}` ? activeCharRange : null} 
                          className="text-xl font-black text-cyan-400" 
                        />
                        <span className="text-[9px] px-2 py-0.5 bg-cyan-400/20 text-cyan-400 rounded-lg font-black uppercase">{v.type}</span>
                      </div>
                      <p className="text-sm font-mono opacity-40 mb-1">{v.ipa}</p>
                      <p className="text-base font-semibold text-white/90">{v.meaning_vi}</p>
                    </div>
                    <button onClick={() => handleSpeech(v.term, 'en-US', `v-${i}`)} className="p-4 bg-white/5 rounded-2xl group-active:scale-90 transition-all shadow-lg border border-white/5 flex-shrink-0 text-white"><Volume2 size={24} className="text-cyan-400"/></button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-4 mb-20">
              <button 
                onClick={downloadHtmlReport} 
                className="flex-1 py-7 bg-cyan-500 text-black rounded-[36px] font-black text-xl shadow-2xl active:scale-[0.98] transition-all tracking-tighter uppercase flex items-center justify-center gap-3"
              >
                <Download size={24} /> TẢI BÁO CÁO
              </button>
              <button 
                onClick={close} 
                className="flex-1 py-7 bg-white text-black rounded-[36px] font-black text-xl shadow-2xl active:scale-[0.98] transition-all tracking-tighter uppercase"
              >
                TIẾP TỤC
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Start Landing View */}
      {!isCameraActive && !result && (
        <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center p-10 bg-black text-center overflow-y-auto overflow-x-hidden">
           <div className="flex gap-4 mb-8">
              <button 
                onClick={() => setActiveTab('camera')}
                className={`px-6 py-2 rounded-full font-bold text-xs uppercase tracking-widest transition-all ${activeTab === 'camera' ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/40' : 'bg-white/5 text-white/40 border border-white/5'}`}
              >
                Trang chủ
              </button>
              <button 
                onClick={() => setActiveTab('doc')}
                className={`px-6 py-2 rounded-full font-bold text-xs uppercase tracking-widest transition-all ${activeTab === 'doc' ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/40' : 'bg-white/5 text-white/40 border border-white/5'}`}
              >
                Tài liệu Prompt
              </button>
           </div>

           {activeTab === 'doc' ? (
             <div className="w-full max-w-2xl text-left bg-white/5 rounded-[40px] p-8 border border-white/10 backdrop-blur-3xl animate-in fade-in zoom-in duration-500">
               <div className="flex items-center gap-3 mb-8">
                  <div className="w-12 h-12 bg-purple-500/20 rounded-2xl flex items-center justify-center text-purple-400 border border-purple-500/30">
                    <BookOpen size={24} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-white">Master App Prompt</h2>
                    <p className="text-white/40 text-xs font-bold uppercase tracking-widest">Building Block of Gemini AR Lens</p>
                  </div>
               </div>
               
               <div className="space-y-6 font-mono text-[13px] leading-relaxed text-white/70 overflow-y-auto max-h-[60vh] pr-4 no-scrollbar">
                 <section className="space-y-2">
                   <h3 className="text-purple-400 font-bold border-b border-purple-500/20 pb-1 italic"># System Context</h3>
                   <p>"Bạn là một Chuyên gia Bách khoa toàn thư đa năng, Cố vấn Dinh dưỡng/Độc tính học và Stylist thời trang cao cấp. Ứng dụng này là một AR Lens thông minh giúp người dùng học tập từ thế giới thực qua hình ảnh/video."</p>
                 </section>

                 <section className="space-y-2">
                   <h3 className="text-cyan-400 font-bold border-b border-cyan-500/20 pb-1 italic"># Multi-Topic Analysis Logic</h3>
                   <p>Dựa trên 'selectedTopic' và 'userPrompt', hãy điều chỉnh độ sâu kiến thức:</p>
                   <ul className="list-disc ml-5 space-y-1">
                     <li>Y Tế: Tả kỹ các chỉ số sức khỏe, cảnh báo an toàn.</li>
                     <li>Thời Trang: Phân tích style, tone da, giá thành, lứa tuổi.</li>
                     <li>Khoa Học: Phân loại sinh học, vật lý, kỹ thuật vận hành.</li>
                   </ul>
                 </section>

                 <section className="space-y-2">
                   <h3 className="text-red-400 font-bold border-b border-red-500/20 pb-1 italic"># Food Additives Deep-Dive (Toxicology)</h3>
                   <p>Nếu nhận diện được mã số như 451i, 621, 211... hãy trích xuất dưới dạng JSON mảng 'additives' với các trường:</p>
                   <div className="bg-black/40 p-4 rounded-xl border border-white/5 select-all">
                     - code: Mã chất<br/>
                     - function: Vai trò trong công nghiệp<br/>
                     - harmful_effects: Tác hại trực tiếp<br/>
                     - metabolism_time: Thời gian đào thải khỏi cơ thể<br/>
                     - long_term_risks: Hệ lụy bệnh lý nếu dùng lâu dài
                   </div>
                 </section>

                 <section className="space-y-2">
                   <h3 className="text-yellow-400 font-bold border-b border-yellow-500/20 pb-1 italic"># Linguistics & Voice Synthesis</h3>
                   <p>"Tạo ra các câu ví dụ 'example_en' chuẩn học thuật. Phân tích ngữ pháp (Noun, Verb, Adj...) và từ vựng chi tiết. Đảm bảo hỗ trợ giọng đọc Tiếng Việt chuẩn (Linh/Google vi-VN) để đọc các phân tích bách khoa."</p>
                 </section>

                 <section className="space-y-2">
                   <h3 className="text-green-400 font-bold border-b border-green-500/20 pb-1 italic"># Interaction Design</h3>
                   <p>"Giao diện phải mang tính tương lai (Futuristic/Glassmorphism). Khung hình AR có thể kéo thả và thay đổi kích thước. Hỗ trợ chế độ 'Read All' có highlight chữ đang đọc đồng bộ với Speech Synthesis."</p>
                 </section>
               </div>
               
               <button onClick={() => setActiveTab('camera')} className="w-full mt-8 py-4 bg-purple-500 text-white rounded-2xl font-black text-sm active:scale-95 transition-all outline-none">TÔI ĐÃ HIỂU - QUAY LẠI TRANG CHỦ</button>
             </div>
           ) : (
             <>
               <div className="w-28 h-28 bg-cyan-500/20 rounded-[48px] flex items-center justify-center mb-10 border border-cyan-400/30 shadow-[0_0_50px_rgba(34,211,238,0.2)] animate-pulse flex-shrink-0">
                  <Target size={56} className="text-cyan-400" />
               </div>
               <h1 className="text-5xl md:text-6xl font-black mb-4 tracking-tighter text-white">Gemini AR Lens</h1>
               <p className="text-white/50 mb-10 text-lg md:text-xl leading-relaxed max-w-sm">Học tiếng Anh & Khám phá tri thức qua thực tế tăng cường.</p>
               
               <div className="flex flex-col gap-6 w-full max-w-sm mb-12">
                 <div className="space-y-4 text-left">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400 ml-4">Lĩnh vực trọng tâm</label>
                    <div className="flex gap-2">
                      <select 
                        value={selectedTopic}
                        onChange={(e) => setSelectedTopic(e.target.value)}
                        className="flex-1 glass border border-white/20 rounded-[28px] px-6 py-5 text-sm font-black text-white appearance-none outline-none focus:border-cyan-400 transition-all shadow-xl"
                      >
                        {TOPICS.map(t => <option key={t} value={t} className="bg-zinc-900">{t}</option>)}
                      </select>
                      <div className="w-16 h-16 glass rounded-[28px] flex items-center justify-center text-cyan-400 border border-white/10 shadow-lg">
                        <BookOpen size={24} />
                      </div>
                    </div>
                 </div>

                 <div className="space-y-4 text-left">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 ml-4">Yêu cầu riêng cho AI (Tùy chọn)</label>
                    <textarea 
                      placeholder="Ví dụ: Phân tích sâu về thời trang vintage, hoặc cảnh báo độc tính chất phụ gia..." 
                      value={customPrompt}
                      onChange={(e) => setCustomPrompt(e.target.value)}
                      className="w-full glass border border-white/20 rounded-[32px] px-6 py-5 text-sm font-medium outline-none focus:border-cyan-400 transition-all placeholder:text-white/20 min-h-[120px] resize-none shadow-xl text-white"
                    />
                 </div>
               </div>

               <div className="flex flex-col gap-4 w-full max-w-xs">
                <button onClick={startCamera} className="w-full py-7 bg-white text-black rounded-[36px] font-black text-2xl shadow-2xl active:scale-95 transition-all outline-none">KHÁM PHÁ NGAY</button>
                <button onClick={() => fileInputRef.current?.click()} className="w-full py-5 bg-white/10 text-white rounded-[32px] font-bold text-lg border border-white/20 active:scale-95 transition-all flex items-center justify-center gap-3 outline-none uppercase tracking-wide">
                  <Upload size={20} /> Tải ảnh / video
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  accept="image/*,video/*" 
                  className="hidden" 
                />
               </div>
             </>
           )}
        </div>
      )}

      {error && (
        <div className="absolute inset-0 z-[110] flex flex-col items-center justify-center p-8 bg-black/95 backdrop-blur-3xl text-center" onClick={() => setError(null)}>
          <AlertCircle size={80} className="text-red-500 mb-8" />
          <p className="text-white text-3xl font-black mb-12">{error}</p>
          <button className="px-12 py-5 bg-white text-black rounded-3xl font-black text-xl">ĐÓNG</button>
        </div>
      )}

      {isIdentifying && (
        <div className="absolute inset-0 z-[80] bg-black/70 backdrop-blur-md flex flex-col items-center justify-center">
          <div className="w-20 h-20 border-4 border-cyan-400/20 border-t-cyan-400 rounded-full animate-spin mb-6" />
          <p className="text-cyan-400 font-black uppercase tracking-widest text-sm animate-pulse">Đang quét đối tượng...</p>
        </div>
      )}

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

export default App;
