"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Cookies from "js-cookie";
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  Film,
  Globe,
  KeyRound,
  Loader2,
  RefreshCw,
  RotateCcw,
  Save,
  Settings,
  Shield,
  Signal,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useConfirmDialog } from "@/components/ConfirmDialog";

type Section = "general" | "sources";

interface MovieSource {
  id: string;
  name: string;
  domain: string;
  crawlUrl: string;
}

interface SystemSettingsData {
  websiteName: string;
  websiteDescription: string;
  maintenanceMode: boolean;
  activeMovieSourceId: string;
  movieSources: MovieSource[];
  tmdbApiKeyConfigured: boolean;
  tmdbApiKeyLast4: string;
  updatedAt?: string;
  lastUpdatedBy?: string;
}

type SourceCheck = {
  ok: boolean;
  latencyMs: number;
  statusCode: number | null;
};

const DEFAULT_SETTINGS: SystemSettingsData = {
  websiteName: "DlowPhim",
  websiteDescription: "Trải nghiệm điện ảnh premium",
  maintenanceMode: false,
  activeMovieSourceId: "phimapi",
  movieSources: [
    {
      id: "phimapi",
      name: "PhimAPI / KKPhim",
      domain: "https://phimapi.com",
      crawlUrl: "https://phimapi.com/danh-sach/phim-moi-cap-nhat",
    },
    {
      id: "ophim",
      name: "OPhim",
      domain: "https://ophim1.com",
      crawlUrl: "https://ophim1.com/danh-sach/phim-moi-cap-nhat",
    },
  ],
  tmdbApiKeyConfigured: false,
  tmdbApiKeyLast4: "",
};

function sectionSnapshot(settings: SystemSettingsData, section: Section) {
  if (section === "general") {
    return JSON.stringify({
      websiteName: settings.websiteName,
      websiteDescription: settings.websiteDescription,
      maintenanceMode: settings.maintenanceMode,
    });
  }
  return JSON.stringify({
    activeMovieSourceId: settings.activeMovieSourceId,
    movieSources: settings.movieSources,
  });
}

