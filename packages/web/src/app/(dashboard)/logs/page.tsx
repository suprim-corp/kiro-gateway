"use client"

import { useState } from "react"
import { Spinner } from "@phosphor-icons/react"
import { AuthGuard } from "@/components/auth-guard"
import { Card } from "@/components/ui/card"
import {
	Pagination,
	PaginationContent,
	PaginationEllipsis,
	PaginationItem,
	PaginationLink,
	PaginationNext,
	PaginationPrevious,
} from "@/components/ui/pagination"
import { useLogs } from "@/hooks/use-admin"

const PAGE_SIZE = 50

function StatusBadge({ status }: { status: number }) {
	const color =
		status < 300
			? "text-neon-green"
			: status < 500
				? "text-neon-yellow"
				: "text-destructive"
	return (
		<span className={`font-mono text-[10px] font-medium ${color}`}>
			{status}
		</span>
	)
}

function formatTimestamp(ts: number): string {
	const d = new Date(ts)
	const year = d.getFullYear()
	const month = String(d.getMonth() + 1).padStart(2, "0")
	const day = String(d.getDate()).padStart(2, "0")
	const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZoneName: "short" })
	return `${year}-${month}-${day} ${time}`
}

function LogsContent() {
	const [page, setPage] = useState(1)
	const { data, isLoading } = useLogs(page, PAGE_SIZE)
	const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<h1 className="font-mono text-lg font-semibold tracking-tight">
					Logs
				</h1>
				{data && (
					<span className="font-mono text-[10px] text-muted-foreground">
						{data.total} total
					</span>
				)}
			</div>

			<Card className="overflow-hidden">
				<div className="max-h-[calc(100vh-220px)] overflow-auto">
					<table className="w-full text-xs">
						<thead className="sticky top-0 bg-card z-10">
						<tr className="border-b border-border/40">
							<th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground font-normal">
								Status
							</th>
							<th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground font-normal">
								Model
							</th>
							<th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground font-normal">
								In
							</th>
							<th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground font-normal">
								Out
							</th>
							<th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground font-normal">
								Cost
							</th>
							<th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground font-normal">
								Latency
							</th>
							<th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground font-normal">
								Stream
							</th>
							<th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground font-normal">
								Key
							</th>
							<th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground font-normal">
								IP
							</th>
							<th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground font-normal">
								Time
							</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-border/20">
						{isLoading && (
							<tr>
								<td
									colSpan={10}
									className="px-4 py-8 text-center font-mono text-xs text-muted-foreground"
								>
									<div className="flex items-center justify-center gap-2">
										<Spinner className="size-3 animate-spin" />
										Loading...
									</div>
								</td>
							</tr>
						)}
						{data?.data.length === 0 && (
							<tr>
								<td
									colSpan={10}
									className="px-4 py-8 text-center font-mono text-xs text-muted-foreground"
								>
									No requests yet
								</td>
							</tr>
						)}
						{data?.data.map((log) => (
							<tr
								key={log.id}
								className="transition-colors hover:bg-muted/5"
							>
								<td className="px-4 py-2.5">
									<StatusBadge status={log.status} />
								</td>
								<td className="px-4 py-2.5 font-mono text-[10px]">
									{log.model}
								</td>
								<td className="px-4 py-2.5 font-mono text-[10px] text-muted-foreground">
									{log.promptTokens?.toLocaleString() ?? "—"}
								</td>
								<td className="px-4 py-2.5 font-mono text-[10px] text-muted-foreground">
									{log.completionTokens?.toLocaleString() ?? "—"}
								</td>
								<td className="px-4 py-2.5 font-mono text-[10px] text-neon-yellow">
									{log.cost != null ? `$${log.cost.toFixed(4)}` : "—"}
								</td>
								<td className="px-4 py-2.5 font-mono text-[10px] text-muted-foreground">
									{log.latencyMs ? `${log.latencyMs.toLocaleString()}ms` : "—"}
								</td>
								<td className="px-4 py-2.5 font-mono text-[10px]">
									<span
										className={
											log.streaming
												? "text-neon-cyan"
												: "text-muted-foreground"
										}
									>
										{log.streaming ? "SSE" : "sync"}
									</span>
								</td>
								<td className="px-4 py-2.5 font-mono text-[10px] text-muted-foreground">
									{log.virtualKeyName ?? "—"}
								</td>
								<td className="px-4 py-2.5 font-mono text-[10px] text-muted-foreground">
									{log.clientIp ?? "—"}
								</td>
								<td className="px-4 py-2.5 font-mono text-[10px] text-muted-foreground">
									{formatTimestamp(log.createdAt)}
								</td>
							</tr>
						))}
					</tbody>
				</table>
				</div>
			</Card>

			{totalPages > 1 && (
				<Pagination>
					<PaginationContent>
						<PaginationItem>
							<PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); setPage((p) => Math.max(1, p - 1)) }} className="cursor-pointer" />
						</PaginationItem>
						{Array.from({ length: totalPages }, (_, i) => i + 1)
							.filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
							.map((p, idx, arr) => (
								<span key={p} className="flex items-center">
									{idx > 0 && arr[idx - 1] !== p - 1 && (
										<PaginationItem><PaginationEllipsis /></PaginationItem>
									)}
									<PaginationItem>
										<PaginationLink href="#" isActive={p === page} onClick={(e) => { e.preventDefault(); setPage(p) }} className="cursor-pointer">
											{p}
										</PaginationLink>
									</PaginationItem>
								</span>
							))}
						<PaginationItem>
							<PaginationNext href="#" onClick={(e) => { e.preventDefault(); setPage((p) => Math.min(totalPages, p + 1)) }} className="cursor-pointer" />
						</PaginationItem>
					</PaginationContent>
				</Pagination>
			)}
		</div>
	)
}

export default function LogsPage() {
	return (
		<AuthGuard>
			<LogsContent />
		</AuthGuard>
	)
}
