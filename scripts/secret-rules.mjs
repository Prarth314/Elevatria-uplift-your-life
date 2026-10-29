// Findings contain metadata only. Never return matched values.
const patterns = [
	[
		"provider credential",
		"high",
		/\b(?:sk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{24,}|sb_secret_[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{24,}|github_pat_[A-Za-z0-9_]{30,}|AKIA[A-Z0-9]{16}|AIza[\w-]{30,})\b/g,
	],
	["private key", "high", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
	[
		"database connection credential",
		"high",
		/\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^\s/:]+:[^\s/@]+@[^\s]+/g,
	],
	[
		"email address requiring context review",
		"review",
		/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi,
	],
];
export function scanText(text) {
	const findings = [];
	for (const [category, severity, pattern] of patterns) {
		pattern.lastIndex = 0;
		const matches = [...text.matchAll(pattern)];
		if (matches.length)
			findings.push({ category, severity, count: matches.length });
	}
	const tokens = [
		...text.matchAll(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g),
	];
	let privileged = 0,
		publicKeys = 0;
	for (const match of tokens)
		try {
			const payload = JSON.parse(
				Buffer.from(match[0].split(".")[1], "base64url").toString(),
			);
			if (payload.role === "anon") publicKeys++;
			else privileged++;
		} catch {
			privileged++;
		}
	if (privileged)
		findings.push({
			category: "non-public JWT credential",
			severity: "high",
			count: privileged,
		});
	if (publicKeys)
		findings.push({
			category: "public anon JWT key (review configuration)",
			severity: "review",
			count: publicKeys,
		});
	return findings;
}
