import string from 'rollup-plugin-string';
import buble from 'rollup-plugin-buble';
import pkg from "./package.json";

export default {
    input: 'src/index.js',
    output: [
        {file: pkg.browser, format: 'umd', name: 'windGL'},
        {file: pkg.main, format: 'cjs'},
        {file: pkg.module, format: 'es'}
    ],
    plugins: [
        string({include: './src/shaders/*.glsl'}),
        buble()
    ]
};
