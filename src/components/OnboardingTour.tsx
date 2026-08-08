import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  UserPlus,
  Receipt,
  WifiOff,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  X,
  Play,
  ShieldCheck,
  Zap
} from 'lucide-react';

export interface OnboardingTourProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAddCustomer?: () => void;
}

interface TourStep {
  id: string;
  title: string;
  badge: string;
  description: string;
  icon: React.ReactNode;
  targetId?: string;
  actionText?: string;
  tips: string[];
}

export const OnboardingTour: React.FC<OnboardingTourProps> = ({
  isOpen,
  onClose,
  onOpenAddCustomer
}) => {
  const [currentStep, setCurrentStep] = useState(0);

  const steps: TourStep[] = [
    {
      id: 'welcome',
      badge: 'بەخێربێیت',
      title: 'بەخێربێیت بۆ سیستەمی ژیرۆکس (ZHIROX)',
      description: 'بەهێزترین و خێراترین سیستەمی بەڕێوەبردنی قەرز و حساباتی بازرگانی. با تەنها لە ٤ هەنگاودا چۆنیەتی کارکردنی فێر ببین!',
      icon: <Sparkles className="w-8 h-8 text-amber-400 animate-pulse" />,
      tips: [
        'تۆمارکردنی قەرز و وەرگرتنەوە بە دینار و دۆلار',
        'کارکردن لە دۆخی ئۆفلاین (بەبێ ئینتەرنێت)',
        'پاراستنی بڕی قەرز و ئاگادارکردنەوەی خۆکار'
      ]
    },
    {
      id: 'add-customer',
      badge: 'هەنگاوی ١',
      title: 'زیادکردنی کڕیاری نوێ',
      description: 'بۆ هەر کڕیارێک کە قەرزی لایە یان مامەڵەی لەگەڵ دەکەیت، پڕۆفایلێکی سەربەخۆ دروست بکە بە ناونیشان و ژمارەی مۆبایل.',
      icon: <UserPlus className="w-8 h-8 text-emerald-400" />,
      targetId: 'action-add-customer',
      tips: [
        'دیاریکردنی سنوری ڕێگەپێدراوی قەرز (Credit Limit)',
        'دیاریکردنی ناونیشان و ژمارەی پەیوەندی',
        'دەستگەیشتنی خێرا بۆ حسابات'
      ],
      actionText: 'تاقیکردنەوەی زیادکردنی کڕیار'
    },
    {
      id: 'record-debt',
      badge: 'هەنگاوی ٢',
      title: 'تۆمارکردنی قەرز و وەرگرتنەوە',
      description: 'لە ناو پڕۆفایلی کڕیاردا، دەتوانیت بە خێرایی مامەڵەی قەرز (داواکاری) یان وەگرتنەوە (پەیدابوو) بنووسیت.',
      icon: <Receipt className="w-8 h-8 text-sky-400" />,
      tips: [
        'پشتگیری دراوی IQD و USD بە هەردوو شێواز',
        'تێبینی دەنگی یان دەقی تەنها لە ٥ چرکەدا',
        'پێداچوونەوە و ڕەزامەندی بەرێوەبەر بۆ بەراوردکردنی ژمارەکان'
      ]
    },
    {
      id: 'offline-protection',
      badge: 'هەنگاوی ٣',
      title: 'کارکردنی ئۆفلاین و ڕاپۆرتەکان',
      description: 'ئەگەر ئینتەرنێت پچڕا، نیگەران مەبە! هەموو مامەڵەکانت پاشەکەوت دەبن و کاتێک پەیوەست بوویتەوە خۆکار هاوکات (Sync) دەبنەوە.',
      icon: <WifiOff className="w-8 h-8 text-indigo-400" />,
      tips: [
        'دیاریکردنی داواکاری ئۆفلاین بەبێ ڕاوەستان',
        'ناردنی کورتەنامە یان کەشف حساب بۆ تێلیگرام و واتساپ',
        'دەرکردنی ڕاپۆرتی چاپکراو (PDF Report)'
      ]
    },
    {
      id: 'complete',
      badge: 'ئامادەی!',
      title: 'تۆ ئێستا ئامادەیت بۆ دەستپێکردن!',
      description: 'سیستەمی ژیرۆکس هاوڕێی ئاسانی بازرگانییەکەتە. دەتوانیت ئێستا یەکەم کڕیاری خۆت ناونووس بکەیت.',
      icon: <CheckCircle2 className="w-8 h-8 text-emerald-400" />,
      tips: [
        'دەتوانیت لە بەشی ڕێکخستنەکان هەركاتێک ویستت ئەم فێرکارییە دووبارە بکەیتەوە.'
      ],
      actionText: 'ئێستا یەکەم کڕیار زیاد بکە 🚀'
    }
  ];

  const step = steps[currentStep];

  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      handleFinish();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleFinish = () => {
    localStorage.setItem('zhirox_onboarding_completed', 'true');
    onClose();
  };

  const handleActionClick = () => {
    handleFinish();
    if (onOpenAddCustomer) {
      setTimeout(() => {
        onOpenAddCustomer();
      }, 150);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in dir-rtl">
      {/* Background click listener */}
      <div className="absolute inset-0" onClick={handleFinish} />

      {/* Main Card */}
      <div className="relative w-full max-w-md bg-[#1C1C1E] border border-[#2C2C2E] rounded-3xl p-6 shadow-2xl flex flex-col gap-5 animate-scale-in text-right text-[#F5F5F7] z-10">
        
        {/* Top Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#2C2C2E]/60">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold rounded-full flex items-center gap-1">
              <Zap className="w-3.5 h-3.5" />
              <span>{step.badge}</span>
            </span>
            <span className="text-xs text-[#8E8E93] font-bold">
              ({currentStep + 1} لە {steps.length})
            </span>
          </div>

          <button
            onClick={handleFinish}
            className="p-1.5 text-[#8E8E93] hover:text-[#F5F5F7] hover:bg-[#2C2C2E] rounded-xl transition-colors"
            title="داخستن"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Section */}
        <div className="flex flex-col items-center text-center gap-3 py-2">
          <div className="p-4 bg-[#2C2C2E]/50 rounded-2xl border border-[#3A3A3C] shadow-inner">
            {step.icon}
          </div>

          <h2 className="text-lg font-extrabold text-[#F5F5F7] tracking-tight">
            {step.title}
          </h2>

          <p className="text-xs text-[#8E8E93] leading-relaxed max-w-xs">
            {step.description}
          </p>

          {/* Key Tips Box */}
          <div className="w-full bg-[#2C2C2E]/40 border border-[#2C2C2E] rounded-2xl p-3 text-right space-y-2 mt-2">
            {step.tips.map((tip, idx) => (
              <div key={idx} className="flex items-start gap-2 text-xs text-[#D1D1D6]">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>{tip}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Action button inside step if specified */}
        {step.actionText && (
          <button
            onClick={handleActionClick}
            className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-black font-extrabold text-xs rounded-xl shadow-lg hover:brightness-110 active:scale-98 transition-all flex items-center justify-center gap-2"
          >
            <Play className="w-4 h-4 fill-black" />
            <span>{step.actionText}</span>
          </button>
        )}

        {/* Bottom Navigation */}
        <div className="flex items-center justify-between pt-3 border-t border-[#2C2C2E]/60">
          <button
            onClick={handlePrev}
            disabled={currentStep === 0}
            className="px-3 py-2 bg-[#2C2C2E] hover:bg-[#3A3A3C] text-[#F5F5F7] text-xs font-bold rounded-xl transition-all disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1"
          >
            <ChevronRight className="w-4 h-4" />
            <span>پێشوو</span>
          </button>

          {/* Dots Indicator */}
          <div className="flex items-center gap-1.5 dir-ltr">
            {steps.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentStep(idx)}
                className={`h-2 rounded-full transition-all ${
                  idx === currentStep
                    ? 'w-6 bg-emerald-400'
                    : 'w-2 bg-[#3A3A3C] hover:bg-[#8E8E93]'
                }`}
                aria-label={`Step ${idx + 1}`}
              />
            ))}
          </div>

          {currentStep < steps.length - 1 ? (
            <button
              onClick={handleNext}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-extrabold rounded-xl transition-all flex items-center gap-1 shadow-sm"
            >
              <span>داهاتوو</span>
              <ChevronLeft className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleFinish}
              className="px-4 py-2 bg-emerald-500 text-black text-xs font-extrabold rounded-xl transition-all"
            >
              داخستن
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
