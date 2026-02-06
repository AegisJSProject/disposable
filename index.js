import { useAsyncDisposableStack, DisposableObjectURL, DisposableTask, createDisposableElement } from '@aegisjsproject/disposable';

useAsyncDisposableStack(async (stack, { signal }) => {
	const resp = await fetch('/favicon.svg', { signal });
	const dialog = createDisposableElement(stack, { tag: 'dialog', id: 'modal' });
	const closeBtn = document.createElement('button');
	const blob = await resp.blob();
	const controller = stack.adopt(
		new AbortController(),
		controller => controller.abort(new DOMException('Controller was disposed.', 'AbortError'))
	);
	const uri = stack.use(new DisposableObjectURL(blob));
	const sheet = new CSSStyleSheet();
	const img = document.createElement('img');
	const p = document.createElement('p');

	stack.defer(() => console.log('Disposed'));
	stack.use(new DisposableTask(() => 'Task Executed.')).then(console.log, console.error);

	sheet.replace(`:root{background-image: url(${uri})}`);
	document.adoptedStyleSheets = [sheet];
	controller.signal.addEventListener('abort', console.log, { once: true });

	img.src = uri;
	closeBtn.type = 'button';
	closeBtn.command = 'request-close';
	closeBtn.commandForElement = dialog;
	closeBtn.textContent = 'Dismiss';
	p.textContent = 'Hello, World!';
	dialog.append(p, closeBtn, img);
	document.body.append(dialog);
	dialog.showModal();

	await new Promise(resolve => setTimeout(resolve, 5000));
});
