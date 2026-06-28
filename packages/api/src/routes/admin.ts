import { Elysia } from "elysia"
import { createSession, validateSession } from "../auth/token"
import { env } from "../config"
import { logger } from "../logging/logger"
import { getModelUsage, getStats, getTimeSeries, getTopKeys, getKeyCostSince, queryLogs } from "../logging"
import {
	countActiveKeys,
	createKey,
	getBudgetUsage,
	getKeyById,
	listKeys,
	parseBudgetPeriod,
	revokeKey,
	updateKey,
} from "../virtual-keys"
import { getAuth } from "./shared"

const loginRoute = new Elysia({ prefix: "/admin" }).post(
	"/login",
	({ body, set }) => {
		const { password } = body as { password?: string }
		if (!password || password !== env.ADMIN_API_KEY) {
			set.status = 401
			return { error: "Invalid password" }
		}
		const token = createSession()
		return { token }
	},
)

const protectedRoutes = new Elysia({ prefix: "/admin" })
	.onBeforeHandle(({ headers, set }) => {
		const auth = headers.authorization?.replace("Bearer ", "")
		if (!auth) {
			set.status = 401
			return { error: "Unauthorized" }
		}
		if (auth === env.ADMIN_API_KEY) return
		if (!validateSession(auth)) {
			set.status = 401
			return { error: "Unauthorized" }
		}
	})
	.get("/stats", () => {
		const stats = getStats()
		const activeKeys = countActiveKeys()

		return {
			...stats,
			activeAccounts: 1,
			activeKeys,
			uptimeSeconds: Math.floor(process.uptime()),
		}
	})
	.get("/logs", ({ query }) => {
		const limit = query.limit ? Number(query.limit) : 50
		const offset = query.offset ? Number(query.offset) : 0
		return queryLogs({
			limit,
			offset,
			virtualKeyId: query.virtualKeyId ?? undefined,
			model: query.model ?? undefined,
			status: query.status ? Number(query.status) : undefined,
		})
	})
	.get("/keys", ({ query }) => {
		const limit = query.limit ? Number(query.limit) : 20
		const offset = query.offset ? Number(query.offset) : 0
		const { data: keys, total } = listKeys({ limit, offset })
		const now = Date.now()
		return {
			data: keys.map((k) => {
				const { period, costCents } = parseBudgetPeriod(k.budgetPeriod)
				return {
					id: k.id,
					name: k.name,
					keyPrefix: k.keyPrefix,
					accountId: k.accountId,
					enabled: k.enabled,
					revokedAt: k.revokedAt,
					rateLimitPerMin: k.rateLimitPerMin,
					allowedModels: k.allowedModels
						? JSON.parse(k.allowedModels)
						: null,
					budgetPeriod: period,
					budgetTokens: k.budgetTokens,
					budgetRequests: k.budgetRequests,
					budgetCost: costCents,
					usage: {
						hour: getKeyCostSince(k.id, now - 3600_000),
						day: getKeyCostSince(k.id, now - 86400_000),
						week: getKeyCostSince(k.id, now - 604800_000),
						month: getKeyCostSince(k.id, now - 2592000_000),
					},
					totalRequests: k.totalRequests,
					totalTokens: k.totalTokens,
					lastUsedAt: k.lastUsedAt,
					createdAt: k.createdAt,
				}
			}),
			total,
		}
	})
	.post("/keys", async ({ body, set }) => {
		const input = body as {
			name?: string
			accountId?: string
			rateLimitPerMin?: number
			allowedModels?: string[]
			budgetPeriod?: string | null
			budgetTokens?: number | null
			budgetRequests?: number | null
			budgetCost?: number | null
		}

		if (!input.name) {
			set.status = 400
			return { error: "name is required" }
		}

		const { key, rawKey } = await createKey({
			name: input.name,
			accountId: input.accountId,
			rateLimitPerMin: input.rateLimitPerMin,
			allowedModels: input.allowedModels,
			budgetPeriod: input.budgetPeriod,
			budgetTokens: input.budgetTokens,
			budgetRequests: input.budgetRequests,
			budgetCost: input.budgetCost,
		})

		const { period, costCents } = parseBudgetPeriod(key.budgetPeriod)
		set.status = 201
		return {
			id: key.id,
			name: key.name,
			key: rawKey,
			keyPrefix: key.keyPrefix,
			enabled: key.enabled,
			rateLimitPerMin: key.rateLimitPerMin,
			allowedModels: key.allowedModels
				? JSON.parse(key.allowedModels)
				: null,
			budgetPeriod: period,
			budgetTokens: key.budgetTokens,
			budgetRequests: key.budgetRequests,
			budgetCost: costCents,
			createdAt: key.createdAt,
		}
	})
	.patch("/keys/:id", ({ params, body, set }) => {
		const existing = getKeyById(params.id)
		if (!existing) {
			set.status = 404
			return { error: "Key not found" }
		}
		if (existing.revokedAt) {
			set.status = 403
			return { error: "Key is revoked" }
		}

		const input = body as {
			name?: string
			enabled?: boolean
			accountId?: string | null
			rateLimitPerMin?: number
			allowedModels?: string[] | null
			budgetPeriod?: string | null
			budgetTokens?: number | null
			budgetRequests?: number | null
			budgetCost?: number | null
		}

		const updated = updateKey(params.id, input)
		if (!updated) {
			set.status = 500
			return { error: "Update failed" }
		}

		const { period, costCents } = parseBudgetPeriod(updated.budgetPeriod)
		return {
			id: updated.id,
			name: updated.name,
			keyPrefix: updated.keyPrefix,
			enabled: updated.enabled,
			rateLimitPerMin: updated.rateLimitPerMin,
			allowedModels: updated.allowedModels
				? JSON.parse(updated.allowedModels)
				: null,
			budgetPeriod: period,
			budgetTokens: updated.budgetTokens,
			budgetRequests: updated.budgetRequests,
			budgetCost: costCents,
			totalRequests: updated.totalRequests,
			totalTokens: updated.totalTokens,
			lastUsedAt: updated.lastUsedAt,
			createdAt: updated.createdAt,
		}
	})
	.post("/keys/:id/revoke", ({ params, set }) => {
		const revoked = revokeKey(params.id)
		if (!revoked) {
			set.status = 404
			return { error: "Key not found or already revoked" }
		}
		return { success: true }
	})
	.get("/stats/timeseries", ({ query }) => {
		const hours = query.hours ? Number(query.hours) : 24
		return { data: getTimeSeries(hours) }
	})
	.get("/stats/models", () => {
		return { data: getModelUsage() }
	})
	.get("/stats/top-keys", () => {
		return { data: getTopKeys() }
	})
	.get("/accounts", () => ({ data: [] }))
	.get("/keys/:id/budget", ({ params, set }) => {
		const key = getKeyById(params.id)
		if (!key) {
			set.status = 404
			return { error: "Key not found" }
		}
		const { period, costCents } = parseBudgetPeriod(key.budgetPeriod)
		if (!period) {
			return { budgetPeriod: null, tokens: { used: 0, limit: null }, requests: { used: 0, limit: null }, cost: { used: 0, limit: null } }
		}
		const usage = getBudgetUsage(key.id, key.budgetPeriod!)
		return {
			budgetPeriod: period,
			tokens: { used: usage.tokens, limit: key.budgetTokens },
			requests: { used: usage.requests, limit: key.budgetRequests },
			cost: { used: usage.cost, limit: costCents },
		}
	})
	.post("/auth/device-start", async ({ set }) => {
		const auth = getAuth()
		const region = auth.region
		const url = `https://oidc.${region}.amazonaws.com/client/register`

		// Register a new device client (or reuse existing)
		const regRes = await fetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				clientName: "Kiro Gateway",
				clientType: "public",
				scopes: [
					"codewhisperer:completions",
					"codewhisperer:analysis",
					"codewhisperer:conversations",
					"codewhisperer:transformations",
					"codewhisperer:taskassist",
				],
			}),
		})

		if (!regRes.ok) {
			const text = await regRes.text()
			logger.error(`[DeviceAuth] Client registration failed: ${regRes.status} ${text}`)
			set.status = 502
			return { error: "Client registration failed", detail: text }
		}

		const reg = await regRes.json() as { clientId: string; clientSecret: string; clientSecretExpiresAt: number }

		// Start device authorization
		const authUrl = `https://oidc.${region}.amazonaws.com/device_authorization`
		const authRes = await fetch(authUrl, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				clientId: reg.clientId,
				clientSecret: reg.clientSecret,
				startUrl: "https://d-9067d218fd.awsapps.com/start/",
			}),
		})

		if (!authRes.ok) {
			const text = await authRes.text()
			logger.error(`[DeviceAuth] Device authorization failed: ${authRes.status} ${text}`)
			set.status = 502
			return { error: "Device authorization failed", detail: text }
		}

		const device = await authRes.json() as {
			deviceCode: string
			userCode: string
			verificationUri: string
			verificationUriComplete: string
			expiresIn: number
			interval: number
		}

		logger.info(`[DeviceAuth] Started — open ${device.verificationUriComplete}`)

		return {
			deviceCode: device.deviceCode,
			userCode: device.userCode,
			verificationUri: device.verificationUri,
			verificationUriComplete: device.verificationUriComplete,
			expiresIn: device.expiresIn,
			interval: device.interval,
			clientId: reg.clientId,
			clientSecret: reg.clientSecret,
		}
	})
	.post("/auth/device-complete", async ({ body, set }) => {
		const { deviceCode, clientId, clientSecret } = body as {
			deviceCode: string
			clientId: string
			clientSecret: string
		}

		if (!deviceCode || !clientId || !clientSecret) {
			set.status = 400
			return { error: "deviceCode, clientId, clientSecret required" }
		}

		const auth = getAuth()
		const region = auth.region
		const tokenUrl = `https://oidc.${region}.amazonaws.com/token`

		const res = await fetch(tokenUrl, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				clientId,
				clientSecret,
				grantType: "urn:ietf:params:oauth:grant-type:device_code",
				deviceCode,
			}),
		})

		if (!res.ok) {
			const data = await res.json().catch(() => ({})) as { error?: string }
			if (data.error === "authorization_pending") {
				set.status = 202
				return { status: "pending", message: "Waiting for user to approve" }
			}
			if (data.error === "slow_down") {
				set.status = 202
				return { status: "slow_down", message: "Poll slower" }
			}
			const text = JSON.stringify(data)
			logger.error(`[DeviceAuth] Token exchange failed: ${res.status} ${text}`)
			set.status = 400
			return { error: "Token exchange failed", detail: text }
		}

		const token = await res.json() as {
			accessToken: string
			refreshToken: string
			expiresIn: number
		}

		const expiresAt = new Date(Date.now() + token.expiresIn * 1000).toISOString()

		// Save to credential file
		const { writeFileSync } = await import("node:fs")
		const { resolve } = await import("node:path")
		const credsPath = resolve(env.KIRO_CREDS_FILE?.replace(/^~/, process.env.HOME ?? "~") ?? "/app/creds/kiro-auth-token.json")

		const creds = {
			accessToken: token.accessToken,
			refreshToken: token.refreshToken,
			expiresAt,
			clientIdHash: Buffer.from(clientId).toString("hex").slice(0, 40),
			authMethod: "IdC",
			provider: "Enterprise",
			region,
		}
		writeFileSync(credsPath, JSON.stringify(creds, null, 2))

		// Also save device registration
		const regPath = resolve(credsPath, "..", `${creds.clientIdHash}.json`)
		writeFileSync(regPath, JSON.stringify({ clientId, clientSecret, expiresAt: new Date(Date.now() + 7776000000).toISOString() }, null, 2))

		logger.info(`[DeviceAuth] Complete — token saved to ${credsPath}, expires ${expiresAt}`)

		// Force auth manager to reload
		await auth.forceRefresh()

		return { success: true, expiresAt }
	})

export const adminRoutes = new Elysia().use(loginRoute).use(protectedRoutes)
