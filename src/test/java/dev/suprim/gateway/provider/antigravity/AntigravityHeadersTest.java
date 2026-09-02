package dev.suprim.gateway.provider.antigravity;

import dev.suprim.gateway.instants.Antigravity;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class AntigravityHeadersTest {

	@Test
	void forControlPlane_containsRequiredHeaders() {
		Map<String, String> headers = AntigravityHeaders.forControlPlane("ya29.test-token");

		assertEquals("Bearer ya29.test-token", headers.get("Authorization"));
		assertEquals("application/json", headers.get("Content-Type"));
		assertEquals("google-cloud-sdk vscode/1.96.0", headers.get("X-Goog-Api-Client"));
		// The control plane must report the same client version as the streaming call: an
		// older-looking agent string is served a reduced model set.
		assertEquals(Antigravity.USER_AGENT, headers.get("User-Agent"));
	}

	@Test
	void clientMetadataHeader_serializesEveryField() {
		String metadata = AntigravityHeaders.forControlPlane("token").get("Client-Metadata");

		assertEquals(
				"{\"ideType\":\"VSCODE\",\"platform\":\"MACOS\",\"pluginType\":\"GEMINI\","
				+ "\"osVersion\":\"15.1\",\"arch\":\"arm64\"}",
				metadata
		);
	}
}
