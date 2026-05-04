
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, X, Volume2, Info, AlertCircle, Sparkles, Mic, MicOff, Languages, BookOpen, MessageSquare, Zap, User, Target, Search, UserRound, UserRoundPlus, Maximize2, Upload, Image as ImageIcon } from 'lucide-react';
import { identifyObject, translateText } from './services/geminiService';
import { RecognitionResult, TranslationResponse, GrammarToken } from './types';

const LANGUAGES = [
  { label: 'Anh', code: 'en-US', name: 'English' },
  { label: 'Việt', code: 'vi-VN', name: 'Vietnamese' },
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

const HighlightedText: React.FC<{ text: string; activeRange: [number, number] | null; className?: string }> = ({ text, activeRange, className }) => {
  if (!activeRange || !text) return <p className={className}>{text}</p>;
  
  const [start, length] = activeRange;
  // Safety checks to prevent slicing errors
  const safeStart = Math.max(0, Math.min(start, text.length));
  const safeLength = Math.max(0, Math.min(length, text.length - safeStart));

  const before = text.slice(0, safeStart);
  const active = text.slice(safeStart, safeStart + safeLength);
  const after = text.slice(safeStart + safeLength);

  return (
    <p className={className}>
      {before}
      <span className="bg-yellow-400 text-black px-0.5 rounded transition-all duration-75 shadow-[0_0_15px_rgba(250,204,21,0.6)] font-bold">{active}</span>
      {after}
    </p>
  );
};

const App: React.FC = () => {
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isIdentifying, setIsIdentifying] = useState(false);
  const [result, setResult] = useState<RecognitionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [voiceGender, setVoiceGender] = useState<'male' | 'female'>('female');
  const [debugStatus, setDebugStatus] = useState<string>("Sẵn sàng");
  
  const [framePos, setFramePos] = useState({ x: 50, y: 50 }); 
  const [frameSize, setFrameSize] = useState({ w: 40, h: 30 });
  const [interactionMode, setInteractionMode] = useState<'none' | 'dragging' | 'resizing'>('none');
  
  const [speakingTextId, setSpeakingTextId] = useState<string | null>(null);
  const [activeCharRange, setActiveCharRange] = useState<[number, number] | null>(null);

  const [sourceLang, setSourceLang] = useState(LANGUAGES[0]);
  const [targetLang, setTargetLang] = useState(LANGUAGES[1]);
  const [isListening, setIsListening] = useState(false);
  const [transcribedText, setTranscribedText] = useState("");
  const [translationResult, setTranslationResult] = useState<TranslationResponse | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
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
      ? ['Samantha', 'Aria', 'Jenny', 'Google US English', 'Victoria', 'Zira', 'Female']
      : ['Alex', 'Guy', 'Google US English', 'Microsoft David', 'Male'];

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

  const handleSpeech = (text: string, lang: string = 'en-US', id: string = 'global') => {
    if (!window.speechSynthesis) return;
    
    // Clear and reset
    window.speechSynthesis.cancel();
    setSpeakingTextId(null);
    setActiveCharRange(null);
    
    if (!text || text.trim().length === 0) return;

    // Normalizing text helps boundary event indexing
    const normalizedText = text.trim().replace(/\s+/g, ' ');
    const utterance = new SpeechSynthesisUtterance(normalizedText);
    
    const voice = getBestVoice(lang, voiceGender);
    if (voice) {
      utterance.voice = voice;
      // Important: lang must match voice.lang exactly for some mobile engines
      utterance.lang = voice.lang; 
    } else {
      utterance.lang = lang;
    }
    
    // Optimal speeds for mobile boundary events
    utterance.rate = 0.9;
    utterance.pitch = (voiceGender === 'female' && voice?.name.includes('Samantha')) ? 1.1 : 1.0;

    utterance.onboundary = (event) => {
      if (event.name === 'word') {
        const charIndex = event.charIndex;
        let charLength = event.charLength;

        // Robust fallback for missing charLength on mobile
        if (charLength === undefined || charLength === 0) {
          const remaining = normalizedText.substring(charIndex);
          // Look for next space or punctuation
          const nextBoundary = remaining.search(/[\s,.;:!?()[\]{}]/);
          charLength = nextBoundary === -1 ? remaining.length : nextBoundary;
        }

        // Update state in an animation frame for smoothness on mobile
        requestAnimationFrame(() => {
          setActiveCharRange([charIndex, charLength]);
        });
      }
    };

    utterance.onstart = () => {
      setSpeakingTextId(id);
      // Force initial highlight if index 0 isn't caught by onboundary (Safari fix)
      if (!activeCharRange) {
        const firstWordEnd = normalizedText.search(/[\s,.;:!?]/);
        const firstLength = firstWordEnd === -1 ? normalizedText.length : firstWordEnd;
        setActiveCharRange([0, firstLength]);
      }
    };

    utterance.onend = () => { 
      setSpeakingTextId(null); 
      setActiveCharRange(null); 
    };

    utterance.onerror = (e) => { 
      console.error("SpeechSynthesis Error:", e);
      setSpeakingTextId(null); 
      setActiveCharRange(null); 
    };

    // Store in ref to prevent garbage collection on mobile
    currentUtteranceRef.current = utterance;
    
    // Short delay helps mobile engines wake up after cancel()
    setTimeout(() => {
      window.speechSynthesis.speak(utterance);
    }, 50);
  };

  const handleInteraction = (e: React.MouseEvent | React.TouchEvent) => {
    if (interactionMode === 'none' || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;

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
    processImage(base64Image);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      processImage(base64);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const processImage = async (base64Image: string) => {
    setIsIdentifying(true);
    setDebugStatus("Đang phân tích hình ảnh...");
    try {
      const aiResult = await identifyObject(base64Image);
      setResult(aiResult);
      setDebugStatus("Hoàn tất!");
      // Initial speech for the title
      handleSpeech(aiResult.en, 'en-US', 'title');
    } catch (err: any) {
      setError("AI không tìm thấy đối tượng. Hãy thử lại.");
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
      className="relative w-full h-[100dvh] bg-black overflow-hidden flex flex-col text-white"
      onMouseMove={handleInteraction}
      onTouchMove={handleInteraction}
      onMouseUp={() => setInteractionMode('none')}
      onTouchEnd={() => setInteractionMode('none')}
    >
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
        <div className="px-3 py-1.5 bg-black/80 rounded-xl border border-white/20 shadow-xl">
          <p className="text-[10px] font-mono text-cyan-400 font-bold uppercase tracking-tight">{debugStatus}</p>
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
                className="w-14 h-14 rounded-2xl glass flex items-center justify-center border border-white/10 active:scale-95 transition-all"
                title="Tải ảnh lên"
              >
                <ImageIcon size={24} className="text-cyan-400" />
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                accept="image/*" 
                className="hidden" 
              />
           </div>
           <p className="px-5 py-2 glass rounded-full text-[10px] font-black tracking-widest uppercase text-white/50 border border-white/5">
             Detec đối tượng trong khung xanh hoặc Tải ảnh lên
           </p>
        </div>
      )}

      {/* Bottom Sheet Results */}
      <div className={`absolute bottom-0 left-0 right-0 z-[70] transition-all duration-700 pb-10 rounded-t-[48px] glass border-t border-cyan-500/20 shadow-2xl max-h-[95dvh] overflow-y-auto no-scrollbar ${result ? 'translate-y-0' : 'translate-y-full'}`}>
        {result && (
          <div className="px-8 pt-4 pb-12">
            <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-8" />
            
            <div className="flex justify-between items-start mb-8">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <HighlightedText 
                    text={result.en} 
                    activeRange={speakingTextId === 'title' ? activeCharRange : null} 
                    className="text-5xl font-black text-cyan-400 leading-tight" 
                  />
                  <button onClick={() => handleSpeech(result.en, 'en-US', 'title')} className="p-3 bg-cyan-500/20 rounded-2xl active:scale-90"><Volume2 size={24} className="text-cyan-400" /></button>
                </div>
                <p className="text-lg font-mono opacity-40">{result.ipa}</p>
                <p className="text-3xl font-black mt-2 text-white/90">{result.vi}</p>
              </div>
              <button onClick={close} className="p-3 bg-white/10 rounded-full"><X size={28} /></button>
            </div>

            <div className="space-y-6 mb-10">
              {/* Physical Analysis Card */}
              <div className="bg-white/5 rounded-[32px] p-6 border border-white/5 relative group">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-cyan-400/80 uppercase text-[10px] font-black tracking-widest"><Search size={14}/> Phân tích ngoại hình</div>
                  <div className="flex gap-2">
                    <button onClick={() => handleSpeech(result.details_en, 'en-US', 'details_en')} className="p-2 bg-white/10 rounded-xl hover:bg-cyan-500/20 transition-colors"><Volume2 size={16}/></button>
                    <button onClick={() => handleSpeech(result.details_vi, 'vi-VN', 'details_vi')} className="p-2 bg-white/10 rounded-xl hover:bg-cyan-500/20 transition-colors"><span className="text-[10px] font-bold">VI</span></button>
                  </div>
                </div>
                
                <HighlightedText 
                  text={result.details_en} 
                  activeRange={speakingTextId === 'details_en' ? activeCharRange : null} 
                  className="text-xl font-bold leading-relaxed mb-4 text-white/90" 
                />
                
                <p className="text-xl font-medium leading-relaxed text-white/60 border-t border-white/5 pt-4">{result.details_vi}</p>
              </div>

              {/* Social Predictions Card */}
              {result.is_human && (
                <div className="bg-cyan-500/10 rounded-[32px] p-6 border border-cyan-500/20 relative group">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-cyan-400 uppercase text-[10px] font-black tracking-widest"><User size={14}/> Dự đoán đời sống (AI)</div>
                    <div className="flex gap-2">
                      <button onClick={() => handleSpeech(result.predictions_en || '', 'en-US', 'pred_en')} className="p-2 bg-white/10 rounded-xl hover:bg-cyan-500/20 transition-colors"><Volume2 size={16}/></button>
                      <button onClick={() => handleSpeech(result.predictions_vi || '', 'vi-VN', 'pred_vi')} className="p-2 bg-white/10 rounded-xl hover:bg-cyan-500/20 transition-colors"><span className="text-[10px] font-bold">VI</span></button>
                    </div>
                  </div>
                  
                  <HighlightedText 
                    text={result.predictions_en || ''} 
                    activeRange={speakingTextId === 'pred_en' ? activeCharRange : null} 
                    className="text-2xl font-black text-cyan-100 mb-3" 
                  />
                  
                  <p className="text-2xl font-bold text-cyan-400/80 border-t border-cyan-400/10 pt-4">{result.predictions_vi}</p>
                </div>
              )}
            </div>

            {/* Example Analysis Card */}
            <div className="mb-10">
              <div className="flex items-center gap-2 mb-4 text-white/40 uppercase text-[10px] font-black tracking-widest"><Zap size={14}/> Cấu trúc câu ví dụ</div>
              <div className="bg-white/5 rounded-[32px] p-6 border border-white/5 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[9px] font-bold text-white/30 tracking-widest uppercase">Example Analysis</span>
                  <button onClick={() => handleSpeech(result.example_en, 'en-US', 'example_en')} className="p-2 bg-white/10 rounded-xl hover:bg-cyan-500/20 transition-colors"><Volume2 size={16}/></button>
                </div>
                <HighlightedText 
                  text={result.example_en} 
                  activeRange={speakingTextId === 'example_en' ? activeCharRange : null} 
                  className="text-2xl font-black text-white/90 italic leading-tight mb-4" 
                />
                <p className="text-base text-white/40 border-t border-white/5 pt-4">{result.example_vi}</p>
              </div>
              
              <div className="flex flex-wrap gap-2 mb-6">
                {result.grammar_analysis.map((token, i) => (
                  <div key={i} className={`px-3 py-2 rounded-xl border text-sm font-bold flex flex-col items-center gap-1 shadow-sm ${GRAMMAR_COLORS[token.type] || GRAMMAR_COLORS.other}`}>
                    <span>{token.text}</span>
                    <span className="text-[8px] uppercase opacity-60 tracking-tighter">{token.type}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Vocabulary Breakdown Card */}
            <div className="mb-10">
              <div className="flex items-center gap-2 mb-4 text-white/40 uppercase text-[10px] font-black tracking-widest"><BookOpen size={14}/> Từ vựng & Cụm từ chuyên sâu</div>
              <div className="space-y-4">
                {result.vocabulary_breakdown.map((v, i) => (
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
                    <button onClick={() => handleSpeech(v.term, 'en-US', `v-${i}`)} className="p-4 bg-white/5 rounded-2xl group-active:scale-90 transition-all shadow-lg border border-white/5"><Volume2 size={24} className="text-cyan-400"/></button>
                  </div>
                ))}
              </div>
            </div>

            <button onClick={close} className="w-full py-7 bg-cyan-500 text-black rounded-[36px] font-black text-2xl shadow-2xl active:scale-[0.98] transition-all tracking-tighter uppercase">TIẾP TỤC</button>
          </div>
        )}
      </div>

      {/* Start Landing View */}
      {!isCameraActive && (
        <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center p-10 bg-black text-center">
           <div className="w-28 h-28 bg-cyan-500/20 rounded-[48px] flex items-center justify-center mb-10 border border-cyan-400/30 shadow-[0_0_50px_rgba(34,211,238,0.2)] animate-pulse">
              <Target size={56} className="text-cyan-400" />
           </div>
           <h1 className="text-6xl font-black mb-6 tracking-tighter text-white">Gemini AR Lens</h1>
           <p className="text-white/50 mb-14 text-xl leading-relaxed">Học tiếng Anh qua thực tế tăng cường.<br/>Phân tích chuyên sâu từ vựng & ngữ pháp.</p>
           
           <div className="flex flex-col gap-4 w-full max-w-xs">
            <button onClick={startCamera} className="w-full py-7 bg-white text-black rounded-[36px] font-black text-2xl shadow-2xl active:scale-95 transition-all">KHÁM PHÁ NGAY</button>
            <button onClick={() => fileInputRef.current?.click()} className="w-full py-5 bg-white/10 text-white rounded-[32px] font-bold text-lg border border-white/20 active:scale-95 transition-all flex items-center justify-center gap-3">
              <Upload size={20} /> TẢI ẢNH LÊN
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              accept="image/*" 
              className="hidden" 
            />
           </div>
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
