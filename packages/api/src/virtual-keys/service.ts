import { and, eq, isNull, sql } from "drizzle-orm"
import { db } from "../db"
import { virtualKeys } from "../db/schema"
import { getKeyCostSince } from "../logging"
import { logger } from "../logging/logger"

const KEY_PREFIX = "sk-"

export interface CreateKeyInput {
	name: string
	accountId?: string
	rateLimitPerMin?: number
	allowedModels?: string[]
	budgetPeriod?: string | null
	budgetTokens?: number | null
	budgetRequests?: number | null
	budgetCost?: number | null // cents
}

export interface UpdateKeyInput {
	name?: string
	enabled?: boolean
	accountId?: string | null
	rateLimitPerMin?: number
	allowedModels?: string[] | null
	budgetPeriod?: string | null
	budgetTokens?: number | null
	budgetRequests?: number | null
	budgetCost?: number | null // cents
}

export interface VirtualKeyRow {
	id: string
	name: string
	keyHash: string
	keyPrefix: string
	accountId: string | null
	enabled: boolean
	revokedAt: number | null
	rateLimitPerMin: number
	allowedModels: string | null
	budgetPeriod: string | null
	budgetTokens: number | null
	budgetRequests: number | null
	periodTokensUsed: number
	periodRequestsUsed: number
	periodResetAt: number | null
	totalRequests: number
	totalTokens: number
	lastUsedAt: number | null
	createdAt: number
}

// budgetPeriod stores "day" or "day|500" (period|costCents)
function encodeBudgetPeriod(period: string | null, costCents: number | null): string | null {
	if (!period) return null
	if (costCents != null) return `${period}|${costCents}`
	return period
}

function parseBudgetPeriod(raw: string | null): { period: string | null; costCents: number | null } {
	if (!raw) return { period: null, costCents: null }
	const idx = raw.indexOf("|")
	if (idx === -1) return { period: raw, costCents: null }
	return { period: raw.slice(0, idx), costCents: Number(raw.slice(idx + 1)) }
}

function generateKeyId(): string {
	return `vk_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`
}

function generateRawKey(): string {
	const random =
		crypto.randomUUID().replace(/-/g, "") +
		crypto.randomUUID().replace(/-/g, "")
	return `${KEY_PREFIX}${random.slice(0, 32)}`
}

async function hashKey(raw: string): Promise<string> {
	const data = new TextEncoder().encode(raw)
	const hash = await crypto.subtle.digest("SHA-256", data)
	return Array.from(new Uint8Array(hash))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("")
}

export async function createKey(
	input: CreateKeyInput,
): Promise<{ key: VirtualKeyRow; rawKey: string }> {
	const id = generateKeyId()
	const rawKey = generateRawKey()
	const keyHash = await hashKey(rawKey)
	const keyPrefix = rawKey.slice(0, KEY_PREFIX.length + 8)

	const row = {
		id,
		name: input.name,
		keyHash,
		keyPrefix,
		accountId: input.accountId ?? null,
		enabled: true,
		revokedAt: null,
		rateLimitPerMin: input.rateLimitPerMin ?? 60,
		allowedModels: input.allowedModels
			? JSON.stringify(input.allowedModels)
			: null,
		budgetPeriod: encodeBudgetPeriod(input.budgetPeriod ?? null, input.budgetCost ?? null),
		budgetTokens: input.budgetTokens ?? null,
		budgetRequests: input.budgetRequests ?? null,
		periodTokensUsed: 0,
		periodRequestsUsed: 0,
		periodResetAt: null,
		totalRequests: 0,
		totalTokens: 0,
		lastUsedAt: null,
		createdAt: Date.now(),
	}

	db.insert(virtualKeys).values(row).run()

	return { key: row, rawKey }
}

export function listKeys(opts?: { limit?: number; offset?: number }): { data: VirtualKeyRow[]; total: number } {
	const limit = opts?.limit ?? 20
	const offset = opts?.offset ?? 0
	const total = (db.select({ count: sql<number>`count(*)` }).from(virtualKeys).get() as { count: number })?.count ?? 0
	const data = db.select().from(virtualKeys).limit(limit).offset(offset).all() as VirtualKeyRow[]
	return { data, total }
}

export function countActiveKeys(): number {
	const result = db.select({ count: sql<number>`count(*)` }).from(virtualKeys).where(and(eq(virtualKeys.enabled, true), isNull(virtualKeys.revokedAt))).get() as { count: number } | undefined
	return result?.count ?? 0
}

export function getKeyById(id: string): VirtualKeyRow | undefined {
	return db.select().from(virtualKeys).where(eq(virtualKeys.id, id)).get() as
		| VirtualKeyRow
		| undefined
}

export async function getKeyByRawKey(
	rawKey: string,
): Promise<VirtualKeyRow | undefined> {
	const keyHash = await hashKey(rawKey)
	return db
		.select()
		.from(virtualKeys)
		.where(eq(virtualKeys.keyHash, keyHash))
		.get() as VirtualKeyRow | undefined
}

