// ─── Storage helpers ────────────────────────────────────────────────────────
// Thin wrappers around localStorage with typed keys per userId.

const SESSION_KEY = "glowup_session";
const TIER_KEY = "glowup_tier";

export type ThemeId =
	| "signature"
	| "midnight-muse"
	| "rose-quartz"
	| "cyber-minimalist";

export interface VisionCell {
	cellIndex: number;
	cellType: "empty" | "text" | "image";
	content: string;
	imageUrl?: string;
	label?: string;
}

export interface ChatMessage {
	role: "user" | "assistant";
	content: string;
	timestamp?: number;
}

// ── Auth table ──────────────────────────────────────────────────────────────

// Retired browser-only authentication. No credentials are read, compared, or persisted.
export function authenticate(_userId: string, _accessCode: string): boolean {
	return false;
}
export function addUser(
	_userId: string,
	_accessCode: string,
): "ok" | "duplicate" {
	throw Error(
		"Prototype authentication is retired. Use the authenticated cloud API.",
	);
}
export function deleteUser(_userId: string): void {
	throw Error("Prototype authentication is retired.");
}
export function getAllUsers(): string[] {
	return [];
}
export function getSession(): string | null {
	return null;
}
export function setSession(_userId: string): void {
	throw Error("Prototype authentication is retired.");
}
export function clearSession(): void {
	sessionStorage.removeItem(SESSION_KEY);
	sessionStorage.removeItem(TIER_KEY);
}
export function setSessionTier(_tier: string): void {
	throw Error("Prototype membership tiers are retired.");
}
export function getSessionTier(): string | null {
	return null;
}

// ── Vision board ─────────────────────────────────────────────────────────────

function visionKey(userId: string): string {
	return `glowup_vision_${userId}`;
}

export function getVisionBoard(userId: string): VisionCell[] {
	try {
		const raw = localStorage.getItem(visionKey(userId));
		if (raw) return JSON.parse(raw) as VisionCell[];
	} catch {
		// ignore
	}
	return Array.from({ length: 9 }, (_, i) => ({
		cellIndex: i,
		cellType: "empty" as const,
		content: "",
	}));
}

export function saveVisionBoard(userId: string, cells: VisionCell[]): void {
	localStorage.setItem(visionKey(userId), JSON.stringify(cells));
}

export function updateVisionCell(
	userId: string,
	cellIndex: number,
	update: Partial<VisionCell>,
): VisionCell[] {
	const cells = getVisionBoard(userId);
	const updated = cells.map((cell) =>
		cell.cellIndex === cellIndex ? { ...cell, ...update } : cell,
	);
	saveVisionBoard(userId, updated);
	return updated;
}

// ── Chat history ─────────────────────────────────────────────────────────────

function chatKey(userId: string): string {
	return `glowup_chat_${userId}`;
}

export function getChatHistory(userId: string): ChatMessage[] {
	try {
		const raw = localStorage.getItem(chatKey(userId));
		if (raw) return JSON.parse(raw) as ChatMessage[];
	} catch {
		// ignore
	}
	return [];
}

export function saveChatHistory(userId: string, messages: ChatMessage[]): void {
	const trimmed = messages.slice(-20);
	localStorage.setItem(chatKey(userId), JSON.stringify(trimmed));
}

export function clearChatHistory(userId: string): void {
	localStorage.removeItem(chatKey(userId));
}

// ── Daily affirmation ──────────────────────────────────────────────────────────

