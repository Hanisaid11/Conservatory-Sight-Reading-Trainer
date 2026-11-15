import React, { useState } from 'react';
import { Download, Smartphone } from 'lucide-react';
import { usePWAInstall, useOnlineStatus } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  lang: 'en' | 'ar';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ lang }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors cursor-pointer shadow-2xs shrink-0"
      >
        <Download className="w-3.5 h-3.5" />
        <span>{lang === 'ar' ? 'تثبيت التطبيق' : 'Install App'}</span>
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowGuideModal(true)}
        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-indigo-50 border border-indigo-200 text-indigo-900 hover:bg-indigo-100 transition-colors cursor-pointer shrink-0"
      >
        <Smartphone className="w-3.5 h-3.5 text-indigo-600" />
        <span>{lang === 'ar' ? 'تثبيت' : 'Install'}</span>
      </button>

      {showGuideModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
          dir={lang === 'ar' ? 'rtl' : 'ltr'}
        >
          <div className="w-full max-w-sm rounded-2xl bg-white border border-slate-200 p-5 space-y-4 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-xl font-serif shrink-0">
                𝄞
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {lang === 'ar'
                    ? 'تثبيت التطبيق على هاتفك'
                    : 'Install App on Your Phone'}
                </h3>
                <p className="text-xs text-slate-500">
                  {lang === 'ar'
                    ? 'يعمل كتطبيق مستقل بكامل الشاشة وبدون إنترنت'
                    : 'Works full-screen and offline as a standalone app'}
                </p>
              </div>
            </div>

            {isIOS ? (
              <div className="text-xs text-slate-700 space-y-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 leading-relaxed">
                <p>
                  {lang === 'ar'
                    ? '1. اضغط على زر المشاركة (Share) في شريط متصفح Safari.'
                    : '1. Tap the Share button in the Safari toolbar.'}
                </p>
                <p>
                  {lang === 'ar'
                    ? '2. اختر "إضافة إلى الشاشة الرئيسية" (Add to Home Screen).'
                    : '2. Scroll down and tap "Add to Home Screen".'}
                </p>
              </div>
            ) : (
              <div className="text-xs text-slate-700 space-y-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 leading-relaxed">
                <p>
                  {lang === 'ar'
                    ? '1. افتح قائمة المتصفح (النقاط الثلاث ⋮ في أعلى متصفح Chrome).'
                    : '1. Open the browser menu (three dots ⋮ in Chrome).'}
                </p>
                <p>
                  {lang === 'ar'
                    ? '2. اضغط على "تثبيت التطبيق" (Install app) أو "إضافة إلى الشاشة الرئيسية".'
                    : '2. Tap "Install app" or "Add to Home screen".'}
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 py-2.5 text-xs font-bold text-white transition-colors cursor-pointer"
            >
              {lang === 'ar' ? 'حسناً' : 'Got It'}
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC<{ lang: 'en' | 'ar' }> = ({ lang }) => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-18 left-4 z-50 flex items-center gap-2 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white shadow-lg">
      <span>
        {lang === 'ar'
          ? 'وضع عدم الاتصال — يعمل التطبيق بدون إنترنت'
          : 'Offline Mode — Cached app data active'}
      </span>
    </div>
  );
};
