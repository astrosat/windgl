import glsl from "rollup-plugin-glsl";
import buble from "rollup-plugin-buble";
import pkg from "./package.json";

export default {
  input: "src/index.js",
  output: [
    { file: pkg.browser, format: "umd", name: "windGL" },
    { file: pkg.main, format: "cjs" },
    { file: pkg.module, format: "es" }
  ],
  plugins: [glsl({ include: "./src/shaders/*.glsl" }), buble()]
};
