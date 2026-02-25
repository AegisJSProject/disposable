export const DisposableWorker = 'Worker' in globalThis
	? class DisposableWorker extends Worker {
		[Symbol.dispose]() {
			this.terminate();
		}
	} : undefined;

export const DisposableBroadcastChannel = 'BroadcastChannel' in globalThis
	? class DisposableBroadcastChannel extends BroadcastChannel {
		[Symbol.dispose]() {
			this.close();
		}
	}: undefined;

export const DisposableWebSocket = 'WebSocket' in globalThis
	? class DisposableWebSocket extends WebSocket {
		[Symbol.dispose]() {
			this.close();
		}
	}: undefined;

export const DisposableEventSource = 'EventSource' in globalThis
	? class DisposableEventSource extends EventSource {
		[Symbol.dispose]() {
			this.close();
		}
	}: undefined;

export const DisposableRTCPeerConnection = 'RTCPeerConnection' in globalThis
	? class DisposableRTCPeerConnection extends RTCPeerConnection {
		[Symbol.dispose]() {
			this.close();
		}
	} : undefined;

export const DisposableWebTransport = 'WebTransport' in globalThis
	? class DisposableWebTransport extends WebTransport {
		[Symbol.dispose]() {
			this.close();
		}
	} : undefined;
