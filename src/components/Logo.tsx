interface LogoProps {
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({ className = 'h-9 w-9' }) => (
  <img
    src="/favicon.svg"
    alt="EduPlay logo"
    width={36}
    height={36}
    className={`shrink-0 select-none ${className}`}
  />
);