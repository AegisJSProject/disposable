export const DisposableAudioContext = 'AudioContext' in globalThis
	? class DisposableAudioContext extends AudioContext {
		async [Symbol.asyncDispose]() {
			await this.close();
		}

		[Symbol.dispose]() {
			this.close();
		}
	} : undefined;
