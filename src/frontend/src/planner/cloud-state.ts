/** Ignore stale asynchronous work after an account switch or component teardown. */
export class CloudEpoch {
	private value = 0;
	next() {
		this.value++;
		return this.value;
	}
	current() {
		return this.value;
	}
	matches(value: number) {
		return this.value === value;
	}
}
export function mayReplaceAfterSave(
	submitted: unknown,
	current: unknown,
): boolean {
	return submitted === current;
}
