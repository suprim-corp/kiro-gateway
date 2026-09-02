package dev.suprim.gateway.model;

import dev.suprim.gateway.provider.Provider;

public class ModelRouter {

	public static Provider resolveProvider(String model) {
		return Provider.fromModel(model);
	}

	/**
	 * Turns a client-facing id into the one its upstream expects: drops the provider prefix
	 * and any context-window hint. Only the Kiro path canonicalizes further, so without the
	 * hint removed here a request like {@code ag/gemini-3.8-flash-high[1m]} reaches the
	 * upstream verbatim and is rejected as an unknown model.
	 */
	public static String stripPrefix(String model) {
		return ModelResolver.stripContextWindow(Provider.stripPrefix(model));
	}
}
