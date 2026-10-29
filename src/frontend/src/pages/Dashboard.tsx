import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Toaster } from "@/components/ui/sonner";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  clearToken,
  parseRoadmapDays,
  syncRoadmapToCalendarWithAutoReauth,
} from "@/lib/googleCalendar";
import {
  type ChatMessage,
  type VisionCell as VisionCellData,
  clearChatHistory,
  clearSession,
  getActiveTheme,
  getChatHistory,
  getCustomHex,
  getDailyAffirmation,
  getGooglePushEnabled,
  getLiveSyncEnabled,
  getSession,
  getSessionTier,
  getVisionBoard,
  getWebhookUrl,
  saveActiveTheme,
  saveChatHistory,
  saveCustomHex,
  saveGooglePushEnabled,
  saveLiveSyncEnabled,
  saveWebhookUrl,
  updateVisionCell,
} from "@/lib/storage";
import type { ThemeId } from "@/lib/storage";
import { THEMES } from "@/lib/themes";
import {
  type TierLevel,
  canCustomizeTheme,
  canGenerateRoadmap,
  canUploadImages,
  canUseCustomHex,
  canUseGlowCoach,
  canUseGoogleSync,
  canUseIntegrations,
  getCalendarEventDetails,
  isEliteTier,
  upgradeMessageFor,
} from "@/lib/tier";
import { useRouter } from "@tanstack/react-router";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  HelpCircle,
  ImageIcon,
  Lock,
  LogOut,
  MessageCircle,
  Palette,
  Pencil,
  Plug,
  Plus,
  Send,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const SYSTEM_PROMPT = `You are Elevatria Coach — a warm, focused wellness and life coach for women aged 16–30. Your entire purpose is to support users with:
- Mental wellness, mindset, and emotional wellbeing
- Physical health, fitness, and body positivity
- Life goals, vision boarding, and manifestation
- Daily habits, routines, and self-care rituals
- Confidence, self-love, and personal growth

STRICT RULES:
1. ONLY discuss topics related to wellness, health, fitness, mindset, life goals, self-improvement, and personal growth.
2. If a user asks something completely off-topic (e.g. coding, politics, random facts), gently acknowledge their question and redirect: "That's a little outside my lane! I'm here to support your wellness journey. Let's talk about [relevant wellness topic]. What's on your mind today?"
3. You CAN answer general questions IF they connect to wellness (e.g. "how do I become more athletic" is wellness — give a full, actionable answer).
4. Be concise, warm, and empowering. Use encouraging, modern language that resonates with Gen Z and Millennials.
5. Always bring the conversation back to the user's goals, wellbeing, or vision board.`;


// Botanical leaf icon for section headings
function LeafIcon({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <path
        d="M8 2C10 2 14 5 14 9C14 13 10 14 8 14C8 14 8 8 2 6C4 4 6 2 8 2Z"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M8 14L8 7"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
      />
    </svg>
  );
}

// Botanical sparkle icon for Elevatria Coach heading
function SparkleIcon({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <path
        d="M6 1v10M1 6h10M2.5 2.5l7 7M9.5 2.5l-7 7"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
      />
    </svg>
  );
}

// App compatibility badge icons
function NotionIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="2"
        y="1"
        width="12"
        height="14"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path
        d="M5 5h6M5 8h6M5 11h4"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SlackIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M6 2a2 2 0 1 0 0 4h2V4a2 2 0 0 0-2-2zM4 6H2a2 2 0 1 0 0 4h2V6zM10 14a2 2 0 1 0 0-4H8v2a2 2 0 0 0 2 2zM12 10h2a2 2 0 1 0 0-4h-2v4z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrelloIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="1"
        y="2"
        width="6"
        height="12"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <rect
        x="9"
        y="2"
        width="6"
        height="8"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.2"
      />
    </svg>
  );
}

// Simple hex -> OKLCH approximation (for custom brand color)
function hexToOklchApprox(hex: string): string {
  const r = Number.parseInt(hex.slice(1, 3), 16) / 255;
  const g = Number.parseInt(hex.slice(3, 5), 16) / 255;
  const b = Number.parseInt(hex.slice(5, 7), 16) / 255;
  const l = Math.sqrt(0.299 * r * r + 0.587 * g * g + 0.114 * b * b);
  const c = Math.sqrt((r - l) ** 2 + (g - l) ** 2 + (b - l) ** 2) * 0.4;
  const h = (Math.atan2(b - g, r - g) * 180) / Math.PI;
  const hue = ((h % 360) + 360) % 360;
  return `${l.toFixed(3)} ${c.toFixed(3)} ${hue.toFixed(1)}`;
}

