export const DisposableMutationObserver = 'MutationObserver' in globalThis
	? class DisposableMutationObserver extends MutationObserver {
		[Symbol.dispose]() {
			this?.disconnect();
		}
	} : undefined;

export const DisposableIntersectionObserver = 'IntersectionObserver' in globalThis
	? class DisposableIntersectionObserver extends IntersectionObserver {
		[Symbol.dispose]() {
			this?.disconnect();
		}
	} : undefined;

export const DisposableResizeObserver = 'ResizeObserver' in globalThis
	? class DisposableResizeObserver extends ResizeObserver {
		[Symbol.dispose]() {
			this?.disconnect();
		}
	} : undefined;

export const DisposablePerformanceObserver = 'PerformanceObserver' in globalThis
	? class DisposablePerformanceObserver extends PerformanceObserver {
		[Symbol.dispose]() {
			this?.disconnect();
		}
	} : undefined;

export const DisposableReportingObserver = 'ReportingObserver' in globalThis
	? class DisposableReportingObserver extends ReportingObserver {
		[Symbol.dispose]() {
			this?.disconnect();
		}
	} : undefined;
