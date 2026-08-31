package dev.suprim.gateway.proxy;

import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.PrintWriter;
import java.util.concurrent.ScheduledFuture;

@RequiredArgsConstructor
@Component
public class SseHeartbeat {

	private static final long INTERVAL_SECONDS = 15;
	private final SseHeartbeatScheduler scheduler;

	public Session open(HttpServletResponse response) throws IOException {
		return open(response, true);
	}

	/**
	 * Opens a session and immediately commits the response with an SSE comment.
	 * <p>
	 * Intended for the window before the upstream has answered: an edge proxy times a request
	 * out on the delay to the first byte, not on total duration, so the byte has to leave
	 * before the upstream work starts rather than after it.
	 */
	public Session openEager(HttpServletResponse response) throws IOException {
		Session session = open(response, true);
		session.prime();
		return session;
	}

	public Session open(
			HttpServletResponse response,
			boolean heartbeatEnabled
	) throws IOException {
		response.setCharacterEncoding("UTF-8");
		response.setContentType("text/event-stream; charset=utf-8");
		response.setHeader("Cache-Control", "no-cache");
		response.setHeader("X-Accel-Buffering", "no");
		PrintWriter delegate = response.getWriter();
		Session session = new Session(delegate);
		if (heartbeatEnabled) {
			ScheduledFuture<?> future = scheduler.schedule(
					session::heartbeat,
					INTERVAL_SECONDS
			);
			session.setFuture(future);
		}
		return session;
	}

	public static final class Session implements AutoCloseable {

		private final Object lock = new Object();
		private final PrintWriter delegate;
		private final PrintWriter writer;
		private ScheduledFuture<?> future;
		private boolean closed;

		private Session(PrintWriter delegate) {
			this.delegate = delegate;
			this.writer = new LockedWriter();
		}

		private void setFuture(ScheduledFuture<?> future) {
			synchronized (lock) {
				this.future = future;
				if (closed) {
					future.cancel(false);
				}
			}
		}

		public PrintWriter writer() {
			return writer;
		}

		/** Sends the first byte so the response is committed before any upstream work begins. */
		private void prime() {
			synchronized (lock) {
				if (closed) {
					return;
				}
				delegate.write(": open\n\n");
				delegate.flush();
			}
		}

		private void heartbeat() {
			synchronized (lock) {
				if (closed) {
					return;
				}
				try {
					delegate.write(": heartbeat\n\n");
					delegate.flush();
					if (delegate.checkError()) {
						close();
					}
				} catch (RuntimeException exception) {
					closed = true;
					if (future != null) {
						future.cancel(false);
					}
				}
			}
		}

		@Override
		public void close() {
			synchronized (lock) {
				if (closed) {
					return;
				}
				closed = true;
				if (future != null) {
					future.cancel(false);
				}
			}
		}

		private final class LockedWriter extends PrintWriter {

			private LockedWriter() {
				super(delegate);
			}

			@Override
			public void write(int character) {
				synchronized (lock) {
					delegate.write(character);
				}
			}

			@Override
			public void write(char[] buffer, int offset, int length) {
				synchronized (lock) {
					delegate.write(buffer, offset, length);
				}
			}

			@Override
			public void write(String value, int offset, int length) {
				synchronized (lock) {
					delegate.write(value, offset, length);
				}
			}

			@Override
			public void flush() {
				synchronized (lock) {
					delegate.flush();
				}
			}

			@Override
			public void close() {
				Session.this.close();
			}
		}
	}
}
