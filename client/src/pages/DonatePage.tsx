import React from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { Button, Surface } from '@/components/ui';

const ShieldIcon = () => (
  <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
    <path fillRule="evenodd" d="M10 1.944A11.954 11.954 0 012.166 5C2.056 5.649 2 6.318 2 7c0 5.225 3.34 9.67 8 11.317C14.66 16.67 18 12.225 18 7c0-.682-.057-1.35-.166-2.001A11.954 11.954 0 0110 1.944zM11 14a1 1 0 11-2 0 1 1 0 012 0zm0-7a1 1 0 10-2 0v3a1 1 0 102 0V7z" clipRule="evenodd"/>
  </svg>
);
const LockIcon = () => (
  <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/>
  </svg>
);
const DriveIcon = () => (
  <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
    <path d="M3 12a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1v-3z"/>
    <path d="M5 4a1 1 0 011-1h8a1 1 0 011 1v5H5V4z"/>
  </svg>
);

export const DonatePage: React.FC = () => {
  const { theme } = useTheme();

  const badges = [
    { Icon: ShieldIcon, label: '100% free forever', color: '#16a34a' },
    { Icon: LockIcon, label: 'No ads or tracking', color: '#f59e0b' },
    { Icon: DriveIcon, label: 'Your data, your device', color: theme.accent },
  ];

  const options = [
    {
      title: 'Buy Me a Coffee',
      sub: 'One-time donation, any amount',
      url: 'https://buymeacoffee.com/larsmikki',
      label: 'Buy Me a Coffee',
    },
    {
      title: 'PayPal',
      sub: 'Quick donation through PayPal',
      url: 'https://paypal.me/larsmikki',
      label: 'Donate via PayPal',
    },
  ];

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-text">Support Vaulty</h1>
        <p className="text-sm mt-0.5 text-text2">
          I build privacy-first, self-hosted tools with no subscriptions, no ads, and no tracking.
          Your data stays yours.
        </p>
      </div>

      <Surface className="p-6 mb-5">
        <h2 className="text-base font-bold mb-1 text-text">What you get</h2>
        <p className="text-xs mb-5 text-text2">Vaulty stays free, open source, and self-hosted.</p>
        <div className="flex flex-wrap gap-2">
          {badges.map(({ Icon, label, color }) => (
            <div
              key={label}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: `${color}15`, color, border: `1px solid ${color}20` }}
            >
              <Icon />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </Surface>

      <Surface className="p-6 mb-5">
        <h2 className="text-base font-bold mb-1 text-text">Donate</h2>
        <p className="text-xs mb-5 text-text2">One-time donations through Buy Me a Coffee or PayPal.</p>
        <div className="grid sm:grid-cols-2 gap-4">
          {options.map(({ title, sub, url, label }) => (
            <div
              key={title}
              className="flex flex-col items-center text-center gap-4 rounded-xl p-6"
              style={{ background: theme.surface2, border: `1px solid ${theme.border}` }}
            >
              <div>
                <h3 className="text-base font-bold leading-snug mb-1 text-text">{title}</h3>
                <p className="text-xs text-text2">{sub}</p>
              </div>
              <Button
                variant="primary"
                size="lg"
                fullWidth
                onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
              >
                {label}
              </Button>
            </div>
          ))}
        </div>
      </Surface>

      <Surface className="p-6">
        <h2 className="text-base font-bold mb-1 text-text">Thank you</h2>
        <p className="text-xs text-text2">Every bit of support helps keep Vaulty available for everyone.</p>
      </Surface>
    </div>
  );
};
