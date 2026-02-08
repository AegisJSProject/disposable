export const HTMLDisposableStackElement = 'customElements' in globalThis ? class HTMLDisposableStackElement extends HTMLElement {
	#stack = new DisposableStack();
	#internals = this.attachInternals();
	#shadow = this.attachShadow({ mode: 'open' });

	connectedCallback() {
		if (this.disposed) {
			this.#internals.states.delete('disposed');
			this.#stack = new DisposableStack();
		}

		const tracked = new WeakSet();
		const slot = document.createElement('slot');
		const { signal } = this.adopt(new AbortController(), controller => controller.abort());
		this.#shadow.replaceChildren(slot);
		this.defer(() => this.#internals.states.add('disposed'));

		slot.addEventListener('slotchange', ({ target }) => {
			if (! this.disposed) {
				target.assignedElements()
					.filter(el => typeof el[Symbol.dispose] === 'function' && ! tracked.has(el))
					.forEach(el => {
						this.#stack.use(el);
						tracked.add(el);
					});
			}
		}, { passive: true, signal });

		this.addEventListener('command', ({ command }) => {
			switch(command) {
				case '--dispose':
					this.dispose();
					break;

				case '--request-dispose':
					this.requestDispose();
					break;
			}
		}, { passive: true, signal });
	}

	disconnectedCallback() {
		this.dispose();
	}

	get disposed() {
		return this.#stack.disposed;
	}

	adopt(target, onDispose) {
		return this.#stack.adopt(target, onDispose);
	}

	defer(onDispose) {
		return this.#stack.defer(onDispose);
	}

	requestDispose() {
		if (this.disposed) {
			return false;
		} else {
			const beforeDispose = new Event('beforedispose', { cancelable: true, bubbles: true });
			this.dispatchEvent(beforeDispose);

			if (! beforeDispose.defaultPrevented) {
				this[Symbol.dispose]();
				return true;
			} else {
				return false;
			}
		}
	}

	dispose() {
		this[Symbol.dispose]();
	}

	use(target) {
		return this.#stack.use(target);
	}

	[Symbol.dispose]() {
		this.#stack.dispose();
		this.dispatchEvent(new Event('disposed', { bubbles: true }));
	}
} : undefined;

globalThis?.customElements?.define('disposable-stack', HTMLDisposableStackElement);
