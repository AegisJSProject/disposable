# `@aegisjsproject/disposable`

A library of utility functions for working with disposable objects 

[![CodeQL](https://github.com/AegisJSProject/disposable/actions/workflows/codeql-analysis.yml/badge.svg)](https://github.com/AegisJSProject/disposable/actions/workflows/codeql-analysis.yml)
![Node CI](https://github.com/AegisJSProject/disposable/workflows/Node%20CI/badge.svg)
![Lint Code Base](https://github.com/AegisJSProject/disposable/workflows/Lint%20Code%20Base/badge.svg)

[![GitHub license](https://img.shields.io/github/license/AegisJSProject/disposable.svg)](https://github.com/AegisJSProject/disposable/blob/master/LICENSE)
[![GitHub last commit](https://img.shields.io/github/last-commit/AegisJSProject/disposable.svg)](https://github.com/AegisJSProject/disposable/commits/master)
[![GitHub release](https://img.shields.io/github/release/AegisJSProject/disposable?logo=github)](https://github.com/AegisJSProject/disposable/releases)
[![GitHub Sponsors](https://img.shields.io/github/sponsors/shgysk8zer0?logo=github)](https://github.com/sponsors/shgysk8zer0)

[![npm](https://img.shields.io/npm/v/@aegisjsproject/disposable)](https://www.npmjs.com/package/@aegisjsproject/disposable)
![node-current](https://img.shields.io/node/v/@aegisjsproject/disposable)
![npm bundle size gzipped](https://img.shields.io/bundlephobia/minzip/@aegisjsproject/disposable)
[![npm](https://img.shields.io/npm/dw/@aegisjsproject/disposable?logo=npm)](https://www.npmjs.com/package/@aegisjsproject/disposable)

[![GitHub followers](https://img.shields.io/github/followers/AegisJSProject.svg?style=social)](https://github.com/AegisJSProject)
![GitHub forks](https://img.shields.io/github/forks/AegisJSProject/disposable.svg?style=social)
![GitHub stars](https://img.shields.io/github/stars/AegisJSProject/disposable.svg?style=social)
[![Twitter Follow](https://img.shields.io/twitter/follow/shgysk8zer0.svg?style=social)](https://twitter.com/shgysk8zer0)

[![Donate using Liberapay](https://img.shields.io/liberapay/receives/shgysk8zer0.svg?logo=liberapay)](https://liberapay.com/shgysk8zer0/donate "Donate using Liberapay")
- - -

- [Code of Conduct](./.github/CODE_OF_CONDUCT.md)
- [Contributing](./.github/CONTRIBUTING.md)
<!-- - [Security Policy](./.github/SECURITY.md) -->

A lightweight utility library for managing resource lifecycles in the browser and Node.js. It leverages the new `DisposableStack` and `using` syntax to handle cleanup for DOM elements, Event Listeners, Blob URLs, and AbortControllers automatically.

## Installation

```bash
npm install @aegisjsproject/disposable
```

> **Note:** This library relies on modern JavaScript features including `DisposableStack`, `Promise.withResolvers`, and `Promise.try`. Ensure your environment supports them or provide polyfills.

## Features

* **DOM Integration:** Auto-remove elements and revoke Blob URLs when a scope closes.
* **AbortSignal Synergy:** Link `AbortController` lifecycles directly to the disposal stack.
* **Async Scopes:** Handle complex async flows with auto-cleanup on resolution or error.
* **Safety Guards:** Create revocable proxies that strictly enforce object access only within a specific scope.

## Usage

### The "All-In-One" Example

Manage complex async workflows where every resource (network requests, DOM elements, Blob URLs) is cleaned up automatically when the task finishes or is aborted.

```javascript
import { useAsyncDisposableStack, DisposableObjectURL, createDisposableElement } from '@aegisjsproject/disposable';

await useAsyncDisposableStack(async (stack, { signal }) => {
    // 1. Fetch a resource (aborts if the stack closes early)
    const resp = await fetch('/data.json', { signal });
    const data = await resp.blob();

    // 2. Create a Blob URL that revokes itself on dispose
    // Note: DisposableObjectURL extends String, so it works directly in template literals
    const url = stack.use(new DisposableObjectURL(data));

    // 3. Create a temporary DOM element that removes itself on dispose
    const dialog = createDisposableElement(stack, { tag: 'dialog' });
    
    dialog.innerHTML = `<img src="${url}" />`;
    document.body.append(dialog);
    dialog.showModal();

    // Keep the scope open for 5 seconds, then auto-cleanup everything
    await new Promise(resolve => setTimeout(resolve, 5000));
});
// At this point: Dialog is removed, URL is revoked, fetch signal is aborted.
```

## API Reference

### Scopes

#### `useDisposableStack(callback)`
Creates a synchronous scope. The stack is disposed immediately after the callback returns.

```javascript
useDisposableStack((stack) => {
    stack.defer(() => console.log('Cleanup'));
    // Do work...
});
```

#### `useAsyncDisposableStack(callback, { signal })`
Creates an asynchronous scope. The stack is disposed when the promise resolves, rejects, or if the optional `signal` is aborted.

* **`signal`**: An `AbortSignal` that, if triggered, will immediately abort the scope and dispose of the stack.
* **`callback` args**: `{ controller, signal, timeStamp, id }`.

```javascript
const controller = new AbortController();

await useAsyncDisposableStack(async (stack, { signal }) => {
    // This signal combines the input signal and the stack's lifecycle
    await fetch('/api', { signal });
}, { signal: controller.signal });
```

### Primitives

#### `DisposableAbortController`
Extends `AbortController`. When disposed, it automatically aborts its signal (if not already aborted).

```javascript
{
    using controller = new DisposableAbortController();
    // controller will abort automatically at the end of this block
}
```

#### `DisposableObjectURL`
Extends `String`. Wraps a `Blob` or `File` to create a URL that revokes itself upon disposal.

* **Behaves like a string:** Can be used in `img.src` or template literals.
* **Revocable:** Calls `URL.revokeObjectURL` on dispose.

```javascript
{
  using url = new DisposableObjectURL(blob);
  img.src = url; // Works directly
  // Revokes the object URL automatically
}
```

#### `DisposableTask`
A wrapper around `scheduler.postTask` that is integrated with disposal.

* Auto-aborts the task if the object is disposed before completion.
* Provides standard Promise methods (`then`, `catch`, `finally`).

```javascript
using task = new DisposableTask(() => heavyComputation(), { priority: 'background' });
// Task is aborted if not executed when leaving scope
```

#### `createDisposableElement(stack, config)`
Creates a DOM element that is automatically `remove()`'d from the DOM when the stack is disposed.

* `config.tag`: The HTML tag name (default: `'div'`).
* `config.attrs`: All other properties are set as attributes on the element.

```javascript
using stack = new DisposableStack();

const spinner = createDisposableElement(stack, { 
    tag: 'div', 
    class: 'loader',
    'aria-busy': 'true' 
});
document.body.append(spinner);
// Spinner is removed from DOM automatically when stack disposes
```

#### `guard(stack, target, handler)`
Creates a `Proxy` that becomes unusable (throws `TypeError`) once the stack is disposed. Useful for preventing memory leaks or access to stale objects.

```javascript
const state = { sensitive: true };
const safeState = guard(stack, state);
// safeState is usable here
// ... stack disposes ...
console.log(safeState.sensitive); // Throws TypeError
```

#### `whenDisposed(stack, { signal })`
Returns a `Promise<void>` that resolves when the provided stack is disposed.

```javascript
const stack = new DisposableStack();

whenDisposed(stack).then(() => {
  console.log('Stack is now clean');
});

stack.dispose();
```
