package dev.suprim.gateway.proxy;

import tools.jackson.databind.json.JsonMapper;

import java.io.PrintWriter;
import java.util.Map;

/**
 * Emits an error inside an already-committed SSE stream.
 * <p>
 * {@link dev.suprim.gateway.utils.ErrorResponse} sets a status code, which the servlet container
 * silently drops once the first byte has been written. A stream opened before the upstream answers
 * is always already committed by the time a failure is known, so the status has to travel in the
 * body instead.
 */
public final class SseError {

	private static final JsonMapper MAPPER = new JsonMapper();

	private SseError() {}

	public static void emit(
			PrintWriter writer,
			Format format,
			int status,
			String message,
			String type
	) {
		if (format == Format.ANTHROPIC) {
			writer.write(
					"event: error\ndata: " + MAPPER.writeValueAsString(
							Map.of(
									"type", "error",
									"error", Map.of(
											"type", type,
											"message", message
									)
							)
					) + "\n\n"
			);
			writer.flush();
			return;
		}

		writer.write(
				"data: " + MAPPER.writeValueAsString(
						Map.of(
								"error", Map.of(
										"message", message,
										"type", type,
										"code", status
								)
						)
				) + "\n\n"
		);
		writer.write("data: [DONE]\n\n");
		writer.flush();
	}
}
