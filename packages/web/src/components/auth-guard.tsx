"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { getToken } from "@/lib/api"

export function AuthGuard({ children }: { children: React.ReactNode }) {
	const router = useRouter()
	const [ok, setOk] = useState(false)

	useEffect(() => {
		if (!getToken()) {
			router.replace("/login")
		} else {
			setOk(true)
		}
	}, [router])

	if (!ok) return null
	return <>{children}</>
}