export function updateKey(
	id: string,
	input: UpdateKeyInput,
): VirtualKeyRow | undefined {
	const updates: Record<string, unknown> = {}
	if (input.name !== undefined) updates.name = input.name
	if (input.enabled !== undefined) updates.enabled = input.enabled
	if (input.accountId !== undefined) updates.accountId = input.accountId
	if (input.rateLimitPerMin !== undefined)
		updates.rateLimitPerMin = input.rateLimitPerMin
	if (input.allowedModels !== undefined) {
		updates.allowedModels = input.allowedModels
			? JSON.stringify(input.allowedModels)
			: null
	}
	if (input.budgetTokens !== undefined)
		updates.budgetTokens = input.budgetTokens
	if (input.budgetRequests !== undefined)
		updates.budgetRequests = input.budgetRequests
	if (input.budgetPeriod !== undefined || input.budgetCost !== undefined) {
		const existing = getKeyById(id)
		const { period: oldPeriod, costCents: oldCost } = parseBudgetPeriod(existing?.budgetPeriod ?? null)
		const newPeriod = input.budgetPeriod !== undefined ? input.budgetPeriod : oldPeriod
		const newCost = input.budgetCost !== undefined ? input.budgetCost : oldCost
		updates.budgetPeriod = encodeBudgetPeriod(newPeriod, newCost)
		if (input.budgetPeriod !== undefined) {
			updates.periodTokensUsed = 0
			updates.periodRequestsUsed = 0
			updates.periodResetAt = newPeriod ? getNextPeriodReset(newPeriod) : null
		}
	}

	if (Object.keys(updates).length === 0) return getKeyById(id)

	db.update(virtualKeys).set(updates).where(eq(virtualKeys.id, id)).run()
	return getKeyById(id)
}


export function revokeKey(id: string): boolean {
	const key = getKeyById(id)
	if (!key || key.revokedAt) return false
	db.update(virtualKeys).set({ revokedAt: Date.now(), enabled: false }).where(eq(virtualKeys.id, id)).run()
	return true
}

export function recordUsage(id: string, tokens: number): void {
	db.update(virtualKeys)
		.set({
			totalRequests: sql`${virtualKeys.totalRequests} + 1`,
			totalTokens: sql`${virtualKeys.totalTokens} + ${tokens}`,
			periodRequestsUsed: sql`${virtualKeys.periodRequestsUsed} + 1`,
			periodTokensUsed: sql`${virtualKeys.periodTokensUsed} + ${tokens}`,
			lastUsedAt: Date.now(),
		})
		.where(eq(virtualKeys.id, id))
		.run()
}

function getNextPeriodReset(period: string): number {
	const now = new Date()
	switch (period) {
		case "hour":
			return new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1).getTime()
		case "day":
			return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime()
		case "week": {
			const day = now.getDay()
			const diff = now.getDate() - day + (day === 0 ? -6 : 1) + 7
			return new Date(now.getFullYear(), now.getMonth(), diff).getTime()
		}
		case "month":
			return new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime()
		default:
			return 0
	}
}

function getPeriodStart(period: string): number {
	const now = new Date()
	switch (period) {
		case "hour":
			return new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours()).getTime()
		case "day":
			return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
		case "week": {
			const day = now.getDay()
			const diff = now.getDate() - day + (day === 0 ? -6 : 1)
			return new Date(now.getFullYear(), now.getMonth(), diff).getTime()
		}
		case "month":
			return new Date(now.getFullYear(), now.getMonth(), 1).getTime()
		default:
			return 0
	}
}

function resetPeriodIfNeeded(key: VirtualKeyRow): VirtualKeyRow {
	const { period } = parseBudgetPeriod(key.budgetPeriod)
	if (!period) return key
	const now = Date.now()
	if (!key.periodResetAt || now >= key.periodResetAt) {
		const nextReset = getNextPeriodReset(period)
		db.update(virtualKeys)
			.set({ periodTokensUsed: 0, periodRequestsUsed: 0, periodResetAt: nextReset })
			.where(eq(virtualKeys.id, key.id))
			.run()
		return { ...key, periodTokensUsed: 0, periodRequestsUsed: 0, periodResetAt: nextReset }
	}
	return key
}

export interface BudgetUsage {
	tokens: number
	requests: number
	cost: number // cents
}

export function getBudgetUsage(keyId: string, rawBudgetPeriod: string): BudgetUsage {
	const key = getKeyById(keyId)
	if (!key) return { tokens: 0, requests: 0, cost: 0 }
	const fresh = resetPeriodIfNeeded(key)
	const { period } = parseBudgetPeriod(rawBudgetPeriod)
	if (!period) return { tokens: 0, requests: 0, cost: 0 }
	const periodStart = getPeriodStart(period)
	const costUsd = getKeyCostSince(keyId, periodStart)
	const costCents = Math.round(costUsd * 100)
	return { tokens: fresh.periodTokensUsed, requests: fresh.periodRequestsUsed, cost: costCents }
}

export function checkBudget(key: VirtualKeyRow): { allowed: boolean; reason?: string } {
	const { period, costCents: costLimit } = parseBudgetPeriod(key.budgetPeriod)
	if (!period) return { allowed: true }
	const fresh = resetPeriodIfNeeded(key)

	if (fresh.budgetTokens != null && fresh.periodTokensUsed >= fresh.budgetTokens) {
		return { allowed: false, reason: `Token budget exceeded (${fresh.periodTokensUsed}/${fresh.budgetTokens} per ${period})` }
	}
	if (fresh.budgetRequests != null && fresh.periodRequestsUsed >= fresh.budgetRequests) {
		return { allowed: false, reason: `Request budget exceeded (${fresh.periodRequestsUsed}/${fresh.budgetRequests} per ${period})` }
	}
	if (costLimit != null) {
		try {
			const periodStart = getPeriodStart(period)
			const costUsd = getKeyCostSince(fresh.id, periodStart)
			const currentCents = Math.round(costUsd * 100)
			logger.debug(`[budget] key=${fresh.id} cost=${currentCents}c limit=${costLimit}c period=${period}`)
			if (currentCents >= costLimit) {
				return { allowed: false, reason: `Cost budget exceeded ($${(currentCents / 100).toFixed(2)}/$${(costLimit / 100).toFixed(2)} per ${period})` }
			}
		} catch (e) {
			logger.error(`[budget] cost check failed for key=${fresh.id}`, e)
		}
	}
	return { allowed: true }
}

export { parseBudgetPeriod }