export default function SettingsView() {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
  const { showToast } = useAuth();
  const { confirm, confirmDialog } = useConfirmDialog();
  const [activeSection, setActiveSection] = useState<Section>("general");
  const [settings, setSettings] = useState<SystemSettingsData>(DEFAULT_SETTINGS);
  const [savedSettings, setSavedSettings] = useState<SystemSettingsData>(DEFAULT_SETTINGS);
  const [tmdbApiKey, setTmdbApiKey] = useState("");
  const [showTmdbKey, setShowTmdbKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [sourceChecks, setSourceChecks] = useState<Record<string, SourceCheck>>({});

  const token = Cookies.get("token");
  const currentDirty = useMemo(
    () => sectionSnapshot(settings, activeSection) !== sectionSnapshot(savedSettings, activeSection)
      || (activeSection === "sources" && Boolean(tmdbApiKey.trim())),
    [activeSection, savedSettings, settings, tmdbApiKey],
  );
  const anyDirty = useMemo(
    () => sectionSnapshot(settings, "general") !== sectionSnapshot(savedSettings, "general")
      || sectionSnapshot(settings, "sources") !== sectionSnapshot(savedSettings, "sources")
      || Boolean(tmdbApiKey.trim()),
    [savedSettings, settings, tmdbApiKey],
  );

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/system-settings/admin`, {
        headers: { Authorization: `Bearer ${Cookies.get("token")}` },
        cache: "no-store",
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.message || "Không thể tải cấu hình hệ thống");
      const normalized: SystemSettingsData = {
        ...DEFAULT_SETTINGS,
        ...data,
        movieSources: Array.isArray(data?.movieSources) ? data.movieSources : DEFAULT_SETTINGS.movieSources,
        tmdbApiKeyConfigured: Boolean(data?.tmdbApiKeyConfigured),
        tmdbApiKeyLast4: String(data?.tmdbApiKeyLast4 || ""),
      };
      setSettings(normalized);
      setSavedSettings(normalized);
      setTmdbApiKey("");
      setSourceChecks({});
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Không thể tải cấu hình hệ thống", "error");
    } finally {
      setLoading(false);
    }
  }, [API_URL, showToast]);

  useEffect(() => {
    const section = new URLSearchParams(window.location.search).get("section");
    if (section === "sources" || section === "general") setActiveSection(section);
    void fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!anyDirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [anyDirty]);

  const switchSection = (section: Section) => {
    setActiveSection(section);
    const url = new URL(window.location.href);
    url.searchParams.set("section", section);
    window.history.replaceState({}, "", url);
  };

  const toggleMaintenance = async () => {
    const next = !settings.maintenanceMode;
    const accepted = await confirm({
      title: next ? "Bật chế độ bảo trì?" : "Tắt chế độ bảo trì?",
      message: next
        ? "Người xem thông thường sẽ tạm thời không thể sử dụng website sau khi bạn lưu thay đổi. Admin vẫn có thể truy cập."
        : "Website sẽ mở lại cho toàn bộ người xem sau khi bạn lưu thay đổi.",
      confirmLabel: next ? "Bật bảo trì" : "Mở lại website",
      tone: "warning",
    });
    if (accepted) setSettings((current) => ({ ...current, maintenanceMode: next }));
  };

  const selectSource = async (source: MovieSource) => {
    if (source.id === settings.activeMovieSourceId) return;
    const accepted = await confirm({
      title: `Chuyển nguồn mặc định sang ${source.name}?`,
      message: "Danh sách, tìm kiếm và import phim sẽ ưu tiên nguồn này sau khi lưu. Mục Sắp chiếu vẫn dùng luồng OPhim/TMDB riêng.",
      confirmLabel: "Chọn nguồn này",
      tone: "warning",
    });
    if (accepted) setSettings((current) => ({ ...current, activeMovieSourceId: source.id }));
  };

  const updateSource = (index: number, patch: Partial<MovieSource>) => {
    setSettings((current) => ({
      ...current,
      movieSources: current.movieSources.map((source, sourceIndex) =>
        sourceIndex === index ? { ...source, ...patch } : source,
      ),
    }));
    setSourceChecks({});
  };

  const resetCurrentSection = () => {
    if (activeSection === "general") {
      setSettings((current) => ({
        ...current,
        websiteName: savedSettings.websiteName,
        websiteDescription: savedSettings.websiteDescription,
        maintenanceMode: savedSettings.maintenanceMode,
      }));
      return;
    }
    setSettings((current) => ({
      ...current,
      activeMovieSourceId: savedSettings.activeMovieSourceId,
      movieSources: savedSettings.movieSources,
    }));
    setTmdbApiKey("");
    setSourceChecks({});
  };

  const saveCurrentSection = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!currentDirty || saving) return;
    setSaving(true);
    try {
      const payload = activeSection === "general"
        ? {
            websiteName: settings.websiteName,
            websiteDescription: settings.websiteDescription,
            maintenanceMode: settings.maintenanceMode,
          }
        : {
            activeMovieSourceId: settings.activeMovieSourceId,
            movieSources: settings.movieSources,
            ...(tmdbApiKey.trim() ? { tmdbApiKey: tmdbApiKey.trim() } : {}),
          };
      const response = await fetch(`${API_URL}/system-settings/admin/${activeSection}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(Array.isArray(data?.message) ? data.message[0] : data?.message || "Lưu cấu hình thất bại");
      const normalized = { ...DEFAULT_SETTINGS, ...data, movieSources: data.movieSources || settings.movieSources };
      setSettings(normalized);
      setSavedSettings(normalized);
      setTmdbApiKey("");
      setSourceChecks({});
      showToast("Đã lưu nhóm cấu hình hiện tại", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Lưu cấu hình thất bại", "error");
    } finally {
      setSaving(false);
    }
  };

  const testSource = async (sourceId: string) => {
    if (sectionSnapshot(settings, "sources") !== sectionSnapshot(savedSettings, "sources")) {
      showToast("Hãy lưu thay đổi nguồn trước khi kiểm tra kết nối", "warning");
      return;
    }
    setTesting(sourceId);
    try {
      const response = await fetch(`${API_URL}/system-settings/admin/test-source`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sourceId }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.message || "Không thể kiểm tra nguồn");
      setSourceChecks((current) => ({ ...current, [sourceId]: data }));
      showToast(data.ok ? `Nguồn hoạt động tốt (${data.latencyMs}ms)` : "Nguồn đang không phản hồi", data.ok ? "success" : "warning");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Không thể kiểm tra nguồn", "error");
    } finally {
      setTesting(null);
    }
  };

  const testTmdb = async () => {
    if (tmdbApiKey.trim()) {
      showToast("Hãy lưu TMDB API key mới trước khi kiểm tra", "warning");
      return;
    }
    setTesting("tmdb");
    try {
      const response = await fetch(`${API_URL}/system-settings/admin/test-tmdb`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.message || "Không thể kiểm tra TMDB");
      showToast(data.ok ? `TMDB hoạt động tốt (${data.latencyMs}ms)` : "TMDB API key không hợp lệ hoặc đang gián đoạn", data.ok ? "success" : "warning");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Không thể kiểm tra TMDB", "error");
    } finally {
      setTesting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 rounded-2xl border border-zinc-900 bg-[#0d0e13]">
        <Loader2 className="animate-spin text-pink-500" size={26} />
        <span className="text-xs font-bold text-zinc-500">Đang tải cấu hình an toàn...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-left">
          <h3 className="flex items-center gap-2 text-lg font-black tracking-tight text-white">
            <Settings size={19} className="text-pink-500" /> Cài đặt hệ thống
            {anyDirty && <span className="rounded-full bg-amber-500/10 px-2 py-1 text-[9px] uppercase tracking-wider text-amber-400">Chưa lưu</span>}
          </h3>
          <p className="mt-1 text-[10px] font-semibold text-zinc-500">
            Cấu hình website và nguồn dữ liệu đang được sử dụng thật trong DlowPhim.
          </p>
          {settings.updatedAt && (
            <p className="mt-1 text-[9px] text-zinc-600">
              Lưu gần nhất: {new Date(settings.updatedAt).toLocaleString("vi-VN")}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={async () => {
            if (anyDirty && !(await confirm({ title: "Tải lại cấu hình?", message: "Các thay đổi chưa lưu sẽ bị hủy.", confirmLabel: "Tải lại", tone: "warning" }))) return;
            void fetchSettings();
          }}
          disabled={saving}
          className="flex h-10 items-center gap-2 self-end rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 text-[10px] font-black text-zinc-400 transition hover:text-white disabled:opacity-50"
        >
          <RefreshCw size={13} /> Tải lại
        </button>
      </div>

      <div className="grid grid-cols-2 rounded-xl border border-zinc-900 bg-zinc-950 p-1">
        {([
          { id: "general", label: "Website & vận hành", icon: Globe },
          { id: "sources", label: "Nguồn phim & TMDB", icon: Film },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button
            type="button"
            key={id}
            onClick={() => switchSection(id)}
            className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-[10px] font-black uppercase tracking-wider transition ${activeSection === id ? "bg-pink-500 text-white" : "text-zinc-500 hover:text-white"}`}
          >
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      <form onSubmit={saveCurrentSection} className="rounded-2xl border border-zinc-900 bg-[#0d0e13] p-5 text-left md:p-6">
        {activeSection === "general" ? (
          <div className="space-y-6">
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-white">Nhận diện website & SEO</h4>
              <p className="mt-1 text-[10px] text-zinc-500">Mô tả SEO nên rõ nghĩa và không vượt quá 180 ký tự.</p>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <label className="space-y-2 text-[10px] font-black uppercase tracking-wider text-zinc-400">
                Tên website
                <input
                  required
                  maxLength={60}
                  value={settings.websiteName}
                  onChange={(event) => setSettings((current) => ({ ...current, websiteName: event.target.value }))}
                  className="w-full rounded-xl border border-zinc-900 bg-zinc-950 px-4 py-3 text-xs font-medium normal-case text-white outline-none transition focus:border-pink-500/50"
                />
              </label>
              <label className="space-y-2 text-[10px] font-black uppercase tracking-wider text-zinc-400">
                Mô tả website (SEO)
                <input
                  maxLength={180}
                  value={settings.websiteDescription}
                  onChange={(event) => setSettings((current) => ({ ...current, websiteDescription: event.target.value }))}
                  className="w-full rounded-xl border border-zinc-900 bg-zinc-950 px-4 py-3 text-xs font-medium normal-case text-white outline-none transition focus:border-pink-500/50"
                />
                <span className="block text-right text-[9px] font-semibold normal-case text-zinc-600">{settings.websiteDescription.length}/180</span>
              </label>
            </div>
            <div className="flex items-center justify-between gap-5 rounded-2xl border border-amber-500/15 bg-amber-500/5 p-5">
              <div className="max-w-2xl">
                <h5 className="flex items-center gap-2 text-xs font-black text-amber-400"><Shield size={15} /> Chế độ bảo trì</h5>
                <p className="mt-1 text-[10px] font-semibold leading-5 text-zinc-500">Sau khi lưu, người xem sẽ bị tạm khóa tính năng; tài khoản admin vẫn truy cập được.</p>
              </div>
              <button type="button" onClick={toggleMaintenance} aria-pressed={settings.maintenanceMode} className={`relative h-6 w-11 shrink-0 rounded-full transition ${settings.maintenanceMode ? "bg-amber-500" : "bg-zinc-800"}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${settings.maintenanceMode ? "left-[22px]" : "left-0.5"}`} />
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-7">
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-white">Nguồn dữ liệu phim</h4>
              <p className="mt-1 text-[10px] text-zinc-500">PhimAPI mặc định, OPhim dự phòng. Riêng mục Sắp chiếu sử dụng luồng OPhim/TMDB.</p>
            </div>
            <div className="grid gap-5 lg:grid-cols-2">
              {settings.movieSources.map((source, index) => {
                const active = settings.activeMovieSourceId === source.id;
                const check = sourceChecks[source.id];
                return (
                  <section key={source.id} className={`space-y-4 rounded-2xl border p-5 transition ${active ? "border-pink-500/70 bg-pink-500/5" : "border-zinc-900 bg-zinc-950"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h5 className="flex items-center gap-2 text-xs font-black text-white">
                          <span className={`h-2 w-2 rounded-full ${active ? "bg-pink-500" : "bg-zinc-700"}`} /> {source.name}
                        </h5>
                        <p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-zinc-600">Mã nguồn: {source.id}</p>
                      </div>
                      {active && <span className="rounded-full bg-pink-500/10 px-2 py-1 text-[8px] font-black uppercase text-pink-400">Mặc định</span>}
                    </div>
                    {(["name", "domain", "crawlUrl"] as const).map((field) => (
                      <label key={field} className="block space-y-1.5 text-[9px] font-black uppercase tracking-wider text-zinc-500">
                        {field === "name" ? "Tên hiển thị" : field === "domain" ? "Tên miền API" : "URL danh sách mới"}
                        <input
                          type={field === "name" ? "text" : "url"}
                          value={source[field]}
                          onChange={(event) => updateSource(index, { [field]: event.target.value })}
                          className={`w-full rounded-xl border border-zinc-900 bg-zinc-900/40 px-3 py-2.5 text-[11px] font-medium normal-case text-white outline-none focus:border-pink-500/40 ${field !== "name" ? "font-mono" : ""}`}
                        />
                      </label>
                    ))}
                    <div className="flex gap-2">
                      {!active && <button type="button" onClick={() => selectSource(source)} className="flex-1 rounded-xl bg-zinc-900 py-2.5 text-[9px] font-black uppercase text-zinc-300 hover:bg-zinc-800">Đặt làm mặc định</button>}
                      <button type="button" onClick={() => testSource(source.id)} disabled={testing === source.id} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-zinc-800 py-2.5 text-[9px] font-black uppercase text-zinc-400 hover:text-white disabled:opacity-50">
                        {testing === source.id ? <Loader2 size={12} className="animate-spin" /> : <Signal size={12} />} Kiểm tra
                      </button>
                    </div>
                    {check && (
                      <div className={`flex items-center gap-2 text-[10px] font-bold ${check.ok ? "text-emerald-400" : "text-red-400"}`}>
                        {check.ok ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                        {check.ok ? `Hoạt động · ${check.latencyMs}ms · HTTP ${check.statusCode}` : "Nguồn không phản hồi ổn định"}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>

            <section className="rounded-2xl border border-zinc-900 bg-zinc-950 p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                <label className="flex-1 space-y-2 text-[10px] font-black uppercase tracking-wider text-zinc-400">
                  <span className="flex items-center gap-2"><KeyRound size={13} className="text-pink-500" /> TMDB API key</span>
                  <div className="relative">
                    <input
                      type={showTmdbKey ? "text" : "password"}
                      autoComplete="new-password"
                      value={tmdbApiKey}
                      onChange={(event) => setTmdbApiKey(event.target.value.trim())}
                      placeholder={settings.tmdbApiKeyConfigured ? `Đã cấu hình ····${settings.tmdbApiKeyLast4}` : "Nhập TMDB API key 32 ký tự"}
                      className="w-full rounded-xl border border-zinc-900 bg-zinc-900/40 px-4 py-3 pr-12 text-xs font-medium normal-case text-white outline-none focus:border-pink-500/40"
                    />
                    <button type="button" onClick={() => setShowTmdbKey((visible) => !visible)} aria-label={showTmdbKey ? "Ẩn API key" : "Hiện API key"} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white">
                      {showTmdbKey ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <span className="block text-[9px] font-semibold normal-case leading-4 text-zinc-600">Khóa hiện tại không bao giờ được gửi lại trình duyệt. Để trống nếu không muốn thay đổi.</span>
                </label>
                <button type="button" onClick={testTmdb} disabled={testing === "tmdb" || !settings.tmdbApiKeyConfigured} className="flex h-[42px] items-center justify-center gap-2 rounded-xl border border-zinc-800 px-4 text-[9px] font-black uppercase text-zinc-400 hover:text-white disabled:opacity-40">
                  {testing === "tmdb" ? <Loader2 size={12} className="animate-spin" /> : <Signal size={12} />} Kiểm tra TMDB
                </button>
              </div>
            </section>
          </div>
        )}

        <div className="mt-7 flex flex-col-reverse gap-3 border-t border-zinc-900 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[9px] font-semibold text-zinc-600">Chỉ nhóm đang mở được lưu, tránh ghi đè cấu hình ở nhóm khác.</p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={resetCurrentSection} disabled={!currentDirty || saving} className="flex items-center gap-2 rounded-xl border border-zinc-800 px-4 py-2.5 text-[10px] font-black uppercase text-zinc-400 hover:text-white disabled:opacity-30">
              <RotateCcw size={13} /> Hoàn tác
            </button>
            <button type="submit" disabled={!currentDirty || saving} className="flex min-w-36 items-center justify-center gap-2 rounded-xl bg-pink-500 px-5 py-2.5 text-[10px] font-black uppercase text-white shadow-lg shadow-pink-500/10 hover:bg-pink-600 disabled:cursor-not-allowed disabled:opacity-40">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} {saving ? "Đang lưu" : "Lưu nhóm này"}
            </button>
          </div>
        </div>
      </form>
      {confirmDialog}
    </div>
  );
}
