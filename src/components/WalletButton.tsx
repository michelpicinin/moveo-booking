export function WalletButton({ href, label }: { href: string; label: string }) {
  return (
    <a className="wallet-btn" href={href}>
      <svg viewBox="0 0 24 24" aria-hidden="true" fill="none">
        <rect x="2" y="4" width="20" height="16" rx="3" fill="#fff" />
        <rect x="2" y="4" width="20" height="4" rx="2" fill="#5fc3e4" />
        <rect x="2" y="7" width="20" height="4" fill="#f7c331" />
        <rect x="2" y="10" width="20" height="4" fill="#f26a5d" />
        <path d="M2 13h6a4 4 0 0 0 8 0h6v4a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3z" fill="#e8e8e8" />
      </svg>
      {label}
    </a>
  );
}