export default function Dashboard() {
  const router = useRouter();
  const userId = getSession();

  useEffect(() => {
    if (!userId) void router.navigate({ to: "/" });
  }, [userId, router]);

  // Tier detection
  const tierStr = getSessionTier();
  const tier: TierLevel = (tierStr as TierLevel) ?? "elite"; // defaults to elite for legacy codes

  const [cells, setCells] = useState<VisionCellData[]>(() =>
    userId ? getVisionBoard(userId) : [],
  );
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() =>
    userId ? getChatHistory(userId) : [],
  );
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);

  // Integration state
  const [webhookUrl, setWebhookUrl] = useState(() =>
    userId ? getWebhookUrl(userId) : "",
  );
  const [liveSyncEnabled, setLiveSyncEnabled] = useState(() =>
    userId ? getLiveSyncEnabled(userId) : false,
  );
  const [lastRoadmap, setLastRoadmap] = useState<string>("");
  const [isExporting, setIsExporting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [googlePushEnabled, setGooglePushEnabled] = useState(() =>
    userId ? getGooglePushEnabled(userId) : false,
  );
  const [isGoogleSyncing, setIsGoogleSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [isGeneratingRoadmap, setIsGeneratingRoadmap] = useState(false);

  // Gratitude dialog state
  const [gratitudeOpen, setGratitudeOpen] = useState(false);
  const [gratitudeText, setGratitudeText] = useState("");
  const [gratitudeEntries, setGratitudeEntries] = useState<string[]>([]);

  // Upgrade modal state
  const [upgradeModal, setUpgradeModal] = useState<{
    open: boolean;
    message: string;
  }>({ open: false, message: "" });
  const [calendarPermissionModalOpen, setCalendarPermissionModalOpen] =
    useState(false);

  const showUpgradeModal = (
    feature:
      | "image"
      | "coach"
      | "roadmap"
      | "integrations"
      | "google_sync"
      | "theme",
  ) => {
    setUpgradeModal({ open: true, message: upgradeMessageFor(feature) });
  };

  // Theme state
  const [activeTheme, setActiveTheme] = useState<ThemeId>(() =>
    userId ? getActiveTheme(userId) : "signature",
  );
  const [customHex, setCustomHex] = useState<string>(() =>
    userId ? getCustomHex(userId) : "",
  );

  const applyTheme = (theme: ThemeId) => {
    const themeConfig = THEMES.find((t) => t.id === theme);
    if (!themeConfig) return;

    // Remove all previously injected inline CSS vars to avoid stale values
    const prevVarKeys = Array.from(document.documentElement.style).filter((k) =>
      k.startsWith("--"),
    );
    for (const k of prevVarKeys) {
      document.documentElement.style.removeProperty(k);
    }

    if (theme === "signature") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", theme);
    }

    // Inject theme-specific CSS variables as inline styles (highest specificity)
    for (const [key, value] of Object.entries(themeConfig.cssVars)) {
      document.documentElement.style.setProperty(key, value);
    }

    document.body.style.backgroundColor = themeConfig.bgColor;
    document.body.style.backgroundImage = themeConfig.bgImage;
    setActiveTheme(theme);
    if (userId) saveActiveTheme(userId, theme);
  };

  const applyCustomHex = (hex: string) => {
    if (!hex) return;
    document.documentElement.style.setProperty(
      "--primary",
      hexToOklchApprox(hex),
    );
    document.documentElement.style.setProperty("--sage", hexToOklchApprox(hex));
    document.documentElement.style.setProperty("--ring", hexToOklchApprox(hex));
    setCustomHex(hex);
    if (userId) saveCustomHex(userId, hex);
  };

  // Apply saved theme on mount
  // biome-ignore lint/correctness/useExhaustiveDependencies: run only on mount
  useEffect(() => {
    if (userId) {
      const savedTheme = getActiveTheme(userId);
      applyTheme(savedTheme);
      const savedHex = getCustomHex(userId);
      if (savedHex && tier === "elite") applyCustomHex(savedHex);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Dialog state
  const [openCellIndex, setOpenCellIndex] = useState<number | null>(null);
  const [goalText, setGoalText] = useState("");
  const [activeTab, setActiveTab] = useState("goal");

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Custom Vision Board background
  const [customBackground, setCustomBackground] = useState<string | null>(null);
  // Active section tab: dashboard (Elevatria Coach) or visionboard
  const [activeSection, setActiveSection] = useState<
    "dashboard" | "visionboard"
  >("dashboard");
  const bgInputRef = useRef<HTMLInputElement>(null);

  const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setCustomBackground(URL.createObjectURL(file));
  };

  const affirmation = userId ? getDailyAffirmation(userId) : "";

  // Scroll chat to bottom when messages change
  // biome-ignore lint/correctness/useExhaustiveDependencies: chatMessages triggers the scroll side effect
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Live sync helper
  const triggerLiveSync = useCallback(
    (updatedCells: VisionCellData[]) => {
      if (
        !isEliteTier(tier) ||
        !liveSyncEnabled ||
        !webhookUrl.trim() ||
        !userId
      )
        return;
      const goals = updatedCells.map((c, i) => ({
        cell: i + 1,
        type: c.cellType,
        content: c.content,
      }));
      fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "Elevatria",
          userId,
          type: "live_sync",
          visionGoals: goals,
          syncedAt: new Date().toISOString(),
        }),
      }).catch(() => {});
    },
    [tier, liveSyncEnabled, webhookUrl, userId],
  );

  // Open cell dialog
  const openCell = (index: number) => {
    const cell = cells[index];
    setGoalText(cell.cellType === "text" ? cell.content : "");
    setActiveTab("goal");
    setOpenCellIndex(index);
  };

  const closeDialog = useCallback(() => {
    setOpenCellIndex(null);
    setGoalText("");
  }, []);

  // Save text goal
  const saveGoal = () => {
    if (openCellIndex === null || !userId) return;
    const text = goalText.trim();
    const updated = updateVisionCell(userId, openCellIndex, {
      cellType: text ? "text" : "empty",
      content: text,
    });
    setCells(updated);
    triggerLiveSync(updated);
    closeDialog();
  };

  // Handle image upload
  const handleImageUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (openCellIndex === null || !userId) return;
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        const updated = updateVisionCell(userId, openCellIndex, {
          cellType: "image",
          content: base64,
        });
        setCells(updated);
        triggerLiveSync(updated);
        closeDialog();
      };
      reader.readAsDataURL(file);
    },
    [openCellIndex, userId, closeDialog, triggerLiveSync],
  );

  // Remove cell content
  const removeCell = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!userId) return;
    const updated = updateVisionCell(userId, index, {
      cellType: "empty",
      content: "",
    });
    setCells(updated);
  };

  // Shared: call OpenAI with a given message history
  const callOpenAI = async (_messages: ChatMessage[]): Promise<string> => {
    throw new Error("AI coaching requires a server integration. Use the local planner demo.");
  };

  // Chat: send message
  const sendMessage = async () => {
    if (!chatInput.trim() || isChatLoading) return;

    const userMsg: ChatMessage = { role: "user", content: chatInput.trim() };
    const newMessages = [...chatMessages, userMsg];
    setChatMessages(newMessages);
    if (userId) saveChatHistory(userId, newMessages);
    setChatInput("");
    setIsChatLoading(true);

    try {
      const assistantContent = await callOpenAI(newMessages);
      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: assistantContent,
      };
      const withAssistant = [...newMessages, assistantMsg];
      setChatMessages(withAssistant);
      if (userId) saveChatHistory(userId, withAssistant);
    } catch (err) {
      const isAuth = err instanceof Error && err.message === "AUTH_ERROR";
      const isRate = err instanceof Error && err.message === "RATE_LIMIT";
      const errMsg: ChatMessage = {
        role: "assistant",
        content: isAuth
          ? "The Elevatria Coach API key is invalid or has been revoked. A server integration is required to reconnect. 🔑"
          : isRate
            ? "Too many requests right now -- give me a moment and try again! 💚"
            : "Something went off-track, but I'm still here for you! Try again in a moment. 💚",
      };
      const withError = [...newMessages, errMsg];
      setChatMessages(withError);
      if (userId) saveChatHistory(userId, withError);
    } finally {
      setIsChatLoading(false);
    }
  };

  // Generate 7-Day Roadmap from vision board
  const generateRoadmap = async () => {
    if (isChatLoading) return;

    // Collect only filled cells (skip empty)
    const filledCells = cells.filter(
      (cell) =>
        (cell.cellType === "text" && cell.content.trim()) ||
        cell.cellType === "image",
    );
    const goalsList = filledCells
      .map((cell, i) => {
        if (cell.cellType === "text") return `${i + 1}. ${cell.content.trim()}`;
        return `${i + 1}. [vision image]`;
      })
      .join("\n");

    const hasTextGoal = cells.some(
      (cell) => cell.cellType === "text" && cell.content.trim(),
    );

    if (!hasTextGoal) {
      const friendlyMsg: ChatMessage = {
        role: "assistant",
        content:
          "Add some goals to your Vision Board first, then I'll craft your roadmap! ✨",
      };
      const withMsg = [...chatMessages, friendlyMsg];
      setChatMessages(withMsg);
      if (userId) saveChatHistory(userId, withMsg);
      return;
    }

    const prompt = `Based on these ${filledCells.length} vision goals:\n${goalsList}\n\nCreate a structured, aesthetic 7-day action plan. Each day should have one clear, high-vibe habit. Format it as an elegant, numbered list.`;

    const userMsg: ChatMessage = { role: "user", content: prompt };
    const newMessages = [...chatMessages, userMsg];
    setChatMessages(newMessages);
    if (userId) saveChatHistory(userId, newMessages);
    setIsChatLoading(true);
    setIsGeneratingRoadmap(true);

    try {
      const assistantContent = await callOpenAI(newMessages);
      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: assistantContent,
      };
      const withAssistant = [...newMessages, assistantMsg];
      setChatMessages(withAssistant);
      if (userId) saveChatHistory(userId, withAssistant);
      setLastRoadmap(assistantContent);
    } catch (err) {
      const isAuth = err instanceof Error && err.message === "AUTH_ERROR";
      const isRate = err instanceof Error && err.message === "RATE_LIMIT";
      const errMsg: ChatMessage = {
        role: "assistant",
        content: isAuth
          ? "The Elevatria Coach API key is invalid or has been revoked. A server integration is required to reconnect. 🔑"
          : isRate
            ? "Too many requests right now -- give me a moment and try again! 💚"
            : "Something went off-track while generating your roadmap. Try again in a moment. 💚",
      };
      const withError = [...newMessages, errMsg];
      setChatMessages(withError);
      if (userId) saveChatHistory(userId, withError);
    } finally {
      setIsChatLoading(false);
      setIsGeneratingRoadmap(false);
    }
  };

  // Test webhook connection
  const handleTestConnection = async () => {
    if (!webhookUrl.trim()) return;
    setIsTesting(true);
    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          test: true,
          source: "Elevatria",
          userId,
        }),
      });
      toast.success("Connection successful! Your webhook is ready.");
    } catch {
      toast.error("Connection failed. Please check your webhook URL.");
    } finally {
      setIsTesting(false);
    }
  };

  // Export roadmap + goals to webhook
  const handleExport = async () => {
    if (!webhookUrl.trim() || !lastRoadmap) return;
    setIsExporting(true);
    try {
      const goals = cells.map((c, i) => ({
        cell: i + 1,
        type: c.cellType,
        content: c.content,
      }));
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "Elevatria",
          userId,
          visionGoals: goals,
          roadmap: lastRoadmap,
          exportedAt: new Date().toISOString(),
        }),
      });
      toast.success("Exported successfully! Your data has been sent.");
    } catch {
      toast.error(
        "Export failed. Please check your webhook URL and try again.",
      );
    } finally {
      setIsExporting(false);
    }
  };

  const handleGoogleSync = async () => {
    if (tier === "starter") {
      showUpgradeModal("google_sync");
      return;
    }

    if (!lastRoadmap) {
      toast.error("Generate a 7-Day Roadmap first to sync to Google Calendar.");
      return;
    }

    setIsGoogleSyncing(true);
    try {
      const days = parseRoadmapDays(lastRoadmap);
      await syncRoadmapToCalendarWithAutoReauth(
        days,
        (taskName) => getCalendarEventDetails(tier, taskName),
      );
      setSyncSuccess(true);
      setTimeout(() => setSyncSuccess(false), 3000);
      toast.success(
        "Your Elevatria roadmap is now in your Google Calendar! ✨",
      );
    } catch (err: unknown) {
      const status =
        (err as { result?: { error?: { code?: number } } })?.result?.error
          ?.code ?? (err as { status?: number })?.status;
      if (status === 403) {
        console.error(
          "[Elevatria GCal] 403 Forbidden – insufficient permissions. Ensure the Calendar scope is granted.",
        );
        setCalendarPermissionModalOpen(true);
      } else if (status === 429) {
        toast.error("Google Calendar is rate-limiting requests. Please retry.");
      } else if (
        err instanceof Error &&
        err.message.includes("Missing Google Config")
      ) {
        toast.error(
          "Google Client ID is missing. Set VITE_GOOGLE_CLIENT_ID and redeploy.",
        );
      } else {
        console.error("[Elevatria GCal] Sync error:", err);
        toast.error("Calendar sync failed. Retry from the sync button.");
      }
    } finally {
      setIsGoogleSyncing(false);
    }
  };

  const handleChatKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  const handleClearChat = () => {
    if (!userId) return;
    clearChatHistory(userId);
    setChatMessages([]);
  };

  const handleLogout = () => {
    clearSession();
    void router.navigate({ to: "/" });
  };

  if (!userId) return null;

  const completedCells = cells.filter(
    (c) => c.cellType === "text" || c.cellType === "image",
  ).length;

  const openedCell = openCellIndex !== null ? cells[openCellIndex] : null;
  const integrationUnlocked = canUseIntegrations(tier);

  return (
    <div
      className="min-h-screen bg-background flex flex-col page-transition"
      data-ocid="dashboard.page"
    >
      {/* GlowUp Progress Bar */}
      <div
        className="glowup-progress-bar"
        data-ocid="dashboard.progress_bar"
        style={{ width: `${(completedCells / 9) * 100}%` }}
        aria-hidden="true"
      />
      {/* Header */}
      <header
        className="sticky top-0 z-30 border-b"
        style={{
          background: "oklch(0.975 0.006 85 / 0.92)",
          backdropFilter: "blur(12px)",
          borderColor: "oklch(0.9 0.008 85)",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles
              className="w-5 h-5"
              style={{ color: "oklch(0.68 0.06 140)" }}
            />
            <span
              className="font-serif italic text-lg"
              style={{ color: "oklch(0.22 0 0)" }}
            >
              Elevatria
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span
              className="hidden sm:block font-sans text-[12px] tracking-widest"
              style={{ color: "oklch(0.5 0.01 85)" }}
            >
              Welcome back,{" "}
              <span
                className="font-medium"
                style={{ color: "oklch(0.22 0 0)" }}
              >
                {userId}
              </span>
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              data-ocid="dashboard.logout_button"
              className="font-sans text-[12px] tracking-widest gap-1.5"
              style={{ color: "oklch(0.5 0.01 85)" }}
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 space-y-6">
        {/* Daily Affirmation — zen fade-in via framer motion */}
        <motion.section
          data-ocid="dashboard.affirmation_section"
          className="affirmation-banner rounded-2xl p-6 text-white"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.4, ease: "easeOut" }}
          aria-label="Daily affirmation"
        >
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 mt-0.5 flex-shrink-0 animate-sparkle" />
            <div>
              <p className="font-sans text-[12px] uppercase tracking-widest mb-2 opacity-80">
                Your daily manifestation
              </p>
              <p className="font-serif italic text-lg sm:text-xl leading-relaxed">
                &ldquo;{affirmation}&rdquo;
              </p>
            </div>
          </div>
        </motion.section>

        {/* Tab Strip */}
        <div
          data-ocid="dashboard.tab_strip"
          className="flex items-center gap-1"
        >
          <button
            type="button"
            data-ocid="dashboard.tab.1"
            onClick={() => setActiveSection("dashboard")}
            className={
              activeSection === "dashboard"
                ? "bg-white/80 rounded-full px-4 py-1.5 shadow-sm border border-black/5 font-medium font-sans text-sm tracking-wide transition-all"
                : "px-4 py-1.5 opacity-60 hover:opacity-100 transition-opacity font-sans text-sm tracking-wide"
            }
          >
            Dashboard
          </button>
          <button
            type="button"
            data-ocid="visionboard.tab.2"
            onClick={() => setActiveSection("visionboard")}
            className={
              activeSection === "visionboard"
                ? "bg-white/80 rounded-full px-4 py-1.5 shadow-sm border border-black/5 font-medium font-sans text-sm tracking-wide transition-all"
                : "px-4 py-1.5 opacity-60 hover:opacity-100 transition-opacity font-sans text-sm tracking-wide"
            }
          >
            Vision Board
          </button>
        </div>
        <hr className="elegant-divider" />

        {/* Tabbed layout */}
        <div>
          {/* ─── Vision Board ─── */}
          {activeSection === "visionboard" && (
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <div className="flex items-center justify-between mb-1">
                <h2
                  className="editorial-heading text-2xl flex items-center gap-2"
                  style={{ color: "oklch(0.22 0 0)" }}
                >
                  <LeafIcon style={{ color: "oklch(0.68 0.06 140)" }} />
                  My Vision Board
                </h2>
                <div className="flex items-center gap-2">
                  <input
                    ref={bgInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleBgUpload}
                    data-ocid="vision_board.dropzone"
                  />
                  {isEliteTier(tier) ? (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        data-ocid="vision_board.upload_button"
                        onClick={() => bgInputRef.current?.click()}
                        className="font-sans text-[11px] tracking-widest gap-1"
                        style={{ color: "oklch(0.55 0.01 85)" }}
                      >
                        📷 Personalize Background
                      </Button>
                      {customBackground && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          data-ocid="vision_board.reset_button"
                          onClick={() => setCustomBackground(null)}
                          className="font-sans text-[11px] tracking-widest gap-1"
                          style={{ color: "oklch(0.55 0.01 85)" }}
                        >
                          ↩ Restore Default
                        </Button>
                      )}
                    </>
                  ) : (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              data-ocid="vision_board.upload_button"
                              disabled
                              className="font-sans text-[11px] tracking-widest gap-1 opacity-40 cursor-not-allowed"
                            >
                              📷 Personalize Background
                            </Button>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Upgrade to Elite to unlock custom backgrounds.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              </div>
              <hr className="elegant-divider mb-4" />
              <div
                className="relative rounded-2xl overflow-hidden"
                style={
                  customBackground
                    ? {
                        backgroundImage: `url(${customBackground})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      }
                    : {}
                }
              >
                {customBackground && (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      backdropFilter: "blur(5px) brightness(0.6)",
                      zIndex: 0,
                    }}
                  />
                )}
                <div
                  className="relative grid grid-cols-2 md:grid-cols-3 gap-3 p-2"
                  style={{ zIndex: 1 }}
                  data-ocid="visionboard.canvas_target"
                  aria-label="Vision board grid"
                >
                  {cells.map((cell) => (
                    <VisionCellCard
                      key={cell.cellIndex}
                      cell={cell}
                      displayIndex={cell.cellIndex + 1}
                      onClick={() => openCell(cell.cellIndex)}
                      onRemove={(e) => removeCell(cell.cellIndex, e)}
                    />
                  ))}
                </div>
              </div>
            </motion.section>
          )}

          {/* ─── Elevatria Coach Chat ─── */}
          {activeSection === "dashboard" && (
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="flex flex-col"
            >
              <div className="flex items-center justify-between mb-1">
                <h2
                  className="font-serif italic text-2xl flex items-center gap-2"
                  style={{ color: "oklch(0.22 0 0)" }}
                >
                  <SparkleIcon style={{ color: "oklch(0.68 0.06 140)" }} />
                  Elevatria Coach
                </h2>
                {chatMessages.length > 0 && canUseGlowCoach(tier) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleClearChat}
                    data-ocid="coach.delete_button"
                    className="font-sans text-[12px] tracking-widest gap-1"
                    style={{ color: "oklch(0.6 0.01 85)" }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Clear
                  </Button>
                )}
              </div>
              <hr className="elegant-divider mb-4" />

              {!canUseGlowCoach(tier) ? (
                /* Locked coach for Starter tier */
                <button
                  type="button"
                  className="flex flex-col items-center justify-center rounded-2xl py-12 gap-4 w-full"
                  style={{
                    background: "oklch(0.975 0.004 85)",
                    border: "1px dashed oklch(0.85 0.008 85)",
                    minHeight: "200px",
                    cursor: "pointer",
                  }}
                  onClick={() => showUpgradeModal("coach")}
                  data-ocid="coach.locked_panel"
                  aria-label="Unlock Elevatria Coach"
                >
                  <Lock
                    className="w-8 h-8"
                    style={{ color: "oklch(0.72 0.02 85)" }}
                  />
                  <div className="text-center">
                    <p
                      className="font-serif italic text-base"
                      style={{ color: "oklch(0.4 0.01 85)" }}
                    >
                      Elevatria Coach
                    </p>
                    <p
                      className="font-sans text-[12px] tracking-widest mt-1 uppercase"
                      style={{ color: "oklch(0.6 0.01 85)" }}
                    >
                      Pro Collection Feature
                    </p>
                  </div>
                </button>
              ) : (
                /* Unlocked coach for Pro/Elite tiers */
                <>
                  <p className="mb-3">Prototype: AI coaching is unavailable until a server integration is configured. Never enter provider keys in this browser.</p>
                  {/* ✨ Generate 7-Day Roadmap Button */}
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.35 }}
                    className="mb-3"
                  >
                    {canGenerateRoadmap(tier) ? (
                      <button
                        type="button"
                        onClick={() => void generateRoadmap()}
                        disabled={isChatLoading}
                        data-ocid="coach.roadmap_button"
                        className="roadmap-btn btn-magnetic w-full rounded-full font-sans text-[12px] tracking-widest py-2.5 px-5 text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        ✨ Generate 7-Day Roadmap
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => showUpgradeModal("roadmap")}
                        data-ocid="coach.roadmap_button"
                        className="w-full rounded-full font-sans text-[12px] tracking-widest py-2.5 px-5 transition-all duration-200 flex items-center justify-center gap-2"
                        style={{
                          background: "oklch(0.93 0.008 85)",
                          color: "oklch(0.5 0.01 85)",
                          border: "1px solid oklch(0.88 0.008 85)",
                        }}
                      >
                        <Lock className="w-3.5 h-3.5" />
                        Generate 7-Day Roadmap
                      </button>
                    )}
                  </motion.div>

                  <div
                    data-ocid="coach.panel"
                    className="flex flex-col rounded-2xl overflow-hidden flex-1"
                    style={{
                      background: "oklch(1 0 0 / 0.7)",
                      backdropFilter: "blur(16px)",
                      boxShadow: "0 4px 24px 0 oklch(0.22 0 0 / 0.06)",
                      border: "1px solid rgba(255,255,255,0.3)",
                      minHeight: "420px",
                    }}
                  >
                    {/* Messages */}
                    <div
                      className="flex-1 overflow-y-auto p-4 space-y-3 chat-scroll"
                      style={{ maxHeight: "520px", minHeight: "500px" }}
                    >
                      {chatMessages.length === 0 ? (
                        <div
                          data-ocid="coach.empty_state"
                          className="h-full flex flex-col items-center justify-center text-center py-8 gap-3"
                        >
                          <MessageCircle
                            className="w-10 h-10"
                            style={{ color: "oklch(0.88 0.03 140)" }}
                          />
                          <p
                            className="font-serif italic text-lg"
                            style={{ color: "oklch(0.45 0.02 85)" }}
                          >
                            Hey gorgeous! Tell me about your goals and I&apos;ll
                            help you build your 7-day Elevatria plan. ✨
                          </p>
                        </div>
                      ) : (
                        <AnimatePresence initial={false}>
                          {chatMessages.map((msg, i) => (
                            <motion.div
                              // biome-ignore lint/suspicious/noArrayIndexKey: chat messages have no stable id; index is acceptable here
                              key={i}
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.25 }}
                              className={`flex ${
                                msg.role === "user"
                                  ? "justify-end"
                                  : "justify-start"
                              }`}
                            >
                              <div
                                className="max-w-[80%] rounded-2xl px-4 py-2.5 font-sans text-[12px] tracking-wide leading-relaxed"
                                style={
                                  msg.role === "user"
                                    ? {
                                        background: "oklch(0.68 0.06 140)",
                                        color: "white",
                                        borderBottomRightRadius: "4px",
                                      }
                                    : {
                                        background: "oklch(0.96 0.006 85)",
                                        color: "oklch(0.22 0 0)",
                                        borderBottomLeftRadius: "4px",
                                      }
                                }
                              >
                                {msg.content}
                              </div>
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      )}

                      {/* Loading indicator */}
                      {isChatLoading && (
                        <div
                          data-ocid="coach.loading_state"
                          className="flex justify-center"
                          aria-live="polite"
                        >
                          {isGeneratingRoadmap ? (
                            <div className="flex flex-col items-center gap-2 py-4">
                              <span className="sparkle-loader text-2xl">
                                ✨
                              </span>
                              <p
                                className="affirmation-loading font-sans text-[11px] tracking-widest text-center"
                                style={{ color: "oklch(0.6 0.03 140)" }}
                              >
                                Preparing your manifestation...
                              </p>
                            </div>
                          ) : (
                            <div
                              className="rounded-2xl px-4 py-3 flex items-center gap-1"
                              style={{
                                background: "oklch(0.96 0.006 85)",
                                borderBottomLeftRadius: "4px",
                              }}
                              aria-label="Elevatria Coach is typing"
                            >
                              <span className="typing-dot" />
                              <span className="typing-dot" />
                              <span className="typing-dot" />
                            </div>
                          )}
                        </div>
                      )}
                      <div ref={chatEndRef} />
                    </div>

                    {/* Input row */}
                    <div
                      className="p-3 border-t flex gap-2"
                      style={{ borderColor: "oklch(0.92 0.008 85)" }}
                    >
                      <Input
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={handleChatKeyDown}
                        placeholder="Ask your Elevatria Coach..."
                        data-ocid="coach.input"
                        disabled={isChatLoading}
                        className="flex-1 h-10 font-sans text-[12px] tracking-widest rounded-xl border-border bg-background"
                      />
                      <Button
                        type="button"
                        onClick={() => void sendMessage()}
                        disabled={isChatLoading || !chatInput.trim()}
                        data-ocid="coach.submit_button"
                        size="icon"
                        className="h-10 w-10 rounded-full shrink-0"
                        style={{
                          background: "oklch(0.68 0.06 140)",
                          color: "white",
                        }}
                        aria-label="Send message"
                      >
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </motion.section>
          )}
        </div>

        {/* ─── Third-Party Integrations ─── */}
        <motion.section
          data-ocid="integrations.section"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <h2
            className="editorial-heading text-2xl mb-1 flex items-center gap-2"
            style={{ color: "oklch(0.22 0 0)" }}
          >
            <LeafIcon style={{ color: "oklch(0.68 0.06 140)" }} />
            <Plug
              className="w-4 h-4"
              style={{ color: "oklch(0.68 0.06 140)" }}
            />
            Third-Party Integrations
          </h2>
          <hr className="elegant-divider mb-4" />

          {/* Relative wrapper for the glassmorphism overlay */}
          <div className="relative">
            {/* Integration card */}
            <div
              className="rounded-2xl p-6 space-y-5"
              style={{
                background: "oklch(1 0 0 / 0.7)",
                backdropFilter: "blur(16px)",
                boxShadow: "0 4px 24px 0 oklch(0.22 0 0 / 0.06)",
                border: "1px solid rgba(255,255,255,0.3)",
              }}
            >
              {/* Compatibility badges */}
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="font-sans text-[11px] tracking-widest uppercase"
                  style={{ color: "oklch(0.6 0.01 85)" }}
                >
                  Works with
                </span>
                {/* Notion badge */}
                <span
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-sans text-[11px] tracking-widest"
                  style={{
                    background: "oklch(0.96 0 0)",
                    border: "1px solid oklch(0.88 0 0)",
                    color: "oklch(0.18 0 0)",
                  }}
                >
                  <NotionIcon />
                  Notion
                </span>
                {/* Slack badge */}
                <span
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-sans text-[11px] tracking-widest"
                  style={{
                    background: "oklch(0.95 0.02 305)",
                    border: "1px solid oklch(0.88 0.03 305)",
                    color: "oklch(0.35 0.12 305)",
                  }}
                >
                  <SlackIcon />
                  Slack
                </span>
                {/* Trello badge */}
                <span
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-sans text-[11px] tracking-widest"
                  style={{
                    background: "oklch(0.95 0.02 240)",
                    border: "1px solid oklch(0.88 0.03 240)",
                    color: "oklch(0.38 0.1 240)",
                  }}
                >
                  <TrelloIcon />
                  Trello
                </span>
                {/* Zapier hint */}
                <span
                  className="font-sans text-[11px] tracking-widest"
                  style={{ color: "oklch(0.65 0.01 85)" }}
                >
                  + Zapier &amp; more
                </span>
              </div>

              {/* Webhook URL row */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <label
                    htmlFor="webhook-url-input"
                    className="font-sans text-[12px] tracking-widest"
                    style={{ color: "oklch(0.35 0.01 85)" }}
                  >
                    Webhook URL
                  </label>
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          aria-label="Webhook URL help"
                          className="p-0 bg-transparent border-0 cursor-help"
                          data-ocid="integrations.webhook.input"
                        >
                          <HelpCircle
                            className="w-3.5 h-3.5"
                            style={{ color: "oklch(0.7 0.01 85)" }}
                          />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent
                        side="top"
                        className="max-w-xs font-sans text-[11px] tracking-wide"
                      >
                        Use this URL to connect your Elevatria Portal to Notion,
                        Slack, Zapier, and more. Paste the URL provided by your
                        integration service.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className="flex gap-2">
                  <Input
                    id="webhook-url-input"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    onBlur={() => {
                      if (userId) saveWebhookUrl(userId, webhookUrl);
                    }}
                    placeholder="https://hooks.zapier.com/hooks/catch/..."
                    data-ocid="integrations.webhook.input"
                    className="flex-1 h-10 font-sans text-[12px] tracking-wide rounded-xl border-border bg-background"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isTesting || !webhookUrl.trim()}
                    onClick={() => void handleTestConnection()}
                    data-ocid="integrations.test_button"
                    className="shrink-0 rounded-full font-sans text-[12px] tracking-widest h-10 px-4 gap-1.5"
                    style={{
                      borderColor: "oklch(0.85 0.01 85)",
                      color: "oklch(0.4 0.01 85)",
                    }}
                  >
                    {isTesting ? (
                      <>
                        <span
                          className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent animate-spin"
                          style={{
                            borderColor: "oklch(0.68 0.06 140)",
                            borderTopColor: "transparent",
                          }}
                        />
                        Testing…
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Test Connection
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Export button — only when roadmap exists */}
              <AnimatePresence>
                {lastRoadmap && integrationUnlocked && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Button
                      type="button"
                      disabled={isExporting || !webhookUrl.trim()}
                      onClick={() => void handleExport()}
                      data-ocid="integrations.export_button"
                      className="w-full sm:w-auto rounded-full font-sans text-[12px] tracking-widest gap-2"
                      style={{
                        background: "oklch(0.22 0 0)",
                        color: "white",
                      }}
                    >
                      {isExporting ? (
                        <>
                          <span
                            className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent animate-spin"
                            style={{
                              borderColor: "white",
                              borderTopColor: "transparent",
                            }}
                          />
                          Exporting…
                        </>
                      ) : (
                        <>📤 Export to Apps</>
                      )}
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Elite-only Live Sync toggle */}
              {isEliteTier(tier) && (
                <div
                  className="flex items-start justify-between gap-4 pt-3"
                  style={{
                    borderTop: "1px solid oklch(0.93 0.006 85)",
                  }}
                >
                  <div>
                    <p
                      className="font-sans text-[12px] tracking-widest font-medium"
                      style={{ color: "oklch(0.22 0 0)" }}
                    >
                      ⚡ Live Sync
                    </p>
                    <p
                      className="font-sans text-[11px] tracking-wide mt-0.5"
                      style={{ color: "oklch(0.6 0.01 85)" }}
                    >
                      Automatically send updates to your webhook when you edit
                      the Vision Board
                    </p>
                  </div>
                  <Switch
                    checked={liveSyncEnabled}
                    onCheckedChange={(checked) => {
                      setLiveSyncEnabled(checked);
                      if (userId) saveLiveSyncEnabled(userId, checked);
                    }}
                    data-ocid="integrations.livesync.switch"
                    aria-label="Toggle Live Sync"
                  />
                </div>
              )}
            </div>

            {/* Glassmorphism lock overlay for Starter tier */}
            {!integrationUnlocked && (
              <div
                data-ocid="integrations.locked_panel"
                className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 text-center p-8 rounded-2xl"
                style={{
                  backdropFilter: "blur(8px)",
                  background: "oklch(1 0 0 / 0.82)",
                }}
              >
                <Lock
                  className="w-8 h-8"
                  style={{ color: "oklch(0.72 0.02 85)" }}
                />
                <p
                  className="font-serif italic text-lg"
                  style={{ color: "oklch(0.22 0 0)" }}
                >
                  Connect to Notion, Slack, &amp; more with Pro Access.
                </p>
                <p
                  className="font-sans text-[11px] tracking-widest"
                  style={{ color: "oklch(0.55 0.01 85)" }}
                >
                  Upgrade to Pro to unlock Third-Party Integrations
                </p>
                <Button
                  type="button"
                  onClick={() => showUpgradeModal("integrations")}
                  data-ocid="integrations.upgrade_button"
                  className="mt-1 rounded-full font-sans text-[12px] tracking-widest px-6"
                  style={{ background: "oklch(0.22 0 0)", color: "white" }}
                >
                  Upgrade to Pro
                </Button>
              </div>
            )}
          </div>
        </motion.section>
        {/* ─── Google Calendar Sync ─── */}
        <motion.section
          data-ocid="gcal.section"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mt-10 px-4 sm:px-6 max-w-2xl mx-auto w-full"
        >
          <h2
            className="font-serif italic text-2xl mb-4 flex items-center gap-2"
            style={{ color: "oklch(0.38 0.04 145)" }}
          >
            <LeafIcon style={{ color: "oklch(0.55 0.08 145)" }} />
            <Calendar size={16} style={{ color: "oklch(0.55 0.08 145)" }} />
            Google Calendar Sync
          </h2>
          <hr className="elegant-divider mb-4" />
          <div
            className="rounded-2xl p-6 space-y-5"
            style={{
              background: "oklch(1 0 0 / 0.7)",
              backdropFilter: "blur(16px)",
              border: "1px solid oklch(0.88 0.02 85 / 0.5)",
              boxShadow: "0 4px 24px oklch(0.75 0.02 85 / 0.15)",
            }}
          >
            <p
              className="font-sans text-[12px] tracking-wide"
              style={{ color: "oklch(0.5 0.01 85)" }}
            >
              Sync your 7-Day Roadmap directly to Google Calendar and stay
              accountable every day.
            </p>
            {canUseGoogleSync(tier) && (
              <div className="flex items-center justify-between">
                <label
                  htmlFor="gcal-push-switch"
                  className="font-sans text-[12px] tracking-widest"
                  style={{ color: "oklch(0.45 0.01 85)" }}
                >
                  Push to Google Calendar
                </label>
                <Switch
                  id="gcal-push-switch"
                  checked={googlePushEnabled}
                  onCheckedChange={(checked) => {
                    setGooglePushEnabled(checked);
                    if (userId) saveGooglePushEnabled(userId, checked);
                    if (checked && lastRoadmap) void handleGoogleSync();
                  }}
                  data-ocid="gcal.push.switch"
                />
              </div>
            )}
            <Button
              type="button"
              disabled={
                isGoogleSyncing ||
                syncSuccess ||
                tier === "starter" ||
                !lastRoadmap
              }
              onClick={() => void handleGoogleSync()}
              data-ocid="gcal.sync_button"
              className={`w-full sm:w-auto rounded-full font-sans text-[12px] tracking-widest gap-2 ${
                tier === "starter" ? "opacity-50 cursor-not-allowed" : ""
              }`}
              style={
                tier !== "starter"
                  ? { background: "oklch(0.22 0 0)", color: "white" }
                  : {
                      background: "oklch(0.88 0 0)",
                      color: "oklch(0.5 0.01 85)",
                    }
              }
            >
              {isGoogleSyncing ? (
                <>
                  <span
                    className="animate-spin inline-block"
                    data-ocid="gcal.sync_button.loading_state"
                  >
                    ◌
                  </span>
                  Syncing...
                </>
              ) : syncSuccess ? (
                <span data-ocid="gcal.sync_button.success_state">
                  ✅ Roadmap Synced!
                </span>
              ) : (
                <>
                  <Calendar size={14} />
                  {tier === "starter"
                    ? "🔒 Sync My Elevatria Calendar"
                    : "🗓️ Sync My Elevatria Calendar"}
                </>
              )}
            </Button>
            {canUseGoogleSync(tier) && (
              <p
                className="font-sans text-[11px] tracking-widest"
                style={{ color: "oklch(0.65 0.01 85)" }}
              >
                {tier === "elite"
                  ? "✨ Elite events include sparkle branding"
                  : "Pro sync active"}
              </p>
            )}
            {tier === "starter" && (
              <p
                className="font-sans text-[11px] tracking-widest"
                style={{ color: "oklch(0.65 0.01 85)" }}
              >
                Upgrade to Pro or Elite to unlock Google Calendar sync.
              </p>
            )}
          </div>
        </motion.section>

        {/* ─── Personalize Your Space ─── */}
        <motion.section
          data-ocid="theme.section"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mt-10 px-4 sm:px-6 max-w-2xl mx-auto w-full"
        >
          <h2
            className="font-serif italic text-2xl mb-1 flex items-center gap-2"
            style={{ color: "oklch(0.38 0.04 145)" }}
          >
            <LeafIcon style={{ color: "oklch(0.55 0.08 145)" }} />
            <Palette size={16} style={{ color: "oklch(0.55 0.08 145)" }} />
            Personalize Your Space
          </h2>
          <hr className="elegant-divider mb-4" />

          {tier === "starter" ? (
            /* Starter: locked glassmorphism card */
            <button
              type="button"
              data-ocid="theme.locked.panel"
              className="relative rounded-2xl overflow-hidden cursor-pointer w-full text-left"
              onClick={() => showUpgradeModal("theme")}
              aria-label="Unlock theme customization"
              style={{
                background: "oklch(1 0 0 / 0.7)",
                backdropFilter: "blur(16px)",
                border: "1px solid rgba(255,255,255,0.3)",
                boxShadow: "0 4px 24px 0 oklch(0.22 0 0 / 0.06)",
              }}
            >
              {/* Blurred preview */}
              <div className="p-6 flex items-center gap-4 blur-sm pointer-events-none select-none">
                <div
                  className="w-13 h-13 rounded-full shrink-0 ring-2 ring-offset-2"
                  style={{
                    background:
                      "linear-gradient(135deg, #e8a0a0 0%, #f5d0d0 50%, #fdf0ee 100%)",
                    width: "52px",
                    height: "52px",
                  }}
                />
                <span
                  className="font-serif italic text-sm"
                  style={{ color: "oklch(0.38 0.04 15)" }}
                >
                  Rose Quartz
                </span>
              </div>
              {/* Lock overlay */}
              <div
                className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-2xl"
                style={{
                  background: "oklch(0.97 0.005 85 / 0.82)",
                  backdropFilter: "blur(4px)",
                }}
              >
                <Lock
                  className="w-5 h-5"
                  style={{ color: "oklch(0.55 0.08 85)" }}
                />
                <p
                  className="font-sans text-[12px] tracking-wide text-center max-w-xs px-4"
                  style={{ color: "oklch(0.38 0.04 85)" }}
                >
                  Unlock Aesthetics: Upgrade to Pro to customize your
                  portal&apos;s vibe.
                </p>
              </div>
            </button>
          ) : (
            /* Pro & Elite: theme picker */
            <div
              className="rounded-2xl p-6 space-y-5"
              style={{
                background: "oklch(1 0 0 / 0.7)",
                backdropFilter: "blur(16px)",
                boxShadow: "0 4px 24px 0 oklch(0.22 0 0 / 0.06)",
                border: "1px solid rgba(255,255,255,0.3)",
              }}
            >
              <p
                className="font-sans text-[12px] tracking-widest"
                style={{ color: "oklch(0.55 0.01 85)" }}
              >
                Choose your portal&apos;s aesthetic
              </p>
              {/* Swatch row */}
              <div className="flex flex-wrap gap-6 items-end">
                {THEMES.map((theme, idx) => (
                  <button
                    key={theme.id}
                    type="button"
                    data-ocid={
                      `theme.swatch.${idx + 1}` as `theme.swatch.${1 | 2 | 3 | 4}`
                    }
                    onClick={() => applyTheme(theme.id)}
                    aria-label={`Apply ${theme.name} theme`}
                    aria-pressed={activeTheme === theme.id}
                    className="flex flex-col items-center gap-1.5 group focus:outline-none"
                  >
                    <div
                      className="rounded-full transition-all duration-300"
                      style={{
                        width: "52px",
                        height: "52px",
                        background: theme.swatchGradient,
                        boxShadow:
                          activeTheme === theme.id
                            ? "0 0 0 2px white, 0 0 0 4px oklch(0.55 0.08 145)"
                            : "0 2px 8px oklch(0.22 0 0 / 0.12)",
                        transform:
                          activeTheme === theme.id ? "scale(1.1)" : "scale(1)",
                      }}
                    />
                    <span
                      className="font-sans text-[10px] tracking-widest uppercase"
                      style={{
                        color:
                          activeTheme === theme.id
                            ? "oklch(0.38 0.06 145)"
                            : "oklch(0.55 0.01 85)",
                        fontWeight: activeTheme === theme.id ? "600" : "400",
                      }}
                    >
                      {theme.name}
                    </span>
                  </button>
                ))}
              </div>

              {/* Elite: custom hex picker */}
              {canUseCustomHex(tier) && (
                <div
                  className="pt-2 border-t"
                  style={{ borderColor: "oklch(0.92 0.008 85)" }}
                >
                  <p
                    className="font-sans text-[11px] tracking-widest mb-3"
                    style={{ color: "oklch(0.45 0.01 85)" }}
                  >
                    ✦ Your Brand Color
                  </p>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      data-ocid="theme.input"
                      value={customHex || "#7a9e7e"}
                      onChange={(e) => applyCustomHex(e.target.value)}
                      aria-label="Custom brand color picker"
                      className="cursor-pointer rounded-lg border-0 p-0 focus:outline-none focus:ring-2 focus:ring-offset-2"
                      style={{
                        width: "44px",
                        height: "44px",
                        borderRadius: "12px",
                        border: "1px solid oklch(0.88 0.01 85)",
                        padding: "2px",
                        background: "none",
                      }}
                    />
                    <div>
                      <p
                        className="font-sans text-[12px] tracking-widest"
                        style={{ color: "oklch(0.35 0.01 85)" }}
                      >
                        Custom Hex
                      </p>
                      <p
                        className="font-sans text-[11px] tracking-wide"
                        style={{ color: "oklch(0.65 0.01 85)" }}
                      >
                        {customHex || "Pick a color to set your brand accent"}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </motion.section>
      </main>

      {/* ── Floating Gratitude Button ── */}
      <button
        type="button"
        className="fab-gratitude"
        onClick={() => setGratitudeOpen(true)}
        aria-label="Open Daily Gratitude"
        data-ocid="dashboard.gratitude.open_modal_button"
      >
        <span className="text-xl">✨</span>
      </button>

      {/* ── Daily Gratitude Dialog ── */}
      <Dialog
        open={gratitudeOpen}
        onOpenChange={setGratitudeOpen}
        data-ocid="dashboard.gratitude.dialog"
      >
        <DialogContent className="glass-card max-w-sm rounded-3xl border-0 p-6">
          <DialogHeader>
            <DialogTitle className="editorial-heading text-2xl">
              Daily Gratitude
            </DialogTitle>
            <DialogDescription
              className="font-sans text-xs tracking-wide"
              style={{ color: "oklch(0.55 0.01 85)" }}
            >
              What are you grateful for today?
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="I am grateful for..."
            value={gratitudeText}
            onChange={(e) => setGratitudeText(e.target.value)}
            className="min-h-[100px] font-sans text-sm resize-none rounded-2xl bg-white/50 border-border mt-2"
            data-ocid="dashboard.gratitude.textarea"
          />
          {gratitudeEntries.length > 0 && (
            <div className="space-y-1 max-h-32 overflow-y-auto mt-1">
              {gratitudeEntries.slice(-3).map((entry) => (
                <p
                  key={entry}
                  className="text-xs font-sans italic px-1"
                  style={{ color: "oklch(0.6 0.01 85)" }}
                >
                  ✦ {entry}
                </p>
              ))}
            </div>
          )}
          <DialogFooter className="mt-2">
            <Button
              type="button"
              onClick={() => {
                if (gratitudeText.trim()) {
                  setGratitudeEntries((prev) => [
                    ...prev,
                    gratitudeText.trim(),
                  ]);
                  setGratitudeText("");
                  toast.success("Gratitude logged ✨");
                }
                setGratitudeOpen(false);
              }}
              className="btn-shimmer btn-magnetic w-full min-h-[44px]"
              data-ocid="dashboard.gratitude.submit_button"
            >
              Log Gratitude
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upgrade Modal */}
      <Dialog
        open={upgradeModal.open}
        onOpenChange={(open) => setUpgradeModal((m) => ({ ...m, open }))}
      >
        <DialogContent
          className="sm:max-w-sm rounded-2xl text-center"
          data-ocid="upgrade.modal"
          style={{ background: "oklch(1 0 0)" }}
        >
          <DialogHeader>
            <DialogTitle
              className="font-serif italic text-xl"
              style={{ color: "oklch(0.22 0 0)" }}
            >
              ✨ Expand Your Access
            </DialogTitle>
          </DialogHeader>
          <p
            className="font-sans text-[12px] tracking-wide leading-relaxed mt-2"
            style={{ color: "oklch(0.45 0.01 85)" }}
          >
            {upgradeModal.message}
          </p>
          <Button
            type="button"
            onClick={() => setUpgradeModal((m) => ({ ...m, open: false }))}
            data-ocid="upgrade.modal.close_button"
            className="mt-4 w-full rounded-full font-sans text-[12px] tracking-widest"
            style={{ background: "oklch(0.22 0 0)", color: "white" }}
          >
            Got it
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog
        open={calendarPermissionModalOpen}
        onOpenChange={setCalendarPermissionModalOpen}
      >
        <DialogContent className="sm:max-w-sm rounded-2xl text-center">
          <DialogHeader>
            <DialogTitle className="font-serif italic text-xl">
              Calendar Access Needed
            </DialogTitle>
            <DialogDescription className="font-sans text-[12px] tracking-wide">
              Elevatria needs Google Calendar permission to create and update your
              task development events. Please grant Calendar access and retry.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              onClick={() => {
                clearToken();
                setCalendarPermissionModalOpen(false);
              }}
              className="w-full rounded-full font-sans text-[12px] tracking-widest"
            >
              Re-authorize Google Calendar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Vision Cell Dialog */}
      <Dialog
        open={openCellIndex !== null}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
      >
        <DialogContent
          className="sm:max-w-md rounded-2xl"
          data-ocid="visionboard.cell_dialog"
          style={{ background: "oklch(1 0 0)" }}
        >
          <DialogHeader>
            <DialogTitle
              className="font-serif italic text-lg"
              style={{ color: "oklch(0.22 0 0)" }}
            >
              {openedCell?.cellType === "empty"
                ? "Add to Vision Board"
                : "Edit Vision Cell"}
            </DialogTitle>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList
              className="w-full rounded-xl"
              style={{ background: "oklch(0.96 0.006 85)" }}
            >
              <TabsTrigger
                value="goal"
                className="flex-1 rounded-lg font-sans text-[12px] tracking-widest"
                data-ocid="visionboard.goal.tab"
              >
                ✍️ Add Goal
              </TabsTrigger>
              <TabsTrigger
                value="image"
                className="flex-1 rounded-lg font-sans text-[12px] tracking-widest"
                data-ocid="visionboard.image.tab"
                onClick={(e) => {
                  if (!canUploadImages(tier)) {
                    e.preventDefault();
                    showUpgradeModal("image");
                  }
                }}
              >
                {canUploadImages(tier) ? "🖼️ Upload Image" : "🔒 Upload Image"}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="goal" className="mt-4 space-y-4">
              <Textarea
                value={goalText}
                onChange={(e) => setGoalText(e.target.value)}
                placeholder="Write your vision goal... e.g. Run a marathon, launch my business, travel to Bali"
                data-ocid="visionboard.goal.input"
                rows={4}
                className="font-sans text-[12px] tracking-wide resize-none rounded-xl border-border"
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={saveGoal}
                  data-ocid="visionboard.goal.save_button"
                  className="flex-1 rounded-full font-sans text-[12px] tracking-widest"
                  style={{ background: "oklch(0.68 0.06 140)", color: "white" }}
                >
                  Save Goal
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeDialog}
                  data-ocid="visionboard.goal.cancel_button"
                  className="rounded-full font-sans text-[12px] tracking-widest"
                >
                  Cancel
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="image" className="mt-4 space-y-4">
              <label
                className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed cursor-pointer py-8 transition-colors"
                style={{ borderColor: "oklch(0.88 0.03 140)" }}
                data-ocid="visionboard.upload_button"
              >
                <ImageIcon
                  className="w-8 h-8"
                  style={{ color: "oklch(0.68 0.06 140)" }}
                />
                <div className="text-center">
                  <p
                    className="font-sans text-[12px] tracking-widest font-medium"
                    style={{ color: "oklch(0.22 0 0)" }}
                  >
                    Click to upload your vision image
                  </p>
                  <p
                    className="font-sans text-[11px] tracking-wide mt-1"
                    style={{ color: "oklch(0.5 0.01 85)" }}
                  >
                    PNG, JPG, WEBP supported
                  </p>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="sr-only"
                />
              </label>
              <Button
                type="button"
                variant="outline"
                onClick={closeDialog}
                className="w-full rounded-full font-sans text-[12px] tracking-widest"
                data-ocid="visionboard.upload.cancel_button"
              >
                Cancel
              </Button>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <Toaster position="bottom-right" />
    </div>
  );
}

// ─── Vision Cell Card Component ──────────────────────────────────────────────

interface VisionCellCardProps {
  cell: VisionCellData;
  displayIndex: number;
  onClick: () => void;
  onRemove: (e: React.MouseEvent) => void;
}

function VisionCellCard({
  cell,
  displayIndex,
  onClick,
  onRemove,
}: VisionCellCardProps) {
  const ocid = `visionboard.item.${displayIndex}`;

  return (
    <motion.button
      type="button"
      data-ocid={ocid}
      onClick={onClick}
      className="relative vision-cell-luxury overflow-hidden cursor-pointer group"
      style={{
        aspectRatio: "1",
        borderRadius: "24px",
        border:
          cell.cellType === "empty"
            ? "2px dashed oklch(0.88 0.03 140)"
            : "2px solid oklch(0.92 0.008 85)",
        background:
          cell.cellType === "text"
            ? "oklch(0.972 0.008 85)"
            : cell.cellType === "image"
              ? "oklch(0.22 0 0)"
              : "oklch(1 0 0 / 0.7)",
      }}
      whileHover={{ y: -5, scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      aria-label={
        cell.cellType === "empty"
          ? `Add vision to cell ${displayIndex}`
          : `Edit cell ${displayIndex}`
      }
    >
      {cell.cellType === "empty" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
          <Plus
            className="w-6 h-6 transition-transform group-hover:scale-110"
            style={{ color: "oklch(0.68 0.06 140)" }}
          />
          <span
            className="font-sans text-[11px] tracking-widest uppercase"
            style={{ color: "oklch(0.7 0.02 140)" }}
          >
            Add Vision
          </span>
        </div>
      )}

      {cell.cellType === "text" && (
        <>
          <div className="absolute inset-0 flex items-center justify-center p-2">
            <p
              className="font-sans text-[11px] tracking-wide font-medium text-center leading-tight line-clamp-4"
              style={{ color: "oklch(0.22 0 0)" }}
            >
              {cell.content}
            </p>
          </div>
          {/* Edit overlay */}
          <div
            className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            style={{
              background: "oklch(0.68 0.06 140 / 0.15)",
              borderRadius: "24px",
            }}
          >
            <Pencil
              className="w-4 h-4"
              style={{ color: "oklch(0.45 0.07 140)" }}
            />
          </div>
        </>
      )}

      {cell.cellType === "image" && (
        <>
          <img
            src={cell.content}
            alt={`Vision board cell ${displayIndex}`}
            className="absolute inset-0 w-full h-full object-cover"
          />
          {/* Remove button */}
          <button
            type="button"
            onClick={onRemove}
            className="absolute top-1 right-1 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ background: "oklch(0.22 0 0 / 0.7)" }}
            aria-label={`Remove image from cell ${displayIndex}`}
          >
            <X className="w-3 h-3 text-white" />
          </button>
        </>
      )}
    </motion.button>
  );
}
