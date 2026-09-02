package dev.suprim.gateway.instants;

public class Antigravity {

	public static final String CLOUDCODE_BASE = "https://daily-cloudcode-pa.googleapis.com";
	public static final String CLOUDCODE_MODELS =
			CLOUDCODE_BASE + "/v1beta/models/";
	public static final String GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
	public static final String GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
	public static final String OAUTH_SCOPE = "https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/cclog https://www.googleapis.com/auth/experimentsandconfigs";
	/**
	 * Identifies the client to {@code cloudcode-pa}, which serves a different model set per
	 * client version: the IDE 2.1.1 string predates Gemini 3.8, so the backend omits the 3.7
	 * and 3.8 tiers from {@code fetchAvailableModels} and answers
	 * {@code streamGenerateContent} for them with 404 NOT_FOUND.
	 */
	public static final String USER_AGENT =
			"antigravity/cli/1.1.24 (aidev_client; os_type=darwin; arch=arm64; cl=974782877; auth_method=consumer)";
	public static final String REDIRECT_URI = "http://localhost:51121/oauth-callback";
	/** Loopback port Google redirects the browser back to. */
	public static final int LOOPBACK_PORT = 51121;
	public static final String USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";
	public static final String CLIENT_ID = rot("1071006060591-gzuffva2u21yper235igbybwu4t403rc.nccf.tbbtyrhfrepbagrag.pbz");
	public static final String CLIENT_SECRET = rot("TBPFCK-X58SJE486YqYW1zYO8fKP4m6dQNs");
	public static final String PROVIDER = "ANTIGRAVITY";

	private Antigravity() {}

	private static String rot(String input) {
		StringBuilder sb = new StringBuilder(input.length());
		for (char c : input.toCharArray()) {
			if (c >= 'a' && c <= 'z') {
				sb.append((char) ('a' + (c - 'a' + 13) % 26));
			} else if (c >= 'A' && c <= 'Z') {
				sb.append((char) ('A' + (c - 'A' + 13) % 26));
			} else {
				sb.append(c);
			}
		}
		return sb.toString();
	}
}
