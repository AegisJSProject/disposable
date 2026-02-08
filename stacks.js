import { DisposableAbortController } from './utils.js';

/**
 * Creates a synchronous scope for managing disposable resources.
 * The stack is automatically disposed when the callback returns or throws.
 *
 * @template T
 * @param {(stack: DisposableStack, info: { timeStamp: number, id: string }) => T} callback The function to execute within the scope.
 * @returns {T} The result of the callback.
 */
export function useDisposableStack(callback) {
	const stack = new DisposableStack();

	try {
		return callback(stack, {
			timeStamp: performance.now(),
			id: 'scope:' + crypto.randomUUID(),
		});
	} finally {
		stack.dispose();
	}
}

/**
 * Creates an asynchronous scope for managing disposable resources with AbortSignal integration.
 * The stack is disposed when the promise resolves/rejects, or when the signal aborts.
 *
 * @template T
 * @param {(stack: AsyncDisposableStack, info: { controller: AbortController, signal: AbortSignal, timeStamp: number, id: string }) => Promise<T>|T} callback The function to execute.
 * @param {Object} [options]
 * @param {AbortSignal} [options.signal] An optional signal to abort the scope and trigger disposal.
 * @returns {Promise<T>} A promise that resolves with the callback result.
 */
export async function useAsyncDisposableStack(callback, { signal: sig } = {}) {
	if (sig?.aborted) {
		throw sig.reason;
	} else {
		const stack = new AsyncDisposableStack();
		const controller = stack.use(new DisposableAbortController());
		const signal = sig instanceof AbortSignal
			? AbortSignal.any([sig, controller.signal ])
			: controller.signal;

		signal.addEventListener('abort', () => stack.disposed || stack.disposeAsync(), { once: true });

		return Promise.try(callback, stack, {
			controller,
			signal,
			timeStamp: performance.now(),
			id: 'async-scope:' + crypto.randomUUID(),
		}).finally(stack.disposeAsync.bind(stack));
	}
}
