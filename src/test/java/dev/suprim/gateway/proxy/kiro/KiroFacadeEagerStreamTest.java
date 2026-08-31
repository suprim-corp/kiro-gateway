package dev.suprim.gateway.proxy.kiro;

import dev.suprim.gateway.logging.RequestLogPublisher;
import dev.suprim.gateway.model.ModelResolver;
import dev.suprim.gateway.provider.AccountRotator;
import dev.suprim.gateway.provider.CredentialStore;
import dev.suprim.gateway.provider.StoredAccount;
import dev.suprim.gateway.provider.kiro.KiroAccountModelAvailability;
import dev.suprim.gateway.provider.kiro.KiroAuthManager;
import dev.suprim.gateway.provider.kiro.payload.PayloadBuilder;
import dev.suprim.gateway.proxy.Format;
import dev.suprim.gateway.proxy.InternalRequest;
import dev.suprim.gateway.proxy.SseHeartbeat;
import dev.suprim.gateway.proxy.SseHeartbeatScheduler;
import dev.suprim.gateway.proxy.StreamConverter;
import dev.suprim.gateway.proxy.StreamHandler;
import dev.suprim.gateway.virtualkey.VirtualKeyService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.mock.web.MockHttpServletResponse;

import java.io.ByteArrayInputStream;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * The streaming path must commit the response before the upstream is contacted: an edge proxy
 * times out on the delay to the first byte, and account rotation can spend far longer than that
 * budget before any byte exists.
 */
class KiroFacadeEagerStreamTest {

	private KiroFacade facade;
	private KiroAuthManager authManager;
	private AccountRotator rotator;
	private CredentialStore store;
	private KiroHttpClient kiroClient;
	private StreamHandler streamHandler;
	private MockHttpServletResponse httpRes;

	@BeforeEach
	void setUp() throws Exception {
		store = mock(CredentialStore.class);
		authManager = mock(KiroAuthManager.class);
		rotator = mock(AccountRotator.class);
		kiroClient = mock(KiroHttpClient.class);
		httpRes = new MockHttpServletResponse();

		PayloadBuilder payloadBuilder = mock(PayloadBuilder.class);
		KiroAccountModelAvailability modelAvailability = mock(
				KiroAccountModelAvailability.class
		);
		StreamConverter streamConverter = new StreamConverter();
		streamHandler = mock(StreamHandler.class);

		when(payloadBuilder.buildOpenAiPayload(any(), any()))
				.thenReturn("{\"test\":true}");
		when(modelAvailability.eligibleAccounts(anyString(), anyList()))
				.thenAnswer(invocation -> invocation.getArgument(1));
		when(modelAvailability.isWarmUpComplete(anyList())).thenReturn(true);
		when(streamHandler.streamToWriter(any(), any(), any(), org.mockito.ArgumentMatchers.anyLong()))
				.thenReturn(StreamHandler.StreamResult.builder()
				                                      .content("hi")
				                                      .outputTokens(2)
				                                      .build());

		KiroUpstreamDispatcher upstreamDispatcher = new KiroUpstreamDispatcher(
				kiroClient,
				payloadBuilder,
				authManager,
				rotator,
				store,
				modelAvailability,
				new ModelResolver()
		);

		facade = new KiroFacade(
				authManager,
				streamHandler,
				streamConverter,
				new SseHeartbeat(mock(SseHeartbeatScheduler.class)),
				new RequestLogPublisher(mock(ApplicationEventPublisher.class)),
				mock(VirtualKeyService.class),
				upstreamDispatcher,
				new KiroFormatConverter(streamConverter)
		);
	}

	@Test
	void streaming_commitsResponseBeforeContactingUpstream() throws Exception {
		StoredAccount account = account("kiro1", "key1");
		when(store.findAllByProvider("KIRO")).thenReturn(List.of(account));
		when(rotator.next(eq("KIRO"), anyList())).thenReturn(account);
		when(authManager.getAccessToken(account)).thenReturn("key1");

		// Asserts mid-dispatch: by the time the upstream call happens, the client must already
		// have bytes. Checking after the fact would pass even if the byte arrived last.
		when(kiroClient.request(
				anyString(), anyString(), anyString(), anyBoolean(), eq("key1"), anyBoolean()
		)).thenAnswer(invocation -> {
			assertTrue(
					httpRes.getContentAsString().startsWith(": open\n\n"),
					"stream must be primed before the upstream request"
			);
			return new KiroHttpClient.KiroResponse(
					200,
					new ByteArrayInputStream("data: {}\n".getBytes()),
					"text/event-stream"
			);
		});

		facade.handle(request(), "claude-sonnet-4-20250514", true, 10,
				"key1", "127.0.0.1", Format.COMPLETION, httpRes);

		assertEquals("text/event-stream; charset=utf-8", httpRes.getContentType());
	}

