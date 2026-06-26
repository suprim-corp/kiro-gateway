export interface OpenAIMessage {
	role: "system" | "user" | "assistant" | "tool"
	content:
		| string
		| null
		| Array<{ type: string; text?: string; image_url?: { url: string } }>
	name?: string
	tool_calls?: Array<{
		id: string
		type: "function"
		function: { name: string; arguments: string }
	}>
	tool_call_id?: string
}

export interface OpenAITool {
	type?: "function"
	function?: {
		name: string
		description?: string
		parameters?: Record<string, unknown>
	}
	name?: string
	description?: string
	input_schema?: Record<string, unknown>
}

export interface ChatCompletionRequest {
	model: string
	messages: OpenAIMessage[]
	stream?: boolean
	temperature?: number
	top_p?: number
	max_tokens?: number
	max_completion_tokens?: number
	stop?: string | string[]
	tools?: OpenAITool[]
	tool_choice?: string | Record<string, unknown>
	reasoning_effort?: string
}

export interface KiroImageBlock {
	format: string
	source: { bytes: string }
}

export interface KiroToolSpec {
	toolSpecification: {
		name: string
		description: string
		inputSchema: { json: Record<string, unknown> }
	}
}

export interface KiroUserInputMessage {
	content: string
	modelId: string
	origin: string
	images?: KiroImageBlock[]
	userInputMessageContext?: {
		tools?: KiroToolSpec[]
		toolResults?: Array<{
			content: Array<{ text: string }>
			status: string
			toolUseId: string
		}>
	}
}

export interface KiroHistoryUserMessage {
	content: string
	modelId: string
	origin: string
	images?: KiroImageBlock[]
	userInputMessageContext?: {
		toolResults?: Array<{
			content: Array<{ text: string }>
			status: string
			toolUseId: string
		}>
	}
}

export interface KiroHistoryEntry {
	userInputMessage?: KiroHistoryUserMessage
	assistantResponseMessage?: {
		content: string
		toolUses?: Array<{ toolUseId: string; name: string; input: unknown }>
	}
}

export interface KiroPayload {
	conversationState: {
		chatTriggerType: string
		conversationId: string
		currentMessage: {
			userInputMessage: KiroUserInputMessage
		}
		history?: KiroHistoryEntry[]
	}
	profileArn?: string
}