const AFFIRMATIONS = [
	"I am magnetic. Everything I desire flows to me effortlessly.",
	"I am that girl. My glow-up is inevitable.",
	"Every day I become a more radiant version of myself.",
	"I attract abundance, love, and success naturally.",
	"My confidence is my crown and I wear it daily.",
	"I am worthy of all the beautiful things life has to offer.",
	"I move in silence and let my results speak.",
	"The universe is conspiring in my favor right now.",
	"I am leveling up mentally, physically, and spiritually.",
	"My energy is a gift — I protect and honor it.",
	"I choose myself every single day without apology.",
	"Healing, growing, and glowing — that is my journey.",
	"I am exactly where I need to be on my path.",
	"Abundance is my natural state of being.",
	"I trust the process even when I cannot see the full picture.",
	"I am becoming the woman I always dreamed of being.",
	"My life is a masterpiece that I am actively creating.",
	"I radiate beauty, grace, and unstoppable power.",
	"I am deeply loved, deeply supported, and deeply guided.",
	"Every morning I wake up closer to my dreams.",
	"I set boundaries because I honor my peace.",
	"My future self is proud of the choices I make today.",
	"I am a walking manifestation of my intentions.",
	"Greatness lives inside me and I unleash it daily.",
	"I deserve softness, joy, and everything good.",
	"Money, health, and love flow to me abundantly.",
	"I am transforming my vision into reality right now.",
	"I glow differently when I stay true to myself.",
	"The best version of me is always emerging.",
	"I am in divine alignment with my highest self.",
	"My dreams are valid and my ambition is limitless.",
	"I release what no longer serves me and embrace my evolution.",
	"I am the author of my own story — and it is beautiful.",
	"Success is not just coming — it is already mine.",
	"I cultivate inner peace and it shows in my outer world.",
	"I am disciplined, focused, and unstoppable.",
	"Every challenge I face is making me stronger and wiser.",
	"I walk into every room knowing my worth.",
	"My consistency is building the life I have always wanted.",
	"I am grateful for how far I have come and excited for what is next.",
	"I choose growth over comfort every single day.",
	"I am a magnet for miraculous opportunities.",
	"My intuition guides me to exactly where I need to be.",
	"I invest in myself because I am worth every effort.",
	"I glow from the inside out — it is who I am.",
	"Abundance is not something I chase — it is something I embody.",
	"I am unapologetically becoming my most elevated self.",
	"The universe rewards those who believe in themselves — I believe.",
	"I am whole, healed, and full of infinite potential.",
	"Today I rise, shine, and claim everything meant for me.",
];

function simpleHash(str: string): number {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		hash = (hash * 31 + str.charCodeAt(i)) & 0x7fffffff;
	}
	return hash;
}

function getDayOfYear(): number {
	const now = new Date();
	const start = new Date(now.getFullYear(), 0, 0);
	const diff = now.getTime() - start.getTime();
	const oneDay = 1000 * 60 * 60 * 24;
	return Math.floor(diff / oneDay);
}

export function getDailyAffirmation(userId: string): string {
	const day = getDayOfYear();
	const hash = simpleHash(userId);
	const index = (day + hash) % AFFIRMATIONS.length;
	return AFFIRMATIONS[index];
}

// ── Integrations ─────────────────────────────────────────────────────────────

export function getWebhookUrl(userId: string): string {
	return localStorage.getItem(`glowup_webhook_${userId}`) ?? "";
}

export function saveWebhookUrl(userId: string, url: string): void {
	localStorage.setItem(`glowup_webhook_${userId}`, url);
}

export function getLiveSyncEnabled(userId: string): boolean {
	return localStorage.getItem(`glowup_livesync_${userId}`) === "true";
}

export function saveLiveSyncEnabled(userId: string, val: boolean): void {
	localStorage.setItem(`glowup_livesync_${userId}`, String(val));
}

export function getGooglePushEnabled(userId: string): boolean {
	return localStorage.getItem(`glowup_${userId}_google_push`) === "true";
}

export function saveGooglePushEnabled(userId: string, val: boolean): void {
	localStorage.setItem(`glowup_${userId}_google_push`, String(val));
}

// ── Theme ───────────────────────────────────────────────────────────────────────

export function getActiveTheme(userId: string): ThemeId {
	const saved = localStorage.getItem(`glowup_theme_${userId}`);
	// Migrate legacy "vanilla-girl" to the renamed "cyber-minimalist" preset
	if (saved === "vanilla-girl") {
		localStorage.setItem(`glowup_theme_${userId}`, "cyber-minimalist");
		return "cyber-minimalist";
	}
	return (saved as ThemeId) ?? "signature";
}

export function saveActiveTheme(userId: string, theme: ThemeId): void {
	localStorage.setItem(`glowup_theme_${userId}`, theme);
}

export function getCustomHex(userId: string): string {
	return localStorage.getItem(`glowup_custom_hex_${userId}`) ?? "";
}

export function saveCustomHex(userId: string, hex: string): void {
	localStorage.setItem(`glowup_custom_hex_${userId}`, hex);
}
