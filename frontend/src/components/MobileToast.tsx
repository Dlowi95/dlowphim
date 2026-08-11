"use client";

interface MobileToastProps {
  toast: {
    message: string;
    type: "success" | "error" | "warning";
  };
  onClose: () => void;
}

export default function MobileToast({ toast, onClose }: MobileToastProps) {
  const accentColor = toast.type === "success" ? "#22c55e" : "#ef4444";

  return (
    <div
      style={{
        position: "fixed",
        bottom: "calc(7rem + env(safe-area-inset-bottom))",
        left: "12px",
        right: "12px",
        zIndex: 999999,
      }}
      className="animate-toast-slide-up select-none md:hidden"
    >
      <div
        style={{
          backgroundColor: "rgba(15, 17, 23, 0.9)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          boxShadow: "0 14px 32px rgba(0, 0, 0, 0.45)",
        }}
        className="w-full overflow-hidden rounded-2xl text-white"
      >
        <div className="flex items-center gap-2.5 p-3">
          <span
            style={{ backgroundColor: accentColor }}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white shadow-lg"
          >
            {toast.type === "success" ? (
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none stroke-current [stroke-width:3.5]">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <span className="text-xs font-black leading-none">!</span>
            )}
          </span>

          <p className="min-w-0 flex-1 text-left text-xs font-semibold leading-snug text-zinc-100">
            {toast.message}
          </p>

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng thông báo"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white/45 transition-colors active:bg-white/10 active:text-white"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none stroke-current [stroke-width:2.5]">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="h-[3px] w-full bg-white/[0.08]">
          <div
            key={toast.message}
            className="toast-progress-bar h-full origin-left"
            style={{ backgroundColor: accentColor }}
          />
        </div>
      </div>
    </div>
  );
}
