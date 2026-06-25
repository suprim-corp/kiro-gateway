const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"

export function getToken(): string | null {
	if (typeof document === "undefined") return null
	const match = document.cookie.match(/(?:^|; )session=([^;]*)/)
	return match ? match[1] : null
}

export function clearToken(): void {
	document.cookie = "session=; path=/; max-age=0"
}

export async function apiFetch<T>(
	path: string,
	options?: RequestInit,
): Promise<T> {
	const token = getToken()
	const res = await fetch(`${API_BASE}${path}`, {
		...options,
		headers: {
			"Content-Type": "application/json",
			...(token ? { Authorization: `Bearer ${token}` } : {}),
			...options?.headers,
		},
	})
	if (!res.ok) {
		if (
			res.status === 401 &&
			typeof window !== "undefined" &&
			!path.includes("/login")
		) {
			clearToken()
			window.location.href = "/login"
		}
		const err = await res.json().catch(() => ({ error: res.statusText }))
		throw new Error((err as { error?: string }).error ?? res.statusText)
	}
	return res.json() as Promise<T>
}

export function apiUrl(path: string): string {
	return `${API_BASE}${path}`
}
