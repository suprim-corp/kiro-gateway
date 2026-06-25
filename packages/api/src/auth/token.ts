const sessions = new Set<string>()

export function createSession(): string {
	const token = crypto.randomUUID()
	sessions.add(token)
	return token
}

export function validateSession(token: string): boolean {
	return sessions.has(token)
}

export function revokeSession(token: string): void {
	sessions.delete(token)
}
