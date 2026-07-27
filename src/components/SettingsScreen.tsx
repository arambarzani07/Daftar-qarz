import React, { useState, useEffect } from 'react';
import { AppSettings, SortOption } from '../types';
import { StaffManagementModal } from './StaffManagementModal';
import {
  User,
  Users,
  Settings as SettingsIcon,
  HelpCircle,
  Lock,
  Key,
  Globe,
  ArrowUpDown,
  Phone,
  LogOut,
  ChevronRight,
  X,
  Check,
  ShieldCheck,
  Info,
  DollarSign,
  Smartphone,
  ExternalLink,
  MessageSquare,
  Sun,
  Moon,
  Database,
  Server
} from 'lucide-react';

interface SettingsScreenProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => Promise<void>;
  onBack: () => void;
  defaultSort: SortOption;
  onUpdateDefaultSort: (sort: SortOption) => void;
  onLogout?: () => Promise<void> | void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  settings,
  onUpdateSettings,
  onBack,
  defaultSort,
  onUpdateDefaultSort,
  onLogout
}) => {
  const [activeModal, setActiveModal] = useState<
    'ACCOUNT' | 'STAFF' | 'MODE' | 'TUTORIAL' | 'PIN' | 'PASSWORD' | 'LANGUAGE' | 'SORT' | 'CONTACT' | 'LOGOUT' | 'DATABASE' | null
  >(null);

  // Supabase Database Connection Status
  const [dbStatus, setDbStatus] = useState<{
    connected: boolean;
    provider: string;
    supabaseUrlConfigured: boolean;
    instructions: string;
    errorDetails?: string | null;
  } | null>(null);

  useEffect(() => {
    fetch('/api/database/status')
      .then((res) => res.json())
      .then((json) => {
        if (json.status === 'success') {
          setDbStatus(json.data);
        }
      })
      .catch(() => {});
  }, []);

  // Logout processing state
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  // Form States
  const [marketName, setMarketName] = useState(settings.market_name || '');
  const [ownerName, setOwnerName] = useState(settings.owner_name || '');
  const [defaultCurrency, setDefaultCurrency] = useState<'IQD' | 'USD'>(settings.default_currency || 'IQD');
  const [theme, setTheme] = useState<'dark' | 'light'>(settings.theme || 'dark');
  const [pinEnabled, setPinEnabled] = useState(settings.pin_enabled || false);
  const [pinCode, setPinCode] = useState(settings.pin_code || '1234');
  const [language, setLanguage] = useState<'ku' | 'ar' | 'en'>(settings.language || 'ku');

  // Password Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Tutorial Step State
  const [tutorialStep, setTutorialStep] = useState(0);

  // Feedback toast for actions
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Handlers
  const handleSaveMarketInfo = async () => {
    if (settings.is_locked_by_system) {
      showToast('زانیارییەکان لەلایەن خاوەنی سیستەمەوە قوفڵکراون');
      setActiveModal(null);
      return;
    }
    if (!marketName.trim() || !ownerName.trim()) {
      showToast('تکایە هەموو خانەکان پڕبکەرەوە');
      return;
    }
    await onUpdateSettings({
      market_name: marketName.trim(),
      owner_name: ownerName.trim()
    });
    showToast('زانیاری هەژمار بە سەرکەوتوویی پاشەکەوت کرا');
    setActiveModal(null);
  };

  const handleSaveMode = async () => {
    await onUpdateSettings({
      theme: theme
    });
    showToast('دۆخی ڕوکار بە سەرکەوتوویی گۆڕدرا');
    setActiveModal(null);
  };

  const handleSavePin = async () => {
    if (pinEnabled && pinCode.length < 4) {
      showToast('تکایە پین کۆدێکی ٤ ژمارەیی بنووسە');
      return;
    }
    await onUpdateSettings({
      pin_enabled: pinEnabled,
      pin_code: pinCode
    });
    showToast('ڕێکخستنی پین کۆد بە سەرکەوتوویی پاشەکەوت کرا');
    setActiveModal(null);
  };

  const handleChangePassword = async () => {
    setPasswordMsg(null);
    if (!currentPassword) {
      setPasswordMsg({ type: 'error', text: 'تکایە تێپەڕەواژەی ئێستا بنووسە' });
      return;
    }
    if (newPassword.length < 4) {
      setPasswordMsg({ type: 'error', text: 'تێپەڕەواژەی نوێ دەبێت لانیکەم ٤ پیت یان ژمارە بێت' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'تێپەڕەواژەی نوێ و دووبارەکردنەوەکەی وەک یەک نین' });
      return;
    }

    setPasswordMsg({ type: 'success', text: 'تێپەڕەواژە بە سەرکەوتوویی گۆڕدرا' });
    setTimeout(() => {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordMsg(null);
      setActiveModal(null);
    }, 1200);
  };

  const handleSaveLanguage = async (lang: 'ku' | 'ar' | 'en') => {
    setLanguage(lang);
    await onUpdateSettings({ language: lang });
    showToast('زمانی سیستەم بە سەرکەوتوویی گۆڕدرا');
    setActiveModal(null);
  };

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    setLogoutError(null);
    try {
      if (onLogout) {
        await onLogout();
      }
      setActiveModal(null);
      showToast('چوونەدەرەوە بە سەرکەوتوویی ئەنجام درا');
    } catch (err) {
      setLogoutError('چوونەدەرەوە سەرکەوتوو نەبوو، تکایە دووبارە هەوڵ بدەرەوە.');
    } finally {
      setIsLoggingOut(false);
    }
  };

  const tutorialSlides = [
    {
      title: 'تۆمارکردنی کڕیار',
      desc: 'دەتوانیت بە ئاسانی ناوی کڕیار، ژمارەی مۆبایل و دراوی سەرەکی قەرزەکان (دینار یان دۆلار) بنووسیت.',
      icon: <User className="w-10 h-10 text-blue-400" />
    },
    {
      title: 'تۆمارکردنی قەرز و وەرگرتنەوە',
      desc: 'بە تەنها یەک جەپکە، قەرزی نوێ بنووسە یان پارەی وەرگیراو بە بەرزی دەق و بەبێ هەڵەی ژمێریاری تۆمار بکە.',
      icon: <DollarSign className="w-10 h-10 text-emerald-400" />
    },
    {
      title: 'پاراستنی دارایی و ڕادەی قەرز',
      desc: 'سنووری دیاریکراو بۆ قەرز دابنێ و سیستەمەکە بە ئۆتۆماتیکی ئاگادارت دەکاتەوە ئەگەر کڕیار تێپەڕی کرد.',
      icon: <ShieldCheck className="w-10 h-10 text-amber-400" />
    },
    {
      title: 'بەستەری ڕاستەوخۆ (Live Link)',
      desc: 'بەستەری پارێزراوی بینینی حساب بۆ کڕیار بنێرە تا خۆی لە ڕێگەی واتسئاپ ئاگاداری بەڵگە و باقییەکەی بێت.',
      icon: <ExternalLink className="w-10 h-10 text-purple-400" />
    }
  ];

  return (
    <div id="settings-screen" className="min-h-screen bg-black text-[#F5F5F7] pb-safe">
      
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-[#2C2C2E] text-[#F5F5F7] text-xs font-bold px-4 py-2.5 rounded-full border border-[#3A3A3C] shadow-lg animate-fade-in flex items-center gap-2">
          <Check className="w-4 h-4 text-[#34C759]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header */}
      <header className="w-full bg-black pt-safe px-4 py-3 sticky top-0 z-20 border-b border-[#1C1C1E]">
        <div className="max-w-md mx-auto flex items-center justify-between h-11">
          <button
            onClick={onBack}
            aria-label="گەڕانەوە"
            className="text-[#F5F5F7] p-1 active:opacity-60 transition-opacity flex items-center gap-1"
          >
            <ChevronRight className="w-6 h-6 stroke-[1.5]" />
            <span className="text-sm text-[#8E8E93]">گەڕانەوە</span>
          </button>

          <h2 className="text-base font-bold text-[#F5F5F7]">
            ڕێکخستنەکان
          </h2>

          <div className="w-12" />
        </div>
      </header>

      {/* Main Settings List */}
      <div className="max-w-md mx-auto bg-[#1C1C1E] border-y border-[#2C2C2E] divide-y divide-[#2C2C2E]/80 mt-2">
        
        {/* 1. Account Info */}
        <button
          onClick={() => setActiveModal('ACCOUNT')}
          className="w-full h-[68px] px-5 flex items-center justify-between active:bg-[#2C2C2E] transition-colors"
        >
          <div className="flex items-center gap-3.5">
            <User className="w-5 h-5 text-blue-400 stroke-[1.75]" />
            <span className="text-base font-bold text-[#F5F5F7]">زانیاری هەژمار</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#8E8E93] max-w-[120px] truncate">{settings.market_name}</span>
            <ChevronRight className="w-5 h-5 text-[#8E8E93] rotate-180" />
          </div>
        </button>

        {/* 1.5. Staff & Permissions Management */}
        <button
          onClick={() => setActiveModal('STAFF')}
          className="w-full h-[68px] px-5 flex items-center justify-between active:bg-[#2C2C2E] transition-colors"
        >
          <div className="flex items-center gap-3.5">
            <Users className="w-5 h-5 text-emerald-400 stroke-[1.75]" />
            <span className="text-base font-bold text-[#F5F5F7]">کارمەندان و دەسەڵاتەکان</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#34C759] font-bold">زیادکردن و دەسەڵات</span>
            <ChevronRight className="w-5 h-5 text-[#8E8E93] rotate-180" />
          </div>
        </button>

        {/* 2. Change Mode */}
        <button
          onClick={() => setActiveModal('MODE')}
          className="w-full h-[68px] px-5 flex items-center justify-between active:bg-[#2C2C2E] transition-colors"
        >
          <div className="flex items-center gap-3.5">
            {theme === 'light' ? (
              <Sun className="w-5 h-5 text-amber-400 stroke-[1.75]" />
            ) : (
              <Moon className="w-5 h-5 text-blue-400 stroke-[1.75]" />
            )}
            <span className="text-base font-bold text-[#F5F5F7]">گۆڕینی دۆخ</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#8E8E93]">
              {theme === 'light' ? 'ڕووناک (Light)' : 'تاریک (Dark)'}
            </span>
            <ChevronRight className="w-5 h-5 text-[#8E8E93] rotate-180" />
          </div>
        </button>

        {/* 3. Tutorial */}
        <button
          onClick={() => {
            setTutorialStep(0);
            setActiveModal('TUTORIAL');
          }}
          className="w-full h-[68px] px-5 flex items-center justify-between active:bg-[#2C2C2E] transition-colors"
        >
          <div className="flex items-center gap-3.5">
            <HelpCircle className="w-5 h-5 text-blue-400 stroke-[1.75]" />
            <span className="text-base font-bold text-[#F5F5F7]">فێرکاری</span>
          </div>
          <ChevronRight className="w-5 h-5 text-[#8E8E93] rotate-180" />
        </button>

        {/* 4. PIN Code */}
        <button
          onClick={() => setActiveModal('PIN')}
          className="w-full h-[68px] px-5 flex items-center justify-between active:bg-[#2C2C2E] transition-colors"
        >
          <div className="flex items-center gap-3.5">
            <Lock className="w-5 h-5 text-amber-400 stroke-[1.75]" />
            <span className="text-base font-bold text-[#F5F5F7]">پین کۆد</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded-full ${settings.pin_enabled ? 'bg-[#34C759]/20 text-[#34C759]' : 'bg-[#2C2C2E] text-[#8E8E93]'}`}>
              {settings.pin_enabled ? 'چالاککراوە' : 'کوژاوەتەوە'}
            </span>
            <ChevronRight className="w-5 h-5 text-[#8E8E93] rotate-180" />
          </div>
        </button>

        {/* 5. Change Password */}
        <button
          onClick={() => setActiveModal('PASSWORD')}
          className="w-full h-[68px] px-5 flex items-center justify-between active:bg-[#2C2C2E] transition-colors"
        >
          <div className="flex items-center gap-3.5">
            <Key className="w-5 h-5 text-amber-400 stroke-[1.75]" />
            <span className="text-base font-bold text-[#F5F5F7]">گۆڕینی پاسوۆرد</span>
          </div>
          <ChevronRight className="w-5 h-5 text-[#8E8E93] rotate-180" />
        </button>

        {/* 6. Language */}
        <button
          onClick={() => setActiveModal('LANGUAGE')}
          className="w-full h-[68px] px-5 flex items-center justify-between active:bg-[#2C2C2E] transition-colors"
        >
          <div className="flex items-center gap-3.5">
            <Globe className="w-5 h-5 text-cyan-400 stroke-[1.75]" />
            <span className="text-base font-bold text-[#F5F5F7]">گۆڕینی زمان</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#8E8E93]">کوردی سۆرانی</span>
            <ChevronRight className="w-5 h-5 text-[#8E8E93] rotate-180" />
          </div>
        </button>

        {/* 7. Sorting */}
        <button
          onClick={() => setActiveModal('SORT')}
          className="w-full h-[68px] px-5 flex items-center justify-between active:bg-[#2C2C2E] transition-colors"
        >
          <div className="flex items-center gap-3.5">
            <ArrowUpDown className="w-5 h-5 text-purple-400 stroke-[1.75]" />
            <span className="text-base font-bold text-[#F5F5F7]">ڕێزبەندی</span>
          </div>
          <ChevronRight className="w-5 h-5 text-[#8E8E93] rotate-180" />
        </button>

        {/* 8. Contact / Support */}
        <button
          onClick={() => setActiveModal('CONTACT')}
          className="w-full h-[68px] px-5 flex items-center justify-between active:bg-[#2C2C2E] transition-colors"
        >
          <div className="flex items-center gap-3.5">
            <Phone className="w-5 h-5 text-emerald-400 stroke-[1.75]" />
            <span className="text-base font-bold text-[#F5F5F7]">پەیوەندیکردن</span>
          </div>
          <ChevronRight className="w-5 h-5 text-[#8E8E93] rotate-180" />
        </button>

        {/* 9. Logout */}
        <button
          onClick={() => setActiveModal('LOGOUT')}
          className="w-full h-[68px] px-5 flex items-center justify-between active:bg-[#2C2C2E] transition-colors"
        >
          <div className="flex items-center gap-3.5 text-rose-400">
            <LogOut className="w-5 h-5 stroke-[1.75]" />
            <span className="text-base font-bold">چوونەدەرەوە</span>
          </div>
          <ChevronRight className="w-5 h-5 text-[#8E8E93] rotate-180" />
        </button>

      </div>

      {/* ========================================================= */}
      {/* 1. ACCOUNT MODAL */}
      {/* ========================================================= */}
      {activeModal === 'ACCOUNT' && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-sm bg-[#1C1C1E] border border-[#2C2C2E] rounded-2xl p-5 flex flex-col gap-4 animate-scale-in">
            <div className="flex items-center justify-between pb-2 border-b border-[#2C2C2E]">
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-blue-400" />
                <span className="font-bold text-[#F5F5F7]">زانیاری هەژمار</span>
              </div>
              <button onClick={() => setActiveModal(null)} className="text-[#8E8E93] hover:text-[#F5F5F7]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div>
              <label className="block text-xs text-[#8E8E93] mb-1">ناوی مارکێت / شوێن</label>
              <input
                type="text"
                value={marketName}
                onChange={(e) => setMarketName(e.target.value)}
                disabled={settings.is_locked_by_system}
                className={`w-full bg-black text-sm text-[#F5F5F7] p-3 rounded-xl border border-[#2C2C2E] focus:outline-none focus:border-[#34C759] ${settings.is_locked_by_system ? 'opacity-60 cursor-not-allowed bg-[#111113]' : ''}`}
                placeholder="ناوی شوێن..."
              />
            </div>
            <div>
              <label className="block text-xs text-[#8E8E93] mb-1">ناوی خاوەن شوێن</label>
              <input
                type="text"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                disabled={settings.is_locked_by_system}
                className={`w-full bg-black text-sm text-[#F5F5F7] p-3 rounded-xl border border-[#2C2C2E] focus:outline-none focus:border-[#34C759] ${settings.is_locked_by_system ? 'opacity-60 cursor-not-allowed bg-[#111113]' : ''}`}
                placeholder="ناوی خاوەن شوێن..."
              />
            </div>
            <div>
              <label className="block text-xs text-[#8E8E93] mb-1">ژمارەی مۆبایلی تۆماربوو</label>
              <input
                type="text"
                value={settings.owner_phone || 'دیارینەکراوە'}
                disabled={true}
                className="w-full bg-black text-sm text-[#8E8E93] p-3 rounded-xl border border-[#2C2C2E] opacity-60 cursor-not-allowed bg-[#111113] dir-ltr text-right"
              />
            </div>
            {settings.is_locked_by_system && (
              <div className="flex items-center gap-2 p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400 text-xs">
                <Lock className="w-4 h-4 shrink-0" />
                <span>ئەم زانیاریانە لەلایەن خاوەنی سیستەمەوە دروستکراون و قوفڵکراون (ناتوانیت دەستکارییان بکەیت).</span>
              </div>
            )}
            <div>
              <label className="block text-xs text-[#8E8E93] mb-1">کۆدی ناسنامەی تێنەنت (Tenant ID)</label>
              <div className="w-full bg-[#000000] text-xs text-[#8E8E93] p-3 rounded-xl border border-[#2C2C2E] font-mono">
                {settings.market_id || 'market-default'}
              </div>
            </div>
            <button
              onClick={handleSaveMarketInfo}
              className="w-full py-3 bg-[#34C759] text-black font-bold text-sm rounded-xl active-scale"
            >
              پاشەکەوتکردن
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. CHANGE MODE MODAL (LIGHT / DARK) */}
      {/* ========================================================= */}
      {activeModal === 'MODE' && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-sm bg-[#1C1C1E] border border-[#2C2C2E] rounded-2xl p-5 flex flex-col gap-4 animate-scale-in">
            <div className="flex items-center justify-between pb-2 border-b border-[#2C2C2E]">
              <div className="flex items-center gap-2">
                {theme === 'light' ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-blue-400" />}
                <span className="font-bold text-[#F5F5F7]">گۆڕینی دۆخی شاشە</span>
              </div>
              <button onClick={() => setActiveModal(null)} className="text-[#8E8E93] hover:text-[#F5F5F7]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#8E8E93] leading-relaxed">
              دۆخی شاشە و ڕەنگەکانی بەرنامە هەڵبژێرە:
            </p>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => setTheme('dark')}
                className={`w-full p-3.5 rounded-xl text-sm font-bold flex items-center justify-between border transition-all ${
                  theme === 'dark'
                    ? 'bg-[#34C759]/10 text-[#34C759] border-[#34C759]'
                    : 'bg-black text-[#8E8E93] border-[#2C2C2E]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Moon className="w-5 h-5 text-blue-400" />
                  <span>دۆخی تاریک (Dark Mode)</span>
                </div>
                {theme === 'dark' && <Check className="w-5 h-5 text-[#34C759]" />}
              </button>

              <button
                onClick={() => setTheme('light')}
                className={`w-full p-3.5 rounded-xl text-sm font-bold flex items-center justify-between border transition-all ${
                  theme === 'light'
                    ? 'bg-[#34C759]/10 text-[#34C759] border-[#34C759]'
                    : 'bg-black text-[#8E8E93] border-[#2C2C2E]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Sun className="w-5 h-5 text-amber-400" />
                  <span>دۆخی ڕووناک (Light Mode)</span>
                </div>
                {theme === 'light' && <Check className="w-5 h-5 text-[#34C759]" />}
              </button>
            </div>

            <button
              onClick={handleSaveMode}
              className="w-full py-3 bg-[#34C759] text-black font-bold text-sm rounded-xl active-scale mt-1"
            >
              پاشەکەوتکردن
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. TUTORIAL MODAL */}
      {/* ========================================================= */}
      {activeModal === 'TUTORIAL' && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-sm bg-[#1C1C1E] border border-[#2C2C2E] rounded-2xl p-5 flex flex-col gap-4 animate-scale-in">
            <div className="flex items-center justify-between pb-2 border-b border-[#2C2C2E]">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-blue-400" />
                <span className="font-bold text-[#F5F5F7]">فێرکاری بەکارهێنان ({tutorialStep + 1} لە {tutorialSlides.length})</span>
              </div>
              <button onClick={() => setActiveModal(null)} className="text-[#8E8E93] hover:text-[#F5F5F7]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-6 flex flex-col items-center text-center gap-4">
              <div className="p-4 bg-[#000000] rounded-2xl border border-[#2C2C2E]">
                {tutorialSlides[tutorialStep].icon}
              </div>
              <h3 className="text-base font-bold text-[#F5F5F7]">
                {tutorialSlides[tutorialStep].title}
              </h3>
              <p className="text-xs text-[#8E8E93] leading-relaxed">
                {tutorialSlides[tutorialStep].desc}
              </p>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[#2C2C2E]">
              <button
                disabled={tutorialStep === 0}
                onClick={() => setTutorialStep((prev) => Math.max(0, prev - 1))}
                className="px-4 py-2 bg-[#2C2C2E] text-xs font-bold rounded-xl disabled:opacity-30"
              >
                دواوە
              </button>

              <div className="flex items-center gap-1.5">
                {tutorialSlides.map((_, idx) => (
                  <div
                    key={idx}
                    className={`h-1.5 rounded-full transition-all ${
                      idx === tutorialStep ? 'w-5 bg-[#34C759]' : 'w-1.5 bg-[#3A3A3C]'
                    }`}
                  />
                ))}
              </div>

              {tutorialStep < tutorialSlides.length - 1 ? (
                <button
                  onClick={() => setTutorialStep((prev) => Math.min(tutorialSlides.length - 1, prev + 1))}
                  className="px-4 py-2 bg-[#34C759] text-black text-xs font-bold rounded-xl"
                >
                  پێشەوە
                </button>
              ) : (
                <button
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 bg-[#34C759] text-black text-xs font-bold rounded-xl"
                >
                  تەواو
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. PIN CODE MODAL */}
      {/* ========================================================= */}
      {activeModal === 'PIN' && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-sm bg-[#1C1C1E] border border-[#2C2C2E] rounded-2xl p-5 flex flex-col gap-4 animate-scale-in">
            <div className="flex items-center justify-between pb-2 border-b border-[#2C2C2E]">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-amber-400" />
                <span className="font-bold text-[#F5F5F7]">پین کۆد</span>
              </div>
              <button onClick={() => setActiveModal(null)} className="text-[#8E8E93] hover:text-[#F5F5F7]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center justify-between bg-black p-3.5 rounded-xl border border-[#2C2C2E]">
              <span className="text-sm font-bold text-[#F5F5F7]">چالاککردنی پین کۆد</span>
              <button
                onClick={() => setPinEnabled(!pinEnabled)}
                className={`w-12 h-7 rounded-full p-1 transition-colors ${
                  pinEnabled ? 'bg-[#34C759]' : 'bg-[#2C2C2E]'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    pinEnabled ? 'translate-x-0' : '-translate-x-5'
                  }`}
                />
              </button>
            </div>

            {pinEnabled && (
              <div className="flex flex-col gap-2">
                <label className="text-xs text-[#8E8E93]">پین کۆدی ٤ ژمارەیی</label>
                <input
                  type="password"
                  maxLength={4}
                  value={pinCode}
                  onChange={(e) => setPinCode(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-black text-center text-xl font-mono tracking-widest text-[#F5F5F7] p-3 rounded-xl border border-[#2C2C2E] focus:outline-none focus:border-[#34C759]"
                  placeholder="••••"
                />
              </div>
            )}

            <button
              onClick={handleSavePin}
              className="w-full py-3 bg-[#34C759] text-black font-bold text-sm rounded-xl active-scale"
            >
              پاشەکەوتکردن
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 5. CHANGE PASSWORD MODAL */}
      {/* ========================================================= */}
      {activeModal === 'PASSWORD' && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-sm bg-[#1C1C1E] border border-[#2C2C2E] rounded-2xl p-5 flex flex-col gap-4 animate-scale-in">
            <div className="flex items-center justify-between pb-2 border-b border-[#2C2C2E]">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-amber-400" />
                <span className="font-bold text-[#F5F5F7]">گۆڕینی پاسوۆرد</span>
              </div>
              <button onClick={() => setActiveModal(null)} className="text-[#8E8E93] hover:text-[#F5F5F7]">
                <X className="w-5 h-5" />
              </button>
            </div>

            {passwordMsg && (
              <div
                className={`p-3 rounded-xl text-xs font-bold border ${
                  passwordMsg.type === 'success'
                    ? 'bg-[#34C759]/10 text-[#34C759] border-[#34C759]/30'
                    : 'bg-[#FF3B30]/10 text-[#FF3B30] border-[#FF3B30]/30'
                }`}
              >
                {passwordMsg.text}
              </div>
            )}

            <div>
              <label className="block text-xs text-[#8E8E93] mb-1">تێپەڕەواژەی ئێستا</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full bg-black text-sm text-[#F5F5F7] p-3 rounded-xl border border-[#2C2C2E] focus:outline-none focus:border-[#34C759]"
                placeholder="••••••••"
              />
            </div>

            <div>
              <label className="block text-xs text-[#8E8E93] mb-1">تێپەڕەواژەی نوێ</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-black text-sm text-[#F5F5F7] p-3 rounded-xl border border-[#2C2C2E] focus:outline-none focus:border-[#34C759]"
                placeholder="••••••••"
              />
            </div>

            <div>
              <label className="block text-xs text-[#8E8E93] mb-1">دووبارەکردنەوەی تێپەڕەواژە</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-black text-sm text-[#F5F5F7] p-3 rounded-xl border border-[#2C2C2E] focus:outline-none focus:border-[#34C759]"
                placeholder="••••••••"
              />
            </div>

            <button
              onClick={handleChangePassword}
              className="w-full py-3 bg-[#34C759] text-black font-bold text-sm rounded-xl active-scale"
            >
              گۆڕینی پاسوۆرد
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 6. LANGUAGE MODAL */}
      {/* ========================================================= */}
      {activeModal === 'LANGUAGE' && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-sm bg-[#1C1C1E] border border-[#2C2C2E] rounded-2xl p-5 flex flex-col gap-3 animate-scale-in">
            <div className="flex items-center justify-between pb-2 border-b border-[#2C2C2E]">
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-cyan-400" />
                <span className="font-bold text-[#F5F5F7]">گۆڕینی زمان</span>
              </div>
              <button onClick={() => setActiveModal(null)} className="text-[#8E8E93] hover:text-[#F5F5F7]">
                <X className="w-5 h-5" />
              </button>
            </div>

            {[
              { id: 'ku', label: 'کوردی سۆرانی (پێشڕەو)' },
              { id: 'ar', label: 'العربية' },
              { id: 'en', label: 'English' }
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => handleSaveLanguage(item.id as any)}
                className={`w-full p-3.5 rounded-xl text-sm font-bold flex items-center justify-between border transition-all ${
                  language === item.id
                    ? 'bg-[#34C759]/10 text-[#34C759] border-[#34C759]'
                    : 'bg-black text-[#8E8E93] border-[#2C2C2E]'
                }`}
              >
                <span>{item.label}</span>
                {language === item.id && <Check className="w-5 h-5 text-[#34C759]" />}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 7. SORT MODAL */}
      {/* ========================================================= */}
      {activeModal === 'SORT' && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-sm bg-[#1C1C1E] border border-[#2C2C2E] rounded-2xl p-5 flex flex-col gap-3 animate-scale-in">
            <div className="flex items-center justify-between pb-2 border-b border-[#2C2C2E]">
              <div className="flex items-center gap-2">
                <ArrowUpDown className="w-5 h-5 text-purple-400" />
                <span className="font-bold text-[#F5F5F7]">ڕێزبەندی قەرزداران</span>
              </div>
              <button onClick={() => setActiveModal(null)} className="text-[#8E8E93] hover:text-[#F5F5F7]">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {[
              { id: 'recent', label: 'تازەترین چالاکی' },
              { id: 'newest', label: 'تازەترین کڕیار' },
              { id: 'oldest', label: 'کۆنترین کڕیار' },
              { id: 'highest_debt', label: 'بەرزترین بڕی قەرز' },
              { id: 'lowest_debt', label: 'نۆرمال/کەمترین قەرز' },
              { id: 'alphabetical', label: 'بەپێی پیتەکان (ئەڵفوبێ)' }
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  onUpdateDefaultSort(item.id as SortOption);
                  showToast('ڕێزبەندی بە سەرکەوتوویی نوێکرایەوە');
                  setActiveModal(null);
                }}
                className={`w-full p-3 rounded-xl text-sm font-bold flex items-center justify-between border transition-all ${
                  defaultSort === item.id
                    ? 'bg-[#34C759]/10 text-[#34C759] border-[#34C759]'
                    : 'bg-black text-[#8E8E93] border-[#2C2C2E]'
                }`}
              >
                <span>{item.label}</span>
                {defaultSort === item.id && <Check className="w-4 h-4 text-[#34C759]" />}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 8. CONTACT MODAL */}
      {/* ========================================================= */}
      {activeModal === 'CONTACT' && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-sm bg-[#1C1C1E] border border-[#2C2C2E] rounded-2xl p-5 flex flex-col gap-4 animate-scale-in">
            <div className="flex items-center justify-between pb-2 border-b border-[#2C2C2E]">
              <div className="flex items-center gap-2">
                <Phone className="w-5 h-5 text-emerald-400" />
                <span className="font-bold text-[#F5F5F7]">پەیوەندیکردن و پشتیوانی</span>
              </div>
              <button onClick={() => setActiveModal(null)} className="text-[#8E8E93] hover:text-[#F5F5F7]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#8E8E93] leading-relaxed">
              تیمی پشتیوانی ژیرۆکس ٢٤ کاژێر لە خزمەتتاندایە بۆ وەڵامدانەوەی هەر پرسیارێک:
            </p>

            <a
              href="https://wa.me/9647501234567"
              target="_blank"
              rel="noreferrer"
              className="w-full p-3.5 bg-[#25D366]/10 border border-[#25D366]/30 text-[#25D366] rounded-xl font-bold text-sm flex items-center justify-between active-scale"
            >
              <div className="flex items-center gap-2.5">
                <MessageSquare className="w-5 h-5" />
                <span>پەیوەندی بە واتسئاپ (WhatsApp)</span>
              </div>
              <ChevronRight className="w-4 h-4 rotate-180" />
            </a>

            <div
              className="w-full p-3.5 bg-black border border-[#2C2C2E] text-[#F5F5F7] rounded-xl font-bold text-sm flex items-center justify-between"
            >
              <div className="flex items-center gap-2.5">
                <Phone className="w-5 h-5 text-emerald-400" />
                <span>پشتیوانی تەلەفۆنی ژیرۆکس</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 9. LOGOUT MODAL */}
      {/* ========================================================= */}
      {activeModal === 'LOGOUT' && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-sm bg-[#1C1C1E] border border-[#2C2C2E] rounded-2xl p-5 flex flex-col gap-4 animate-scale-in">
            <div className="flex items-center justify-between pb-2 border-b border-[#2C2C2E]">
              <div className="flex items-center gap-2">
                <LogOut className="w-5 h-5 text-rose-400" />
                <span className="font-bold text-rose-400">چوونەدەرەوە</span>
              </div>
              <button 
                onClick={() => {
                  if (!isLoggingOut) {
                    setActiveModal(null);
                    setLogoutError(null);
                  }
                }}
                disabled={isLoggingOut}
                className="text-[#8E8E93] hover:text-[#F5F5F7] disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#8E8E93] leading-relaxed">
              ئایا دڵنیایت لە چوونەدەرەوە لە هەژمارەکەت؟ هەموو زانیاری و تۆمارەکان لەسەر سێرڤەری تێنەنت پارێزراون.
            </p>

            {logoutError && (
              <div className="text-xs text-rose-400 font-medium bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-xl text-center">
                {logoutError}
              </div>
            )}

            <div className="flex items-center gap-3 mt-2">
              <button
                onClick={() => {
                  setActiveModal(null);
                  setLogoutError(null);
                }}
                disabled={isLoggingOut}
                className="flex-1 py-3 bg-[#2C2C2E] text-[#F5F5F7] font-bold text-sm rounded-xl active-scale disabled:opacity-50"
              >
                پاشگەزبوونەوە
              </button>

              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="flex-1 py-3 bg-[#FF3B30] text-white font-bold text-sm rounded-xl active-scale disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoggingOut ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <span>چوونەدەرەوە</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STAFF MANAGEMENT MODAL */}
      <StaffManagementModal
        isOpen={activeModal === 'STAFF'}
        onClose={() => setActiveModal(null)}
      />

    </div>
  );
};
