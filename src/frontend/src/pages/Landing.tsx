import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authenticate, setSession, setSessionTier } from "@/lib/storage";
import { getTier } from "@/lib/tier";
import { useRouter } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";

// Minimalist botanical leaf SVG icon
function LeafIcon({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      width="16"
      height="16"
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

export default function Landing() {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId.trim() || !accessCode.trim()) {
      setError(true);
      return;
    }
    setLoading(true);
    setError(false);

    await new Promise((r) => setTimeout(r, 600));

    const valid = authenticate(userId.trim(), accessCode.trim());
    setLoading(false);

    if (valid) {
      setSession(userId.trim());
      setSessionTier(getTier(accessCode.trim()));
      void router.navigate({ to: "/dashboard" });
    } else {
      setError(true);
    }
  };

  return (
    <div
      data-ocid="landing.page"
      className="relative min-h-screen bg-background overflow-hidden flex flex-col items-center justify-center px-4 page-transition"
    >
      {/* Decorative orbs */}
      <div
        className="orb w-80 h-80 -top-20 -left-20"
        style={{ background: "oklch(0.88 0.03 140 / 0.6)" }}
        aria-hidden="true"
      />
      <div
        className="orb w-64 h-64 -bottom-16 -right-16"
        style={{ background: "oklch(0.85 0.04 95 / 0.5)" }}
        aria-hidden="true"
      />
      <div
        className="orb w-48 h-48 top-1/3 -right-8"
        style={{ background: "oklch(0.9 0.02 140 / 0.4)" }}
        aria-hidden="true"
      />

      {/* Decorative botanical image — top right */}
      <img
        src="/assets/generated/botanical-accent.dim_400x400.png"
        alt=""
        aria-hidden="true"
        className="absolute -top-10 -right-10 w-64 h-64 opacity-30 pointer-events-none select-none"
        style={{ transform: "rotate(15deg)" }}
      />

      {/* Decorative botanical image — bottom left */}
      <img
        src="/assets/generated/botanical-accent.dim_400x400.png"
        alt=""
        aria-hidden="true"
        className="absolute -bottom-10 -left-10 w-48 h-48 opacity-20 pointer-events-none select-none"
        style={{ transform: "rotate(-160deg)" }}
      />

      {/* Decorative botanical SVG — corner */}
      <svg
        className="absolute bottom-8 left-8 w-20 h-20 opacity-10"
        viewBox="0 0 80 80"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="40" cy="40" r="4" fill="oklch(0.68 0.06 140)" />
        <ellipse cx="40" cy="22" rx="5" ry="14" fill="oklch(0.72 0.05 140)" />
        <ellipse cx="40" cy="58" rx="5" ry="14" fill="oklch(0.72 0.05 140)" />
        <ellipse cx="22" cy="40" rx="14" ry="5" fill="oklch(0.72 0.05 140)" />
        <ellipse cx="58" cy="40" rx="14" ry="5" fill="oklch(0.72 0.05 140)" />
      </svg>

      {/* Main content */}
      <motion.div
        className="relative z-10 flex flex-col items-center w-full max-w-md"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        {/* Logo / Title */}
        <motion.div
          className="text-center mb-6"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <div className="flex items-center justify-center gap-2 mb-3">
            <Sparkles
              className="w-5 h-5 animate-sparkle"
              style={{ color: "oklch(0.68 0.06 140)" }}
            />
            <span
              className="font-sans font-medium tracking-[0.25em] uppercase text-[12px]"
              style={{ color: "oklch(0.68 0.06 140)" }}
            >
              Manifest · Glow · Rise
            </span>
            <Sparkles
              className="w-5 h-5 animate-sparkle"
              style={{ color: "oklch(0.68 0.06 140)", animationDelay: "1.5s" }}
            />
          </div>
          <h1
            className="editorial-heading text-4xl md:text-5xl leading-tight"
            style={{ color: "oklch(0.22 0 0)" }}
          >
            Elevatria
          </h1>
          <p
            className="mt-3 font-sans text-[12px] tracking-widest uppercase"
            style={{ color: "oklch(0.55 0.01 85)" }}
          >
            Your sacred space to manifest your most elevated life.
          </p>
        </motion.div>

        {/* Elegant divider between heading and card */}
        <hr className="elegant-divider w-full mb-6" />

        {/* Access Card — glassmorphism */}
        <motion.div
          className="w-full rounded-2xl glass-card p-8"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <div className="mb-6">
            <h2
              className="editorial-heading text-xl flex items-center gap-2"
              style={{ color: "oklch(0.22 0 0)" }}
            >
              <LeafIcon style={{ color: "oklch(0.68 0.06 140)" }} />
              Member Access
            </h2>
            <p
              className="font-sans text-[12px] tracking-widest mt-1 uppercase"
              style={{ color: "oklch(0.55 0.01 85)" }}
            >
              Enter your credentials to unlock your portal.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label
                htmlFor="userId"
                className="font-sans text-[12px] font-medium tracking-widest uppercase"
                style={{ color: "oklch(0.35 0.01 85)" }}
              >
                User ID
              </Label>
              <Input
                id="userId"
                type="text"
                value={userId}
                onChange={(e) => {
                  setUserId(e.target.value);
                  setError(false);
                }}
                placeholder="Enter your User ID"
                autoComplete="username"
                className="h-11 font-sans text-[12px] tracking-widest border-border bg-background/60 focus-visible:ring-sage rounded-xl"
                style={
                  {
                    "--tw-ring-color": "oklch(0.68 0.06 140)",
                  } as React.CSSProperties
                }
                data-ocid="auth.userid.input"
                disabled={loading}
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="accessCode"
                className="font-sans text-[12px] font-medium tracking-widest uppercase"
                style={{ color: "oklch(0.35 0.01 85)" }}
              >
                Access Code
              </Label>
              <Input
                id="accessCode"
                type="password"
                value={accessCode}
                onChange={(e) => {
                  setAccessCode(e.target.value);
                  setError(false);
                }}
                placeholder="Enter your Access Code"
                autoComplete="current-password"
                className="h-11 font-sans text-[12px] tracking-widest border-border bg-background/60 rounded-xl"
                data-ocid="auth.accesscode.input"
                disabled={loading}
              />
            </div>

            {/* Error state */}
            {error && (
              <motion.div
                data-ocid="auth.error_state"
                className="rounded-lg px-4 py-3 font-sans text-[12px] tracking-wide"
                style={{
                  background: "oklch(0.97 0.02 27)",
                  color: "oklch(0.45 0.2 27)",
                  border: "1px solid oklch(0.85 0.08 27)",
                }}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                role="alert"
              >
                Access Invalid. Please check your credentials.
              </motion.div>
            )}

            {/* Loading state */}
            {loading && (
              <div
                data-ocid="auth.loading_state"
                className="flex flex-col items-center justify-center gap-2 py-2"
                aria-live="polite"
              >
                <span className="sparkle-loader text-xl">✨</span>
                <span
                  className="affirmation-loading font-sans text-[12px] tracking-widest uppercase"
                  style={{ color: "oklch(0.55 0.01 85)" }}
                >
                  Verifying access...
                </span>
              </div>
            )}

            {/* Pill shimmer button */}
            <Button
              type="submit"
              data-ocid="auth.submit_button"
              disabled={loading}
              className="btn-shimmer btn-magnetic w-full h-11 font-sans font-medium text-[12px] tracking-widest uppercase text-white transition-all duration-200 rounded-full min-h-[44px]"
            >
              {loading ? "Entering..." : "Enter the Portal ✶"}
            </Button>
          </form>
        </motion.div>

        {/* Footer hint */}
        <motion.p
          className="mt-6 font-sans text-[12px] tracking-widest text-center uppercase"
          style={{ color: "oklch(0.65 0.008 85)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          Members only · Elevatria
        </motion.p>
      </motion.div>
    </div>
  );
}
