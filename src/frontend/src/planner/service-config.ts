/** Accept either Supabase's new publishable key or legacy anon configuration, never conflicting values. */
export function configuredPublicKey(
	primary: unknown,
	anon: unknown,
): string | undefined {
	if (primary && anon && primary !== anon) return undefined;
	const value = primary || anon;
	return publicKey(value) ? value : undefined;
}
export function serviceUrl(value: unknown, allowLocal = false): string | null {
	if (
		typeof value !== "string" ||
		value.length > 2048 ||
		value.trim() !== value ||
		/[\u0000-\u0020\u007f]/.test(value)
	)
		return null;
	try {
		const url = new URL(value);
		if (
			url.username ||
			url.password ||
			url.search ||
			url.hash ||
			!["", "/"].includes(url.pathname)
		)
			return null;
		const managed =
			url.protocol === "https:" &&
			/^[a-z0-9-]+\.supabase\.co$/.test(url.hostname) &&
			!url.port;
		const local =
			allowLocal &&
			url.protocol === "http:" &&
			["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
		return managed || local ? url.origin : null;
	} catch {
		return null;
	}
}
export function privilegedCredential(value: unknown): boolean {
	if (typeof value !== "string") return false;
	if (
		/^(?:sb_secret_|sk-(?:proj-|svcacct-)?|gh[pousr]_|github_pat_|AKIA)/.test(
			value,
		)
	)
		return true;
	if (/^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value))
		try {
			return (
				JSON.parse(
					atob(value.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
				).role !== "anon"
			);
		} catch {
			return true;
		}
	return false;
}
export function publicKey(value: unknown): value is string {
	if (
		typeof value !== "string" ||
		value.length > 4096 ||
		privilegedCredential(value)
	)
		return false;
	if (/^sb_publishable_[A-Za-z0-9_-]{12,}$/.test(value)) return true;
	try {
		return (
			/^eyJ[^.]+\.[^.]+\.[^.]+$/.test(value) &&
			JSON.parse(
				atob(value.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
			).role === "anon"
		);
	} catch {
		return false;
	}
}
