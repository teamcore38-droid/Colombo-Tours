import { useTheme } from '../context/ThemeContext';

export function BrandLogo({ variant = 'compact', className = '' }) {
  const { isDark } = useTheme();

  if (variant === 'full') {
    const src = isDark
      ? '/brand/colombo-tours-lockup-dark.png'
      : '/brand/colombo-tours-lockup-light.png';
    return (
      <img
        src={src}
        alt="Colombo Tours — Built Trust in Excellence"
        className={`h-24 w-auto object-contain select-none ${className}`}
        width="276"
        height="203"
      />
    );
  }

  const emblemSrc = isDark
    ? '/brand/colombo-tours-emblem-dark.png'
    : '/brand/colombo-tours-emblem-light.png';

  return (
    <span className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      <img
        src={emblemSrc}
        alt="Colombo Tours logo"
        className="h-9 w-auto object-contain shrink-0 sm:h-10"
        width="46"
        height="40"
      />
      <span className="flex flex-col leading-none">
        <span className="font-display text-[1.05rem] sm:text-[1.15rem] font-semibold tracking-wide text-[var(--text-primary)]">
          Colombo
        </span>
        <span className="font-display text-[0.95rem] sm:text-[1.05rem] font-semibold tracking-wide text-[var(--gold-accent)] -mt-0.5">
          Tours
        </span>
      </span>
    </span>
  );
}
