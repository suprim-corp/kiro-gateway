export const HIDDEN_MODELS: Record<string, string> = {
	"claude-3.7-sonnet": "CLAUDE_3_7_SONNET_20250219_V1_0",
}

export const MODEL_ALIASES: Record<string, string> = {
	"auto-kiro": "auto",
}

export const FALLBACK_MODELS = [
	{ modelId: "auto" },
	{ modelId: "claude-sonnet-4" },
	{ modelId: "claude-sonnet-4.5" },
	{ modelId: "claude-sonnet-4.6" },
	{ modelId: "claude-opus-4" },
	{ modelId: "claude-opus-4.5" },
	{ modelId: "claude-opus-4.6" },
	{ modelId: "claude-haiku-4.5" },
	{ modelId: "claude-3.7-sonnet" },
	{ modelId: "deepseek-3.2" },
	{ modelId: "glm-5" },
	{ modelId: "minimax-m2.5" },
	{ modelId: "minimax-m2.1" },
	{ modelId: "qwen3-coder-next" },
]
