export class DisposableAbortController extends AbortController {
	[Symbol.dispose]() {
		if (! this.signal.aborted) {
			this.abort(new DOMException('Controller was disposed.', 'AbortError'));
		}
	}
}

export class DisposableObjectURL extends String {
	#disposed = false;

	constructor(blob, { signal } = {}) {
		if (! (blob instanceof Blob)) {
			throw new TypeError('Expected a `Blob` or `File` object.');
		} else if (signal?.aborted) {
			throw signal.reason;
		} else {
			super(URL.createObjectURL(blob));
			signal?.addEventListener('abort', this[Symbol.dispose].bind(this), { once: true });
		}
	}

	get disposed() {
		return this.#disposed;
	}

	revoke() {
		this[Symbol.dispose]();
	}

	[Symbol.dispose]() {
		if (! this.#disposed) {
			this.#disposed = true;
			URL.revokeObjectURL(this.toString());
		}
	}
}

/**
 * Proxies a target object. The proxy becomes unusable once the stack is disposed.
 * @template T
 * @param {DisposableStack} stack
 * @param {T} target
 * @param {ProxyHandler} [handler=Reflect]
 * @returns {Proxy<T>}
 */
export function guard(stack, target, handler = Reflect) {
	const { proxy, revoke } = Proxy.revocable(target, handler);

	stack.defer(revoke);

	return proxy;
}

/**
 *
 * @param {DisposableStack|AsyncDisposableStack} stack
 * @param {object} [config]
 * @param {AbortSignal} [config.signal]
 * @returns {Promise<void>}
 * @throws {any} Throws the abort signal's reason if aborted before disposal.
 */
export async function whenDisposed(stack, { signal } = {}) {
	if (signal?.aborted) {
		throw signal.reason;
	} else if (stack.disposed) {
		throw new DOMException('Stack is already disposed.', 'InvalidStateError');
	} else if (! (stack instanceof DisposableStack || stack instanceof AsyncDisposableStack)) {
		throw new TypeError('Stack must be a `DisposableStack` or `AsyncDisposableStack`.');
	} else if (signal instanceof AbortSignal) {
		const { resolve, reject, promise } = Promise.withResolvers();
		const controller = stack.use(new DisposableAbortController());
		stack.defer(resolve);
		signal.addEventListener('abort', ({ target }) => reject(target.reason), { once: true, signal: controller.signal });
		return promise;
	} else {
		const { resolve, promise } = Promise.withResolvers();
		stack.defer(resolve);
		return promise;
	}
}

export class DisposableTask {
	#controller = new AbortController();
	#resolvers = Promise.withResolvers();

	constructor(callback, { priority, signal, delay } = {}) {
		if (typeof callback !== 'function') {
			this.abort(new TypeError('Callback must be a function.'));
		} else if (signal?.aborted) {
			this.#resolvers.reject(signal.reason);
			this.#controller.abort(signal.reason);
		} else {
			scheduler.postTask(callback, {
				priority,
				delay,
				signal: signal instanceof AbortSignal
					? TaskSignal.any(
						[signal, this.#controller.signal],
						signal instanceof TaskSignal ? signal : { priority: priority ?? 'user-visible' }
					)
					: this.#controller.signal,
			}).then(this.#resolvers.resolve, this.#resolvers.reject);
		}
	}

	[Symbol.dispose]() {
		this.abort(new DOMException('Task was disposed.', 'AbortError'));
	}

	get aborted() {
		return this.#controller.signal.aborted;
	}

	get signal() {
		return this.#controller.signal;
	}

	abort(reason = new DOMException('Task aborted.', 'AbortError')) {
		if (! this.#controller.signal.aborted) {
			this.#controller.abort(reason);
			this.#resolvers.reject(reason);
			return true;
		} else {
			return false;
		}
	}

	then(successCb, errorCb) {
		return this.#resolvers.promise.then(successCb, errorCb);
	}

	catch(callback) {
		return this.#resolvers.promise.catch(callback);
	}

	finally(callback) {
		return this.#resolvers.promise.finally(callback);
	}
}
