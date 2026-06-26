import type { KiroToolSpec, OpenAITool } from "./types"

export function prefixToolName(name: string): string {
	return name
}

export function unprefixToolName(name: string): string {
	return name
}

export function convertTools(tools: OpenAITool[]): KiroToolSpec[] {
	return tools
		.map((tool): KiroToolSpec | null => {
			if (tool.type === "function" && tool.function) {
				return {
					toolSpecification: {
						name: prefixToolName(tool.function.name),
						description: tool.function.description || `Tool: ${tool.function.name}`,
						inputSchema: {
							json: sanitizeJsonSchema(
								tool.function.parameters ?? {
									type: "object",
									properties: {},
								},
							),
						},
					},
				}
			}
			if (tool.name) {
				return {
					toolSpecification: {
						name: prefixToolName(tool.name),
						description: tool.description || `Tool: ${tool.name}`,
						inputSchema: {
							json: sanitizeJsonSchema(
								tool.input_schema ?? (tool as any).parameters ?? {
									type: "object",
									properties: {},
								},
							),
						},
					},
				}
			}
			return null
		})
		.filter((t): t is KiroToolSpec => t !== null)
}

// Kiro API rejects empty required arrays and additionalProperties
function sanitizeJsonSchema(schema: Record<string, unknown>): Record<string, unknown> {
	const result: Record<string, unknown> = {}
	
	for (const [key, value] of Object.entries(schema)) {
		if (key === "required" && Array.isArray(value) && value.length === 0) continue
		if (key === "additionalProperties") continue
		
		if (key === "properties" && typeof value === "object" && value !== null) {
			const props: Record<string, unknown> = {}
			for (const [pName, pValue] of Object.entries(value as Record<string, unknown>)) {
				props[pName] = typeof pValue === "object" && pValue !== null
					? sanitizeJsonSchema(pValue as Record<string, unknown>)
					: pValue
			}
			result[key] = props
		} else if (Array.isArray(value)) {
			result[key] = value.map((item) =>
				typeof item === "object" && item !== null
					? sanitizeJsonSchema(item as Record<string, unknown>)
					: item,
			)
		} else if (typeof value === "object" && value !== null) {
			result[key] = sanitizeJsonSchema(value as Record<string, unknown>)
		} else {
			result[key] = value
		}
	}
	
	return result
}
