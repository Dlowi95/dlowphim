"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Loader2, X } from "lucide-react";

type ConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "warning";
};

type PendingConfirmation = ConfirmOptions & {
  resolve: (confirmed: boolean) => void;
};

export function useConfirmDialog() {
  const [pending, setPending] = useState<PendingConfirmation | null>(null);
  const [confirming, setConfirming] = useState(false);
  const pendingRef = useRef<PendingConfirmation | null>(null);

  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  useEffect(() => () => pendingRef.current?.resolve(false), []);

  const confirm = useCallback((options: ConfirmOptions) => {
    pendingRef.current?.resolve(false);
    return new Promise<boolean>((resolve) => {
      setPending({
        title: "Xác nhận thao tác",
        confirmLabel: "Xác nhận",
        cancelLabel: "Hủy",
        tone: "danger",
        ...options,
        resolve,
      });
    });
  }, []);

  const finish = useCallback((confirmed: boolean) => {
    if (!pendingRef.current || confirming) return;
    setConfirming(true);
    pendingRef.current.resolve(confirmed);
    pendingRef.current = null;
    setPending(null);
    setConfirming(false);
  }, [confirming]);

  const confirmDialog = typeof document !== "undefined" && pending
    ? createPortal(
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) finish(false);
          }}
        >
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="global-confirm-title"
            aria-describedby="global-confirm-message"
            className="w-full max-w-md overflow-hidden rounded-3xl border border-red-500/25 bg-[#101119] shadow-[0_28px_90px_rgba(0,0,0,0.65)]"
          >
            <div className="flex items-start gap-4 p-6">
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${pending.tone === "warning" ? "bg-amber-500/10 text-amber-400" : "bg-red-500/10 text-red-400"}`}>
                <AlertTriangle size={23} />
              </div>
              <div className="min-w-0 flex-1 text-left">
                <h3 id="global-confirm-title" className="text-base font-black text-white">
                  {pending.title}
                </h3>
                <p id="global-confirm-message" className="mt-2 text-sm font-medium leading-6 text-zinc-400">
                  {pending.message}
                </p>
              </div>
              <button
                type="button"
                aria-label="Đóng popup xác nhận"
                onClick={() => finish(false)}
                className="rounded-xl p-2 text-zinc-500 transition-colors hover:bg-white/5 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex justify-end gap-3 border-t border-white/5 bg-black/15 px-6 py-4">
              <button
                type="button"
                onClick={() => finish(false)}
                className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-xs font-extrabold text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
              >
                {pending.cancelLabel}
              </button>
              <button
                type="button"
                onClick={() => finish(true)}
                className={`flex min-w-28 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-extrabold text-white transition-colors ${pending.tone === "warning" ? "bg-amber-500 hover:bg-amber-600" : "bg-red-500 hover:bg-red-600"}`}
              >
                {confirming && <Loader2 size={14} className="animate-spin" />}
                {pending.confirmLabel}
              </button>
            </div>
          </section>
        </div>,
        document.body,
      )
    : null;

  return { confirm, confirmDialog };
}
