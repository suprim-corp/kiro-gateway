import type { KiroImageBlock, OpenAIMessage } from "./types"

export function extractTextContent(content: OpenAIMessage["content"]): string {
	if (content === null) return ""
	if (typeof content === "string") return content
	if (Array.isArray(content)) {
		return content
			.filter((b) => b.type === "text" && b.text)
			.map((b) => b.text as string)
			.join("")
	}
	return ""
}

export function extractImages(content: OpenAIMessage["content"]): KiroImageBlock[] | undefined {
	if (!Array.isArray(content)) return undefined
	const images: KiroImageBlock[] = []
	for (const block of content) {
		if (block.type === "image_url" && block.image_url?.url) {
			const url = block.image_url.url
			const match = url.match(/^data:image\/([^;]+);base64,(.+)$/)
			if (match) {
				const format = match[1] === "jpg" ? "jpeg" : match[1]
				images.push({ format, source: { bytes: match[2] } })
			}
		}
	}
	return images.length ? images : undefined
}
