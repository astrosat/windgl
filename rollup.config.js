import buble from "rollup-plugin-buble";
import glslify from "rollup-plugin-glslify";
import pkg from "./package.json";
import commonjs from "rollup-plugin-commonjs";
import resolve from "rollup-plugin-node-resolve";

const plugins = [
  glslify({ include: "./src/shaders/*.glsl" }),
  resolve(),
  commonjs({
    namedExports: {
      "node_modules/mapbox-gl/dist/style-spec/index.js": ["expression"]
    }
  }),
  buble()
];

export default [
  {
    input: "demo.js",
    output: [{ file: "docs/index.js", format: "iife" }],
    plugins
  },
  {
    input: "src/index.js",
    output: [{ file: pkg.browser, format: "umd", name: "windGL" }],
    plugins
  },
  {
    input: "src/index.js",
    output: [
      {
        file: pkg.main,
        format: "cjs"
      },
      {
        file: pkg.module,
        format: "es"
      }
    ],
    external: ["mapbox-gl/dist/style-spec"],
    plugins
  }
];
