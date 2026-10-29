const formatters = new Map<string, Intl.DateTimeFormat>();
export function validTimezone(value: string): boolean {
	try {
		new Intl.DateTimeFormat("en", { timeZone: value }).format();
		return true;
	} catch {
		return false;
	}
}
export function partsAt(instant: number, timezone: string) {
	let formatter = formatters.get(timezone);
	if (!formatter) {
		formatter = new Intl.DateTimeFormat("en-CA", {
			timeZone: timezone,
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
			hourCycle: "h23",
		});
		formatters.set(timezone, formatter);
	}
	return Object.fromEntries(
		formatter
			.formatToParts(instant)
			.filter((p) => p.type !== "literal")
			.map((p) => [p.type, p.value]),
	);
}
export function dateAt(instant: number, timezone: string) {
	const p = partsAt(instant, timezone);
	return `${p.year}-${p.month}-${p.day}`;
}
export function addDays(date: string, days: number) {
	return new Date(Date.parse(`${date}T12:00:00Z`) + days * 86400000)
		.toISOString()
		.slice(0, 10);
}
export function clockMinutes(value: string) {
	return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)
		? Number(value.slice(0, 2)) * 60 + Number(value.slice(3))
		: NaN;
}
/** Reject nonexistent DST wall times; choose the earlier instant when the clock repeats. */
export function wallInstant(
	date: string,
	clock: string,
	timezone: string,
): number | null {
	const seed = Date.parse(`${date}T${clock}:00Z`);
	if (!Number.isFinite(seed)) return null;
	const offsets = new Set<number>();
	for (const hours of [-36, -12, 0, 12, 36]) {
		const instant = seed + hours * 3600000;
		const p = partsAt(instant, timezone);
		offsets.add(
			Date.parse(
				`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`,
			) - instant,
		);
	}
	const candidates = [...offsets]
		.map((offset) => seed - offset)
		.filter((instant) => {
			const p = partsAt(instant, timezone);
			return (
				`${p.year}-${p.month}-${p.day}` === date &&
				`${p.hour}:${p.minute}` === clock
			);
		});
	return candidates.length ? Math.min(...candidates) : null;
}
