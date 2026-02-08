import terser from '@rollup/plugin-terser';

export default [{
	input: 'disposable.js',
	output: [{
		file: 'disposable.cjs',
		format: 'cjs',
	}, {
		file: 'disposable.min.js',
		format: 'module',
		plugins: [terser()],
		sourcemap: true,
	}, {
		file: 'disposable.mjs',
		format: 'module',
	}],
}];