	@Test
	void streaming_relaysUpstreamErrorAsStreamEvent() throws Exception {
		StoredAccount account = account("kiro1", "key1");
		when(store.findAllByProvider("KIRO")).thenReturn(List.of(account));
		when(rotator.next(eq("KIRO"), anyList())).thenReturn(account);
		when(authManager.getAccessToken(account)).thenReturn("key1");
		when(kiroClient.request(
				anyString(), anyString(), anyString(), anyBoolean(), eq("key1"), anyBoolean()
		)).thenReturn(new KiroHttpClient.KiroResponse(
				400,
				new ByteArrayInputStream("upstream error".getBytes()),
				"application/json"
		));

		facade.handle(request(), "claude-sonnet-4-20250514", true, 10,
				"key1", "127.0.0.1", Format.COMPLETION, httpRes);

		String body = httpRes.getContentAsString();
		assertTrue(body.contains("upstream_error"), body);
		assertTrue(body.contains("data: [DONE]"), body);
		// The response was committed before the status was known, so 400 cannot be sent.
		assertEquals(200, httpRes.getStatus());
	}

	@Test
	void nonStreaming_keepsStatusCodeErrors() throws Exception {
		StoredAccount account = account("kiro1", "key1");
		when(store.findAllByProvider("KIRO")).thenReturn(List.of(account));
		when(rotator.next(eq("KIRO"), anyList())).thenReturn(account);
		when(authManager.getAccessToken(account)).thenReturn("key1");
		when(kiroClient.request(
				anyString(), anyString(), anyString(), anyBoolean(), eq("key1"), anyBoolean()
		)).thenReturn(new KiroHttpClient.KiroResponse(
				400,
				new ByteArrayInputStream("upstream error".getBytes()),
				"application/json"
		));

		facade.handle(request(), "claude-sonnet-4-20250514", false, 10,
				"key1", "127.0.0.1", Format.COMPLETION, httpRes);

		assertEquals(400, httpRes.getStatus());
		assertFalse(httpRes.getContentAsString().contains("data: "));
	}

	/**
	 * A checked IOException from the transport used to reach the controller and become a status
	 * code. Once the stream is committed that route is gone, so it has to be relayed in-stream.
	 */
	@Test
	void streaming_relaysCheckedTransportFailureAsStreamEvent() throws Exception {
		StoredAccount account = account("kiro1", "key1");
		when(store.findAllByProvider("KIRO")).thenReturn(List.of(account));
		when(rotator.next(eq("KIRO"), anyList())).thenReturn(account);
		when(authManager.getAccessToken(account)).thenReturn("key1");
		when(kiroClient.request(
				anyString(), anyString(), anyString(), anyBoolean(), eq("key1"), anyBoolean()
		)).thenThrow(new java.io.IOException("[Proxy] All proxies exhausted"));

		facade.handle(request(), "claude-sonnet-4-20250514", true, 10,
				"key1", "127.0.0.1", Format.COMPLETION, httpRes);

		String body = httpRes.getContentAsString();
		assertTrue(body.contains("service_unavailable"), body);
		assertTrue(body.contains("data: [DONE]"), body);
	}

	@Test
	void streaming_relaysMidStreamBreakAsStreamEvent() throws Exception {
		StoredAccount account = account("kiro1", "key1");
		when(store.findAllByProvider("KIRO")).thenReturn(List.of(account));
		when(rotator.next(eq("KIRO"), anyList())).thenReturn(account);
		when(authManager.getAccessToken(account)).thenReturn("key1");
		when(kiroClient.request(
				anyString(), anyString(), anyString(), anyBoolean(), eq("key1"), anyBoolean()
		)).thenReturn(new KiroHttpClient.KiroResponse(
				200,
				new ByteArrayInputStream("data: {}\n".getBytes()),
				"text/event-stream"
		));
		when(streamHandler.streamToWriter(
				any(), any(), any(), org.mockito.ArgumentMatchers.anyLong()
		)).thenThrow(new java.io.IOException("connection reset"));

		facade.handle(request(), "claude-sonnet-4-20250514", true, 10,
				"key1", "127.0.0.1", Format.COMPLETION, httpRes);

		String body = httpRes.getContentAsString();
		assertTrue(body.contains("upstream_error"), body);
	}

	private StoredAccount account(String name, String token) {
		return StoredAccount.builder()
		                    .name(name)
		                    .provider("KIRO")
		                    .authType("API_KEY")
		                    .accessToken(token)
		                    .build();
	}

	private InternalRequest request() {
		return InternalRequest.builder()
		                      .model("claude-sonnet-4-20250514")
		                      .messages(List.of())
		                      .stream(true)
		                      .build();
	}
}
