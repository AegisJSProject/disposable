export const setDisposableTimeout = (stack, handler, timeout, ...args) => stack.adopt(setTimeout(handler, timeout, ...args), clearTimeout);

export const setDisposableInterval = (stack, handler, timeout, ...args) => stack.adopt(setInterval(handler, timeout, ...args), clearInterval);

export const requestDisposableAnimationFrame = (stack, callback) => stack.adopt(requestAnimationFrame(callback), cancelAnimationFrame);

export const requestDisposableIdleCallback = (stack, callback, init) => stack.adopt(requestIdleCallback(callback, init), cancelIdleCallback);
