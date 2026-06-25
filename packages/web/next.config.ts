import type { NextConfig } from "next"

const nextConfig: NextConfig = {
	images: {
		remotePatterns: [
			{
				protocol: "https",
				hostname: "raw.githubusercontent.com",
			},
		],
	},
	rewrites: async () => [
		{
			source: "/api/:path*",
			destination: "http://localhost:3001/:path*",
		},
		{
			source: "/v1/:path*",
			destination: "http://localhost:3001/v1/:path*",
		},
	],
}

export default nextConfig
