import { describe, it, mock } from 'node:test';
import assert from 'node:assert';
import {
	useDisposableStack,
	useAsyncDisposableStack,
	DisposableAbortController,
	DisposableObjectURL,
	DisposableTask,
	guard,
	whenDisposed
} from './disposable.js';

// ==========================================
// 1. Mocks for Browser APIs in Node
// ==========================================

if (!globalThis.scheduler) {
	globalThis.scheduler = {
		postTask: mock.fn(async (cb) => cb())
	};
}

globalThis.URL.revokeObjectURL = mock.fn();

// ==========================================
// 2. Test Suite
// ==========================================

/**
 * Wraps a test in an AsyncDisposableStack.
 * This allows using `stack.use()`, `stack.defer()`, and other cleanups directly in the test.
 * @param {string} name
 * @param {(stack: AsyncDisposableStack, context: { signal: AbortSignal }) => Promise<void>|void} fn
 */
const test = (name, fn) => it(name, () => useAsyncDisposableStack(fn));
describe('Disposable Stack Utilities', () => {

	describe('useDisposableStack (Sync)', () => {
		test('should execute the callback and return the value', () => {
			// We can still test the *inner* logic of the library functions
			// even while inside our test-harness stack.
			const result = useDisposableStack(() => 'success');
			assert.strictEqual(result, 'success');
		});

		test('should dispose resources when scope ends', () => {
			let disposed = false;

			// We manually create a child stack to verify "on dispose" behavior
			// without ending the actual test.
			useDisposableStack((childStack) => {
				childStack.defer(() => disposed = true);
			});

			assert.strictEqual(disposed, true);
		});
	});

	describe('useAsyncDisposableStack (Async)', () => {
		test('should await the callback and return value', async () => {
			const result = await useAsyncDisposableStack(async () => {
				return 'async-success';
			});
			assert.strictEqual(result, 'async-success');
		});

		test('should properly dispose async resources', async () => {
			let disposed = false;

			await useAsyncDisposableStack(async (childStack) => {
				childStack.defer(() => disposed = true);
			});

			assert.strictEqual(disposed, true);
		});

		test('should abort if the input signal triggers', async (stack) => {
			// We use the outer stack to manage the controller for the test itself
			const controller = stack.adopt(new AbortController(), controller => controller.abort());

			await assert.rejects(async () => {
				await useAsyncDisposableStack(async (innerStack, { signal }) => {
					// Trigger external abort
					controller.abort(new Error('External Abort'));

					// Wait for signal to propagate
					await new Promise((_, reject) => {
						if (signal.aborted) reject(signal.reason);
						signal.addEventListener('abort', () => reject(signal.reason));
					});
				}, { signal: controller.signal });
			}, /External Abort/);
		});
	});

	describe('DisposableAbortController', () => {
		test('should abort automatically when disposed', (stack) => {
			// This controller will be disposed automatically when the `test` wrapper finishes
			// unless we explicitly dispose it earlier to assert state.
			const controller = stack.use(new DisposableAbortController());
			const listener = mock.fn();

			controller.signal.addEventListener('abort', listener);

			// Manually dispose early to verify behavior
			controller[Symbol.dispose]();

			assert.strictEqual(listener.mock.calls.length, 1);
			assert.strictEqual(controller.signal.aborted, true);
			assert.strictEqual(controller.signal.reason.name, 'AbortError');
		});
	});

	describe('DisposableObjectURL', () => {
		test('should create and revoke a blob URL', (stack) => {
			const blob = new Blob(['test']);

			// This will be cleaned up automatically by the test wrapper if we forget
			const urlWrapper = stack.use(new DisposableObjectURL(blob));

			assert.ok(urlWrapper.startsWith('blob:'));

			// Manually dispose to verify the mock call in this test
			urlWrapper[Symbol.dispose]();

			assert.strictEqual(globalThis.URL.revokeObjectURL.mock.calls.length, 1);
		});

		test('should be revocable via AbortSignal', (stack) => {
			const blob = new Blob(['test']);
			const controller = stack.adopt(new AbortController(), controller => controller.abort());
			const urlWrapper = stack.use(new DisposableObjectURL(blob, { signal: controller.signal }));

			controller.abort();

			assert.strictEqual(urlWrapper.disposed, true);
		});
	});

	describe('guard (Proxy)', () => {
		test('should revoke the proxy when stack is disposed', (stack) => {
			const target = { foo: 'bar' };

			// Create a nested stack so we can "dispose" it while still inside the test
			const childStack = stack.use(new DisposableStack());
			const proxy = guard(childStack, target);

			assert.strictEqual(proxy.foo, 'bar');

			childStack.dispose();

			assert.throws(() => {
				console.log(proxy.foo);
			}, TypeError);
		});
	});

	describe('DisposableTask', () => {
		test('should execute the task via scheduler', async (stack) => {
			const task = stack.use(new DisposableTask(() => 'task-result'));
			const result = await task;
			assert.strictEqual(result, 'task-result');
		});

		test('should abort the task when disposed', async (stack) => {
			const task = stack.use(new DisposableTask(() => new Promise(() => {})));

			// Manually dispose just the task to check status
			task[Symbol.dispose]();

			assert.strictEqual(task.aborted, true);
			await assert.rejects(() => task, { name: 'AbortError' });
		});
	});

	describe('whenDisposed', () => {
		test('should resolve when the stack is disposed', async (stack) => {
			const childStack = stack.use(new DisposableStack());
			const promise = whenDisposed(childStack);

			let resolved = false;
			promise.then(() => resolved = true);

			await new Promise(r => setTimeout(r, 0));
			assert.strictEqual(resolved, false);

			childStack.dispose();

			await promise;
			assert.strictEqual(resolved, true);
		});
	});
});
