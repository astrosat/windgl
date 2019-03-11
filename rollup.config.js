import buble from "rollup-plugin-buble";
import glslify from "rollup-plugin-glslify";
import pkg from "./package.json";

export default {
  input: "src/index.js",
  output: [
    { file: pkg.browser, format: "umd", name: "windGL" },
    { file: pkg.main, format: "cjs" },
    { file: pkg.module, format: "es" }
  ],
  plugins: [glslify({ include: "./src/shaders/*.glsl" }), buble()]
};
