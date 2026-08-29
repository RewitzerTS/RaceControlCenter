import { useEffect, useState } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import { nextChallengeRotation, type DriverChallenge } from './driverHome';

export function ChallengeRotationCountdown({ challenges }: { challenges: DriverChallenge[] }) {
  const { t } = useI18n();
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    const timer = globalThis.setInterval(() => setNow(Date.now()), 30_000);
    return () => globalThis.clearInterval(timer);
  }, []);

  const rotationAt = nextChallengeRotation(challenges, now);
  if (!rotationAt) return null;

  const remainingMinutes = Math.max(0, Math.ceil((rotationAt - now) / 60_000));
  const days = Math.floor(remainingMinutes / 1_440);
  const hours = Math.floor((remainingMinutes % 1_440) / 60);
  const minutes = remainingMinutes % 60;

  return (
    <p className="challenge-countdown">
      <span>{t('career.challengeRotation')}</span>
      <strong>{t('career.challengeCountdownValue', { days, hours, minutes })}</strong>
    </p>
  );
}
