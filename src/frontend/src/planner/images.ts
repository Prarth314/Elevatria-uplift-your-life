export interface ImageHeader {
	mime: "image/png" | "image/jpeg" | "image/webp";
	width: number;
	height: number;
}
/** Read dimensions before decoding compressed pixels, including JPEG headers after EXIF. */
export function imageHeader(bytes: Uint8Array): ImageHeader | null {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const ascii = (offset: number, length: number) =>
		String.fromCharCode(...bytes.subarray(offset, offset + length));
	if (
		bytes.length >= 24 &&
		bytes[0] === 137 &&
		ascii(1, 3) === "PNG" &&
		bytes[4] === 13 &&
		bytes[5] === 10 &&
		bytes[6] === 26 &&
		bytes[7] === 10 &&
		ascii(12, 4) === "IHDR"
	)
		return {
			mime: "image/png",
			width: view.getUint32(16),
			height: view.getUint32(20),
		};
	if (bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216) {
		let p = 2;
		while (p + 3 < bytes.length) {
			if (bytes[p++] !== 255) return null;
			while (p < bytes.length && bytes[p] === 255) p++;
			const marker = bytes[p++];
			if (marker === 217 || marker === 218) return null;
			if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
			if (p + 2 > bytes.length) return null;
			const length = view.getUint16(p);
			if (length < 2 || p + length > bytes.length) return null;
			if (
				[
					192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207,
				].includes(marker)
			)
				return length >= 8
					? {
							mime: "image/jpeg",
							width: view.getUint16(p + 5),
							height: view.getUint16(p + 3),
						}
					: null;
			p += length;
		}
	}
	if (bytes.length >= 30 && ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") {
		const uint24 = (p: number) =>
			bytes[p] | (bytes[p + 1] << 8) | (bytes[p + 2] << 16);
		if (ascii(12, 4) === "VP8X")
			return {
				mime: "image/webp",
				width: uint24(24) + 1,
				height: uint24(27) + 1,
			};
		if (ascii(12, 4) === "VP8L" && bytes[20] === 47)
			return {
				mime: "image/webp",
				width: (bytes[21] | ((bytes[22] & 63) << 8)) + 1,
				height:
					((bytes[22] >> 6) | (bytes[23] << 2) | ((bytes[24] & 15) << 10)) + 1,
			};
		if (
			ascii(12, 4) === "VP8 " &&
			bytes[23] === 157 &&
			bytes[24] === 1 &&
			bytes[25] === 42
		)
			return {
				mime: "image/webp",
				width: view.getUint16(26, true) & 16383,
				height: view.getUint16(28, true) & 16383,
			};
	}
	return null;
}
export function safeDimensions(
	header: ImageHeader | null,
): header is ImageHeader {
	return (
		!!header &&
		header.width > 0 &&
		header.height > 0 &&
		header.width <= 4096 &&
		header.height <= 4096 &&
		header.width * header.height <= 12_000_000
	);
}
const checked = new Map<string, boolean>();
export function clearImageCache() {
	checked.clear();
}
export function safeImage(value: unknown): value is string {
	if (value === "") return true;
	if (typeof value !== "string" || value.length > 1_400_000) return false;
	const cached = checked.get(value);
	if (cached !== undefined) return cached;
	let valid = false;
	const match =
		/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(
			value,
		);
	if (match && match[2].length % 4 === 0)
		try {
			const raw = atob(match[2]);
			const bytes = Uint8Array.from(raw, (c) => c.charCodeAt(0));
			const header = imageHeader(bytes);
			valid = safeDimensions(header) && header.mime === match[1];
		} catch {
			valid = false;
		}
	// Bound cached image references so imported files cannot grow a global cache forever.
	if (checked.size >= 4) checked.delete(checked.keys().next().value!);
	checked.set(value, valid);
	return valid;
}
/** Strip metadata and animation by exporting a bounded static canvas image. */
export async function prepareImage(file: File): Promise<string> {
	if (file.size > 1_000_000) throw Error("Choose an image under 1 MB.");
	const bytes = new Uint8Array(await file.arrayBuffer());
	const header = imageHeader(bytes);
	if (!safeDimensions(header) || header.mime !== file.type)
		throw Error(
			"Use a valid PNG, JPEG, or WebP, up to 4096 pixels per side and 12 megapixels.",
		);
	const bitmap = await createImageBitmap(file);
	try {
		if (
			!safeDimensions({ ...header, width: bitmap.width, height: bitmap.height })
		)
			throw Error("Decoded image dimensions exceed the limit.");
		const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
		const canvas = document.createElement("canvas");
		canvas.width = Math.max(1, Math.round(bitmap.width * scale));
		canvas.height = Math.max(1, Math.round(bitmap.height * scale));
		const context = canvas.getContext("2d");
		if (!context) throw Error("Image processing is unavailable.");
		context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
		const image = canvas.toDataURL("image/webp", 0.85);
		if (!safeImage(image))
			throw Error("Processed image is too large. Choose a smaller image.");
		return image;
	} finally {
		bitmap.close();
	}
}

export async function normalizeImageData(value: string): Promise<string> {
	if (!safeImage(value) || !value)
		throw Error("The embedded image is invalid.");
	const [prefix, encoded] = value.split(",");
	const mime = prefix.slice(5, prefix.indexOf(";"));
	const bytes = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
	return prepareImage(new File([bytes], "inspiration", { type: mime }));
}
