import { Sidebar } from "@/components/sidebar"

export default function DashboardLayout({
	children,
}: {
	children: React.ReactNode
}) {
	return (
		<>
			<Sidebar />
			<main className="flex-1 ml-56 p-6">{children}</main>
		</>
	)
}
