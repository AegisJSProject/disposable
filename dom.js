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
