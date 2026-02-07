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

/**
 * Creates an element that is removed when the stack is disposed.
 *
 * @template {keyof HTMLElementTagNameMap} [K="div"]
 * @param {DisposableStack|AsyncDisposableStack} stack
 * @param {{ tag?: K } & Object<string, any>} [config={tag:"div"}]
 * @returns {HTMLElementTagNameMap[K]} The created DOM element.
 */
export function createDisposableElement(stack, { tag = 'div', ...attrs } = {}) {
	if (! (stack instanceof DisposableStack || stack instanceof AsyncDisposableStack)) {
		throw new TypeError('Stack must be a `DisposableStack`');
	} else if (typeof tag !== 'string' || tag.length === 0) {
		throw new TypeError('Tag must be a string.');
	} else if (stack.disposed) {
		throw new DOMException('Stack is already disposed.', 'InvalidStateError');
	} else {
		const el = stack.adopt(document.createElement(tag), el => el.remove());
		Object.entries(attrs).forEach(([name, value ]) => el.setAttribute(name, value));

		return el;
	}
}
