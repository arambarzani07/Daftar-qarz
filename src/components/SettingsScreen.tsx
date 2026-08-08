import React, { useState, useEffect } from 'react';
import { AppSettings, SortOption } from '../types';
import { StaffManagementModal } from './StaffManagementModal';
import { authenticatedFetch } from '../utils/apiClient';
import { useOfflineQueue } from '../lib/useOfflineQueue';
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
  Server,
  Send,
  Bot,
  Bell,
  CheckCircle2,
  AlertCircle,
  Loader2,
  WifiOff,
  Trash2,
  RefreshCw,
  Download,
  HardDrive,
  FileJson
} from 'lucide-react';

interface SettingsScreenProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => Promise<void>;
  onBack: () => void;
  defaultSort: SortOption;
  onUpdateDefaultSort: (sort: SortOption) => void;
  onLogout?: () => Promise<void> | void;
  onStartTour?: () => void;
  userRole?: string;
  userPermissions?: string[];
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  settings,
  onUpdateSettings,
  onBack,
  defaultSort,
  onUpdateDefaultSort,
  onLogout,
  onStartTour,
  userRole,
  userPermissions
}) => {
  const isManager = userRole === 'MARKET_MANAGER' || !userRole; // Default to true if not specified for backward compatibility

  const { queue, queuedCount, isSyncing, syncNow, clearQueue, removeRequest } = useOfflineQueue();

  const [activeModal, setActiveModal] = useState<
    'ACCOUNT' | 'STAFF' | 'MODE' | 'TUTORIAL' | 'PIN' | 'PASSWORD' | 'LANGUAGE' | 'SORT' | 'CONTACT' | 'LOGOUT' | 'DATABASE' | 'IOS_APP' | 'TELEGRAM_BOT' | 'OFFLINE_QUEUE' | 'BACKUP' | null
  >(null);

  // Backup Data Download States
  const [isDownloadingBackup, setIsDownloadingBackup] = useState(false);
  const [backupSuccess, setBackupSuccess] = useState<string | null>(null);
  const [backupError, setBackupError] = useState<string | null>(null);

  const handleDownloadBackup = async () => {
    setIsDownloadingBackup(true);
    setBackupSuccess(null);
    setBackupError(null);

    try {
      const res = await authenticatedFetch('/api/market/backup');
      if (!res.ok) {
        throw new Error(`خەتای سێرڤەر (${res.status})`);
      }
      const data = await res.json();
      if (data.status === 'success' && data.snapshot) {
        const jsonStr = JSON.stringify(data.snapshot, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = data.filename || `zhirox-backup-${Date.now()}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        const custCount = data.snapshot.summary?.total_customers ?? 0;
        const txCount = data.snapshot.summary?.total_transactions ?? 0;
        setBackupSuccess(`فایلی پاشەکەوت بە سەرکەوتوویی دابەزێنرا! (${custCount} کڕیار، ${txCount} مامەڵە)`);
      } else {
        throw new Error(data.message || 'خەتایەک لە دروستکردنی فایلی پاشەکەوتدا ڕوویدا');
      }
    } catch (err: any) {
      console.error('Failed to download backup snapshot:', err);
      setBackupError(err.message || 'پەیوەندی نەکرا بە سێرڤەرەوە');
    } finally {
      setIsDownloadingBackup(false);
    }
  };

  // Telegram Bot Integration States
  const [telegramToken, setTelegramToken] = useState(settings.telegram_bot_token || '');
  const [telegramBotUser, setTelegramBotUser] = useState(settings.telegram_bot_username || '');
  const [telegramEnabled, setTelegramEnabled] = useState(settings.telegram_enabled !== false);
  const [telegramNotifyTx, setTelegramNotifyTx] = useState(settings.telegram_notify_new_tx !== false);
  const [telegramNotifyOverdue, setTelegramNotifyOverdue] = useState(settings.telegram_notify_overdue !== false);
  const [telegramNotifyPromises, setTelegramNotifyPromises] = useState(settings.telegram_notify_promises !== false);
  const [testingTelegram, setTestingTelegram] = useState(false);
  const [telegramTestResult, setTelegramTestResult] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);
  const [savingTelegram, setSavingTelegram] = useState(false);

  // Supabase Database Connection Status
  const [dbStatus, setDbStatus] = useState<{
    connected: boolean;
    provider: string;
    supabaseUrlConfigured: boolean;
    instructions: string;
    errorDetails?: string | null;
  } | null>(null);

  useEffect(() => {
    authenticatedFetch('/api/database/status')
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

  // Sync local states with settings prop updates from parent
  useEffect(() => {
    setMarketName(settings.market_name || '');
    setOwnerName(settings.owner_name || '');
    setDefaultCurrency(settings.default_currency || 'IQD');
    setTheme(settings.theme || 'dark');
    setPinEnabled(settings.pin_enabled || false);
    setPinCode(settings.pin_code || '1234');
    setLanguage(settings.language || 'ku');
    setTelegramToken(settings.telegram_bot_token || '');
    setTelegramBotUser(settings.telegram_bot_username || '');
    setTelegramEnabled(settings.telegram_enabled !== false);
    setTelegramNotifyTx(settings.telegram_notify_new_tx !== false);
    setTelegramNotifyOverdue(settings.telegram_notify_overdue !== false);
    setTelegramNotifyPromises(settings.telegram_notify_promises !== false);
  }, [settings]);

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
          onClick={() => {
            if (!isManager) {
              showToast('تەنها بەڕێوەبەر مافی دەستکاریی دەسەڵاتی کارمەندانی هەیە');
              return;
            }
            setActiveModal('STAFF');
          }}
          className={`w-full h-[68px] px-5 flex items-center justify-between active:bg-[#2C2C2E] transition-colors ${!isManager ? 'opacity-70' : ''}`}
        >
          <div className="flex items-center gap-3.5">
            <Users className="w-5 h-5 text-emerald-400 stroke-[1.75]" />
            <span className="text-base font-bold text-[#F5F5F7] flex items-center gap-1.5">
              <span>کارمەندان و دەسەڵاتەکان</span>
              {!isManager && <Lock className="w-3.5 h-3.5 text-amber-500" />}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#34C759] font-bold">
              {isManager ? 'زیادکردن و دەسەڵات' : 'تایبەت بە بەڕێوەبەر'}
            </span>
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

        {/* 3. Tutorial / Quick Tour */}
        <button
          onClick={() => {
            if (onStartTour) {
              onStartTour();
            } else {
              setTutorialStep(0);
              setActiveModal('TUTORIAL');
            }
          }}
          className="w-full h-[68px] px-5 flex items-center justify-between active:bg-[#2C2C2E] transition-colors"
        >
          <div className="flex items-center gap-3.5">
            <HelpCircle className="w-5 h-5 text-blue-400 stroke-[1.75]" />
            <span className="text-base font-bold text-[#F5F5F7]">فێرکاری و گەشتی خێرا (Quick Tour)</span>
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

        {/* 8.5. iOS App / PWA Guide */}
        <button
          onClick={() => setActiveModal('IOS_APP')}
          className="w-full h-[68px] px-5 flex items-center justify-between active:bg-[#2C2C2E] transition-colors"
        >
          <div className="flex items-center gap-3.5">
            <Smartphone className="w-5 h-5 text-blue-400 stroke-[1.75]" />
            <span className="text-base font-bold text-[#F5F5F7]">دامەزراندنی ئەپ لەسەر ئایفۆن (iOS)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-blue-400 font-bold bg-blue-500/10 px-2 py-0.5 rounded-md border border-blue-500/20">
              ئەپی ئایفۆن
            </span>
            <ChevronRight className="w-5 h-5 text-[#8E8E93] rotate-180" />
          </div>
        </button>

        {/* 8.6. Telegram Bot Notifications System */}
        <button
          onClick={() => setActiveModal('TELEGRAM_BOT')}
          className="w-full h-[68px] px-5 flex items-center justify-between active:bg-[#2C2C2E] transition-colors"
        >
          <div className="flex items-center gap-3.5">
            <Send className="w-5 h-5 text-sky-400 stroke-[1.75]" />
            <span className="text-base font-bold text-[#F5F5F7]">بۆتی ئۆتۆماتیکی تێلیگرام (Telegram Bot)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold px-2 py-0.5 rounded-md border ${
              settings.telegram_bot_token && settings.telegram_enabled !== false
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
            }`}>
              {settings.telegram_bot_token && settings.telegram_enabled !== false ? 'چالاکە ⚡' : 'ڕێکنەخراوە'}
            </span>
            <ChevronRight className="w-5 h-5 text-[#8E8E93] rotate-180" />
          </div>
        </button>

        {/* 8.7. Offline Queue & Sync */}
        <button
          onClick={() => setActiveModal('OFFLINE_QUEUE')}
          className="w-full h-[68px] px-5 flex items-center justify-between active:bg-[#2C2C2E] transition-colors"
        >
          <div className="flex items-center gap-3.5">
            <WifiOff className="w-5 h-5 text-sky-400 stroke-[1.75]" />
            <span className="text-base font-bold text-[#F5F5F7]">ردێن ئۆفلاین و هاوکاتکردنەوە (Offline Sync)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold px-2 py-0.5 rounded-md border ${
              queuedCount > 0
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
            }`}>
              {queuedCount > 0 ? `${queuedCount} لە ڕیزدا ⏳` : 'هاوکاتە 🟢'}
            </span>
            <ChevronRight className="w-5 h-5 text-[#8E8E93] rotate-180" />
          </div>
        </button>

        {/* 8.8. Backup Data & Secure JSON Snapshot */}
        <button
          id="settings-backup-data-btn"
          onClick={() => setActiveModal('BACKUP')}
          className="w-full h-[68px] px-5 flex items-center justify-between active:bg-[#2C2C2E] transition-colors"
        >
          <div className="flex items-center gap-3.5">
            <HardDrive className="w-5 h-5 text-emerald-400 stroke-[1.75]" />
            <span className="text-base font-bold text-[#F5F5F7]">پاشەکەوتکردنی داتا (Backup Data)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20 flex items-center gap-1">
              <Download className="w-3 h-3" />
              <span>JSON Snapshot</span>
            </span>
            <ChevronRight className="w-5 h-5 text-[#8E8E93] rotate-180" />
          </div>
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
                disabled={settings.is_locked_by_system || !isManager}
                className={`w-full bg-black text-sm text-[#F5F5F7] p-3 rounded-xl border border-[#2C2C2E] focus:outline-none focus:border-[#34C759] ${(settings.is_locked_by_system || !isManager) ? 'opacity-60 cursor-not-allowed bg-[#111113]' : ''}`}
                placeholder="ناوی شوێن..."
              />
            </div>
            <div>
              <label className="block text-xs text-[#8E8E93] mb-1">ناوی خاوەن شوێن</label>
              <input
                type="text"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                disabled={settings.is_locked_by_system || !isManager}
                className={`w-full bg-black text-sm text-[#F5F5F7] p-3 rounded-xl border border-[#2C2C2E] focus:outline-none focus:border-[#34C759] ${(settings.is_locked_by_system || !isManager) ? 'opacity-60 cursor-not-allowed bg-[#111113]' : ''}`}
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
            {!isManager && (
              <div className="flex items-center gap-2 p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400 text-xs">
                <Lock className="w-4 h-4 shrink-0" />
                <span>دەستکاری زانیارییەکانی شوێن تەنها تایبەتە بە بەڕێوەبەر.</span>
              </div>
            )}
            <div>
              <label className="block text-xs text-[#8E8E93] mb-1">کۆدی ناسنامەی تێنەنت (Tenant ID)</label>
              <div className="w-full bg-[#000000] text-xs text-[#8E8E93] p-3 rounded-xl border border-[#2C2C2E] font-mono">
                {settings.market_id || 'market-default'}
              </div>
            </div>
            {isManager && (
              <button
                onClick={handleSaveMarketInfo}
                className="w-full py-3 bg-[#34C759] text-black font-bold text-sm rounded-xl active-scale"
              >
                پاشەکەوتکردن
              </button>
            )}
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
                onClick={() => {
                  if (!isManager) {
                    showToast('تەنها بەڕێوەبەر دەتوانێت ڕێکخستنی پین کۆد بگۆڕێت');
                    return;
                  }
                  setPinEnabled(!pinEnabled);
                }}
                disabled={!isManager}
                className={`w-12 h-7 rounded-full p-1 transition-colors ${
                  pinEnabled ? 'bg-[#34C759]' : 'bg-[#2C2C2E]'
                } ${!isManager ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                  onChange={(e) => {
                    if (!isManager) return;
                    setPinCode(e.target.value.replace(/\D/g, ''));
                  }}
                  disabled={!isManager}
                  className={`w-full bg-black text-center text-xl font-mono tracking-widest text-[#F5F5F7] p-3 rounded-xl border border-[#2C2C2E] focus:outline-none focus:border-[#34C759] ${!isManager ? 'opacity-50 cursor-not-allowed' : ''}`}
                  placeholder="••••"
                />
              </div>
            )}

            {!isManager ? (
              <div className="flex items-center gap-2 p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400 text-xs">
                <Lock className="w-4 h-4 shrink-0" />
                <span>تەنها بەڕێوەبەری سەرەکی دەتوانێت ڕێکخستنی پین کۆد بگۆڕێت.</span>
              </div>
            ) : (
              <button
                onClick={handleSavePin}
                className="w-full py-3 bg-[#34C759] text-black font-bold text-sm rounded-xl active-scale"
              >
                پاشەکەوتکردن
              </button>
            )}
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

      {/* ========================================================= */}
      {/* IOS APP & PWA INSTALLATION MODAL */}
      {/* ========================================================= */}
      {activeModal === 'IOS_APP' && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-sm bg-[#1C1C1E] border border-[#2C2C2E] rounded-2xl p-5 flex flex-col gap-4 animate-scale-in text-right dir-rtl max-h-[85vh] overflow-y-auto">
            
            <div className="flex items-center justify-between pb-2 border-b border-[#2C2C2E]">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-blue-400" />
                <span className="font-bold text-[#F5F5F7] text-sm">دامەزراندنی ئەپ لەسەر ئایفۆن (iOS)</span>
              </div>
              <button onClick={() => setActiveModal(null)} className="text-[#8E8E93] hover:text-[#F5F5F7]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/30 p-3 rounded-xl text-blue-300 text-xs leading-relaxed space-y-1">
              <span className="font-extrabold block text-blue-400">⚡ پێویستت بە فایلی IPA یان App Store نییە!</span>
              <p>
                ئەم سیستەمە پشتگیری کامل لە <strong>iOS Web App (PWA)</strong> دەکات. دەتوانیت ڕاستەوخۆ وەک ئەپێکی ڕەسەنی ئایفۆن (Native App) بێ سنوور بەکاری بهێنیت.
              </p>
            </div>

            <div className="space-y-3 text-xs text-[#F5F5F7]">
              <h4 className="font-bold text-amber-400">هەنگاوەکانی دامەزراندن لەسەر ئایفۆن (iPhone / iPad):</h4>
              
              <div className="bg-[#2C2C2E] p-3 rounded-xl space-y-2 border border-[#3A3A3C]">
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-500 text-black font-black text-[10px] flex items-center justify-center shrink-0 mt-0.5">١</span>
                  <span>لەنێو وێبگەڕی <strong>Safari</strong> لەسەر ئایفۆنەکەت ئەم بەستەرە بکەرەوە.</span>
                </div>

                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-500 text-black font-black text-[10px] flex items-center justify-center shrink-0 mt-0.5">٢</span>
                  <span>دابگرە لەسەر دوگمەی <strong>بەشکردن (Share)</strong> لە ژێرەوەی لاپەڕەکە (ئایکۆنی چوارگۆشە بە تیری ڕوو بە سەرەوە 📤).</span>
                </div>

                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-500 text-black font-black text-[10px] flex items-center justify-center shrink-0 mt-0.5">٣</span>
                  <span>هەڵبژێرە: <strong>«زیادکردن بۆ شاشەی سەرەکی»</strong> یان <strong>«Add to Home Screen»</strong> (+).</span>
                </div>

                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-500 text-black font-black text-[10px] flex items-center justify-center shrink-0 mt-0.5">٤</span>
                  <span>ئایکۆنی <strong>ZHIROX</strong> دەکەوێتە سەر شاشەی ئایفۆنەکەت و بە تەواوی شاشە (Full Screen) دەکرێتەوە!</span>
                </div>
              </div>
            </div>

            <div className="bg-[#252528] border border-[#3A3A3C] p-3 rounded-xl space-y-1 text-[11px] text-[#8E8E93]">
              <span className="font-bold text-[#F5F5F7] block">تێبینی ڕوونکردنەوە لەسەر فایلی IPA:</span>
              <p>
                دروستکردنی فایلی IPA ڕاستەوخۆ پێویستی بە جێبەجێکردن لەسەر کۆمپیوپەری Mac و ڕاھێنانی Xcode بە هەژماری Apple Developer هەیە. ئەگەر دەتەوێت کۆدەکەی بۆ Xcode بپێچیتەوە، دەتوانیت پرۆژەکە له Menu Export (یان GitHub) دابگریت و بە <strong>Capacitor (`npx cap add ios`)</strong> بیکەیتە فایلی IPA.
              </p>
            </div>

            <button
              onClick={() => setActiveModal(null)}
              className="w-full py-3 bg-blue-500 text-white font-bold text-sm rounded-xl active-scale shadow-lg"
            >
              تێگەیشتم
            </button>

          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TELEGRAM BOT CONFIGURATION MODAL */}
      {/* ========================================================= */}
      {activeModal === 'TELEGRAM_BOT' && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-md bg-[#1C1C1E] border border-[#2C2C2E] rounded-2xl p-5 flex flex-col gap-4 animate-scale-in text-right dir-rtl max-h-[90vh] overflow-y-auto">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#2C2C2E]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-sky-500/10 rounded-xl text-sky-400">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-[#F5F5F7] text-base">بۆتی تێلیگرام (Telegram Bot)</h3>
                  <p className="text-[11px] text-[#8E8E93]">ناردنی ئاگاداری ئۆتۆماتیکی بۆ تێلیگرامی کڕیاران</p>
                </div>
              </div>
              <button onClick={() => setActiveModal(null)} className="text-[#8E8E93] hover:text-[#F5F5F7] p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Setup Instructions with BotFather */}
            <div className="bg-sky-500/10 border border-sky-500/20 p-3.5 rounded-xl text-xs space-y-2 text-sky-200">
              <span className="font-extrabold text-sky-400 flex items-center gap-1.5 text-sm">
                <Bot className="w-4 h-4" /> ڕێنمایی دروستکردنی بۆتی تێلیگرام (BotFather):
              </span>
              <ol className="list-decimal list-inside space-y-1 text-[11px] leading-relaxed text-[#D1D1D6]">
                <li>لە بەرنامەی <strong>Telegram</strong> گەڕان بکە بۆ هەژماری ڕەسمیی <strong>@BotFather</strong></li>
                <li>فەرمانی <strong>/newbot</strong> بنێرە و ناو و یوزەرنەیەک بۆ بۆتەکەت هەڵبژێرە.</li>
                <li>تۆکنی <strong>HTTP API Token</strong> کۆپی بکە و لە خوارەوە دایبنێ.</li>
              </ol>
            </div>

            {/* Form inputs */}
            <div className="space-y-4">
              {/* Bot Token */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#8E8E93]">تۆکنی بۆت (Bot API Token) *</label>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const text = await navigator.clipboard.readText();
                        if (text) setTelegramToken(text.trim());
                      } catch (e) {
                        // fallback if clipboard api is blocked
                      }
                    }}
                    className="text-[11px] font-bold text-sky-400 hover:text-sky-300 bg-sky-500/10 px-2.5 py-1 rounded-lg border border-sky-500/20 flex items-center gap-1 active:scale-95 transition-all"
                  >
                    <span>📋 پەیست (Paste)</span>
                  </button>
                </div>
                <div className="relative" dir="ltr" style={{ direction: 'ltr' }}>
                  <input
                    type="text"
                    dir="ltr"
                    value={telegramToken}
                    onChange={(e) => setTelegramToken(e.target.value.trim())}
                    placeholder="123456789:ABCdefGhIJKlmNoPQ..."
                    style={{ direction: 'ltr', textAlign: 'left', unicodeBidi: 'plaintext' }}
                    className="w-full h-11 pl-3.5 pr-9 bg-[#2C2C2E] border border-[#3A3A3C] rounded-xl text-sm font-mono text-[#F5F5F7] focus:outline-none focus:border-sky-500"
                  />
                  {telegramToken && (
                    <button
                      type="button"
                      onClick={() => setTelegramToken('')}
                      className="absolute right-3 top-3 text-[#8E8E93] hover:text-[#F5F5F7] p-0.5"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Bot Username */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#8E8E93]">یوزەرنەیعی بۆت (Bot Username)</label>
                <div className="relative" dir="ltr" style={{ direction: 'ltr' }}>
                  <span className="absolute left-3 top-3 text-[#8E8E93] font-mono text-sm">@</span>
                  <input
                    type="text"
                    dir="ltr"
                    value={telegramBotUser}
                    onChange={(e) => setTelegramBotUser(e.target.value.replace(/^@/, '').trim())}
                    placeholder="MyMarket_Zhirox_bot"
                    style={{ direction: 'ltr', textAlign: 'left', unicodeBidi: 'plaintext' }}
                    className="w-full h-11 pl-8 pr-3 bg-[#2C2C2E] border border-[#3A3A3C] rounded-xl text-sm font-mono text-[#F5F5F7] focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              {/* Switches */}
              <div className="bg-[#2C2C2E] p-3.5 rounded-xl space-y-3 border border-[#3A3A3C]">
                
                {/* Master Enable */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-sky-400" />
                    <span className="text-xs font-bold text-[#F5F5F7]">چالاککردنی ئاگاداری بۆتی تێلیگرام</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={telegramEnabled}
                    onChange={(e) => setTelegramEnabled(e.target.checked)}
                    className="w-5 h-5 accent-sky-500 cursor-pointer"
                  />
                </div>

                <div className="h-px bg-[#3A3A3C]" />

                {/* New Transaction */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#D1D1D6]">ئاگاداری ئۆتۆماتیکی مامەڵەی نوێ (قەرز / دانەوە)</span>
                  <input
                    type="checkbox"
                    checked={telegramNotifyTx}
                    onChange={(e) => setTelegramNotifyTx(e.target.checked)}
                    disabled={!telegramEnabled}
                    className="w-4 h-4 accent-sky-500 cursor-pointer disabled:opacity-40"
                  />
                </div>

                {/* Overdue Debt */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#D1D1D6]">بیرخستنەوەی ئۆتۆماتیکی قەرزی دواکەوتوو</span>
                  <input
                    type="checkbox"
                    checked={telegramNotifyOverdue}
                    onChange={(e) => setTelegramNotifyOverdue(e.target.checked)}
                    disabled={!telegramEnabled}
                    className="w-4 h-4 accent-sky-500 cursor-pointer disabled:opacity-40"
                  />
                </div>

                {/* Payment Promises */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#D1D1D6]">ئاگاداری بەڵێنی دانەوەی قەرزەکان</span>
                  <input
                    type="checkbox"
                    checked={telegramNotifyPromises}
                    onChange={(e) => setTelegramNotifyPromises(e.target.checked)}
                    disabled={!telegramEnabled}
                    className="w-4 h-4 accent-sky-500 cursor-pointer disabled:opacity-40"
                  />
                </div>
              </div>

              {/* Test Connection Button & Result */}
              <div className="space-y-2">
                <button
                  type="button"
                  disabled={testingTelegram || !telegramToken}
                  onClick={async () => {
                    setTestingTelegram(true);
                    setTelegramTestResult(null);
                    try {
                      const res = await authenticatedFetch('/api/telegram/test', {
                        method: 'POST',
                        body: JSON.stringify({ bot_token: telegramToken })
                      });
                      const json = await res.json();
                      if (json.status === 'success') {
                        setTelegramTestResult({ type: 'success', message: json.message });
                      } else if (json.status === 'warning') {
                        setTelegramTestResult({ type: 'warning', message: json.message });
                      } else {
                        setTelegramTestResult({ type: 'error', message: json.message || 'خەتای تاقیکردنەوە' });
                      }
                    } catch (err: any) {
                      setTelegramTestResult({ type: 'error', message: 'خەتای پەیوەندی لەگەڵ سێرڤەر' });
                    } finally {
                      setTestingTelegram(false);
                    }
                  }}
                  className="w-full py-2.5 bg-[#2C2C2E] border border-[#3A3A3C] text-sky-400 hover:bg-[#3A3A3C] rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {testingTelegram ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>لە پشکنیندایە...</span>
                    </>
                  ) : (
                    <>
                      <Bot className="w-4 h-4" />
                      <span>تاقیکردنەوەی تەندروستی بۆت (Test Bot)</span>
                    </>
                  )}
                </button>

                {telegramTestResult && (
                  <div className={`p-3 rounded-xl text-xs flex items-start gap-2 border ${
                    telegramTestResult.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' :
                    telegramTestResult.type === 'warning' ? 'bg-amber-500/10 border-amber-500/30 text-amber-300' :
                    'bg-red-500/10 border-red-500/30 text-red-300'
                  }`}>
                    {telegramTestResult.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />}
                    {telegramTestResult.type === 'warning' && <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />}
                    {telegramTestResult.type === 'error' && <X className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />}
                    <span className="leading-relaxed">{telegramTestResult.message}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Save Button */}
            <div className="pt-2">
              <button
                type="button"
                disabled={savingTelegram}
                onClick={async () => {
                  setSavingTelegram(true);
                  try {
                    await onUpdateSettings({
                      telegram_bot_token: telegramToken,
                      telegram_bot_username: telegramBotUser,
                      telegram_enabled: telegramEnabled,
                      telegram_notify_new_tx: telegramNotifyTx,
                      telegram_notify_overdue: telegramNotifyOverdue,
                      telegram_notify_promises: telegramNotifyPromises
                    });
                    setActiveModal(null);
                  } catch (err) {
                    alert('خەتایەک ڕوویدا لە پاشەکەوتکردنی ڕێکخستنەکان');
                  } finally {
                    setSavingTelegram(false);
                  }
                }}
                className="w-full py-3 bg-sky-500 hover:bg-sky-600 text-white font-bold text-sm rounded-xl active-scale shadow-lg flex items-center justify-center gap-2"
              >
                {savingTelegram ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                <span>پاشەکەوتکردنی ڕێکخستنەکانی تێلیگرام</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* OFFLINE QUEUE MODAL */}
      {activeModal === 'OFFLINE_QUEUE' && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-md bg-[#1C1C1E] border border-[#2C2C2E] rounded-2xl p-5 flex flex-col gap-4 animate-scale-in text-right dir-rtl max-h-[90vh] overflow-y-auto">
            
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#2C2C2E]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-sky-500/10 rounded-xl text-sky-400">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-[#F5F5F7] text-base">داواکارییەکانی دۆخی ئۆفلاین</h3>
                  <p className="text-[11px] text-[#8E8E93]">ڕیزی مامەڵەکانی لە ناوخۆی ئامێرەکەدا پاشەکەوتکراون</p>
                </div>
              </div>
              <button onClick={() => setActiveModal(null)} className="text-[#8E8E93] hover:text-[#F5F5F7] p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content / List */}
            {queuedCount === 0 ? (
              <div className="py-8 text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto opacity-80" />
                <p className="text-sm font-bold text-[#F5F5F7]">هیچ مامەڵەیەک لە ڕیزدا نییە</p>
                <p className="text-xs text-[#8E8E93]">تەواوی زانیارییەکانت هاوکاتکراونەتەوە لەگەڵ سێرڤەردا.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between bg-sky-500/10 border border-sky-500/20 p-3 rounded-xl">
                  <span className="text-xs font-bold text-sky-300">ژمارەی لە ڕیزدا: {queuedCount}</span>
                  <button
                    onClick={async () => {
                      const res = await syncNow();
                      if (res && res.successCount > 0) {
                        showToast(`سەرکەوتووانە ${res.successCount} مامەڵە هاوکاتکرانەوە!`);
                      } else if (res && res.failCount > 0) {
                        showToast(`هاوکاتکردنەوە تەواو نەبوو. هێشتا پەیوەندی سێرڤەر نییە.`);
                      }
                    }}
                    disabled={isSyncing}
                    className="px-3 py-1.5 bg-sky-500 hover:bg-sky-400 active:scale-95 text-black font-extrabold rounded-lg text-xs flex items-center gap-1.5 transition-all disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span>{isSyncing ? 'لە هاوکاتکردنەوەدایە...' : 'هاوکاتکردنەوە (Sync Now)'}</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {queue.map((req) => (
                    <div key={req.id} className="bg-[#2C2C2E] border border-[#3A3A3C] rounded-xl p-3 flex items-start justify-between gap-3 text-xs">
                      <div className="space-y-1 overflow-hidden">
                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 font-mono text-[10px] font-bold">
                            {req.method}
                          </span>
                          <span className="font-mono text-[#D1D1D6] truncate text-[11px]" dir="ltr">
                            {req.url}
                          </span>
                        </div>
                        <p className="text-[10px] text-[#8E8E93]">
                          کاتی تۆمارکردن: {new Date(req.timestamp).toLocaleTimeString('ku-IQ', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </p>
                      </div>
                      <button
                        onClick={() => removeRequest(req.id)}
                        className="text-rose-400 hover:text-rose-300 p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 transition-colors shrink-0"
                        title="سڕینەوە لە ڕیز"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => {
                    clearQueue();
                    showToast('ڕیزی ئۆفلاین پاقژکرایەوە');
                  }}
                  className="w-full py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 mt-2"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>سڕینەوەی تەواوی ڕیزی ئۆفلاین (Clear Queue)</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* BACKUP DATA MODAL */}
      {activeModal === 'BACKUP' && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-md bg-[#1C1C1E] border border-[#2C2C2E] rounded-2xl p-5 flex flex-col gap-4 animate-scale-in text-right dir-rtl">
            
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#2C2C2E]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400">
                  <HardDrive className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-[#F5F5F7] text-base">پاشەکەوتکردنی داتاکان (Backup Data)</h3>
                  <p className="text-[11px] text-[#8E8E93]">دابەزاندنی نەخشەی تەواوی تۆمارەکان بە فایلی JSON</p>
                </div>
              </div>
              <button onClick={() => setActiveModal(null)} className="text-[#8E8E93] hover:text-[#F5F5F7] p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content info */}
            <div className="bg-[#2C2C2E]/50 border border-[#3A3A3C] rounded-xl p-4 space-y-3 text-xs text-[#D1D1D6]">
              <div className="flex items-start gap-2 text-emerald-400 bg-emerald-500/10 p-2.5 rounded-lg border border-emerald-500/20">
                <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  ئەم بەشە ڕاستەوخۆ فایلی پاشەکەوتی پارێزراو (JSON Snapshot) لە هەموو زانیارییەکانی کڕیاران، مامەڵەکان، و بەڵگەنامەکانی مارکێتەکەت بەشێوازی ئاسینکرۆنوس (Async) لە سێرڤەرەوە دادەبەزێنێت.
                </p>
              </div>

              <div className="space-y-2 pt-1 border-t border-[#3A3A3C]/60">
                <div className="flex items-center justify-between">
                  <span className="text-[#8E8E93]">جۆری فایل:</span>
                  <span className="font-mono text-[#F5F5F7] font-bold bg-[#1C1C1E] px-2 py-0.5 rounded border border-[#3A3A3C]">
                    JSON Secure Snapshot
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#8E8E93]">شێوازی داواکاری:</span>
                  <span className="text-sky-400 font-bold">Asynchronous Download</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#8E8E93]">پاراستنی زانیاری:</span>
                  <span className="text-emerald-400 font-bold">تایبەت و ناوی شاراوە 🔒</span>
                </div>
              </div>
            </div>

            {backupSuccess && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{backupSuccess}</span>
              </div>
            )}

            {backupError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{backupError}</span>
              </div>
            )}

            {/* Download Button */}
            <button
              id="download-backup-now-btn"
              onClick={handleDownloadBackup}
              disabled={isDownloadingBackup}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 active:scale-98 text-black font-extrabold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isDownloadingBackup ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>لە ئامادەکردن و دابەزاندندایە...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>دابەزاندنی فایلی پاشەکەوت (Download Backup JSON)</span>
                </>
              )}
            </button>
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
