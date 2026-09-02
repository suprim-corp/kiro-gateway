package dev.suprim.gateway.model;

import dev.suprim.gateway.provider.Provider;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class ModelRouterTest {

	@Test
	void resolveProvider_geminiFlash_antigravity() {
		assertEquals(Provider.ANTIGRAVITY, ModelRouter.resolveProvider("ag/gemini-2.5-flash"));
	}

	@Test
	void resolveProvider_geminiPro_antigravity() {
		assertEquals(Provider.ANTIGRAVITY, ModelRouter.resolveProvider("ag/gemini-2.5-pro"));
	}

	@Test
	void resolveProvider_gemini20Flash_antigravity() {
		assertEquals(Provider.ANTIGRAVITY, ModelRouter.resolveProvider("ag/gemini-2.0-flash"));
	}

	@Test
	void resolveProvider_claudeSonnet_kiro() {
		assertEquals(Provider.KIRO, ModelRouter.resolveProvider("claude-sonnet-4.5"));
	}

	@Test
	void resolveProvider_claudeOpus_kiro() {
		assertEquals(Provider.KIRO, ModelRouter.resolveProvider("claude-opus-4"));
	}

	@Test
	void resolveProvider_auto_kiro() {
		assertEquals(Provider.KIRO, ModelRouter.resolveProvider("auto"));
	}

	@Test
	void resolveProvider_null_kiro() {
		assertEquals(Provider.KIRO, ModelRouter.resolveProvider(null));
	}

	@Test
	void resolveProvider_emptyString_kiro() {
		assertEquals(Provider.KIRO, ModelRouter.resolveProvider(""));
	}

	@Test
	void stripPrefix_dropsContextWindowHint() {
		assertEquals(
				"gemini-3.8-flash-high",
				ModelRouter.stripPrefix("ag/gemini-3.8-flash-high[1m]")
		);
	}

	@Test
	void stripPrefix_dropsContextWindowHintWithoutPrefix() {
		assertEquals("gemini-3.8-flash-high", ModelRouter.stripPrefix("gemini-3.8-flash-high[200k]"));
	}

	@Test
	void stripPrefix_leavesPlainIdUntouched() {
		assertEquals("gemini-3.8-flash-high", ModelRouter.stripPrefix("ag/gemini-3.8-flash-high"));
	}

	@Test
	void stripPrefix_keepsBracketsThatAreNotAContextHint() {
		assertEquals("weird[model]name", ModelRouter.stripPrefix("weird[model]name"));
	}
}
