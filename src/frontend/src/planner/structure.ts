export function plain(
	value: unknown,
	keys: readonly string[],
): value is Record<string, unknown> {
	if (!value || typeof value !== "object" || Array.isArray(value)) return false;
	const prototype = Object.getPrototypeOf(value);
	return (
		(prototype === Object.prototype || prototype === null) &&
		Object.keys(value).every((key) => keys.includes(key))
	);
}
export function identifier(value: unknown): value is string {
	return (
		typeof value === "string" &&
		/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(value)
	);
}
export function boundedText(value: unknown, max = 2000): value is string {
	return (
		typeof value === "string" &&
		value.length <= max &&
		!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)
	);
}
export function label(value: unknown): value is string {
	return boundedText(value, 160) && value.trim().length > 0;
}
export function isoInstant(value: unknown): value is string {
	return (
		typeof value === "string" &&
		/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
		Number.isFinite(Date.parse(value)) &&
		new Date(value).toISOString() === value
	);
}
export function calendarDate(value: unknown): value is string {
	return (
		typeof value === "string" &&
		/^\d{4}-\d{2}-\d{2}$/.test(value) &&
		Number.isFinite(Date.parse(`${value}T12:00:00Z`)) &&
		new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value
	);
}
export const LIMITS = {
	tasks: 1000,
	milestones: 300,
	sessionsPerVersion: 4096,
	sessionsAcrossHistory: 16384,
	imageCharacters: 1_400_000,
	allImageCharacters: 6_000_000,
	importBytes: 8_000_000,
} as const;
