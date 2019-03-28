import glsl from "glslify";
import * as GLSLX from "glslx";
import { createShaderOutput, createShaderImage } from "./runShader";
import { configureToMatchImageSnapshot } from "jest-image-snapshot";
import createShader from "gl-shader";

import * as util from "../src/util";

expect.extend({
  toMatchImageSnapshot: configureToMatchImageSnapshot({
    customDiffConfig: { threshold: 0.1 }
  })
});

const coordinateTransform = glsl`
  precision highp float;
  #pragma glslify: wgs84ToMercator = require('../src/shaders/wgs84ToMercator')

  uniform vec2 u_input;

  void main() {
      gl_FragColor = vec4(wgs84ToMercator(u_input), 0, 1);
  }
`;

const draw = createShaderOutput(coordinateTransform);

const wgs84ToMercator = coords =>
  Array.from(draw({ u_input: coords }).slice(0, 2));

describe("wgs84ToMercator", () => {
  test("equator in the middle", () => {
    const result = wgs84ToMercator([0.5, 0.5]);
    expect(result[0]).toBeCloseTo(0.5);
    expect(result[1]).toBeCloseTo(0.5);
  });

  test("round trips", () => {
    const reverseCoordinateTransform = glsl`
          precision highp float;
          #pragma glslify: mercatorToWGS84 = require('../src/shaders/mercatorToWGS84')

          uniform vec2 u_input;

          void main() {
              gl_FragColor = vec4(mercatorToWGS84(u_input), 0, 1);
          }
        `;

    const drawReverse = createShaderOutput(reverseCoordinateTransform);
    const mercatorToWGS84 = coords =>
      Array.from(drawReverse({ u_input: coords }).slice(0, 2));

    // mercator is messy around the poles...
    for (let i = 0.1; i <= 1; i += 0.1) {
      const result = mercatorToWGS84(wgs84ToMercator([i, i]));
      expect(result[0]).toBeCloseTo(i);
      expect(result[1]).toBeCloseTo(i);
    }
  });

  test("half way", () => {
    const result = wgs84ToMercator([0.25, 0.25]);
    expect(result[0]).toBeCloseTo(0.25);
    expect(result[1]).toBeCloseTo(0.359725036915205);
  });
});

describe("arrows", () => {
  const res = GLSLX.compile(
    glsl.file("../src/shaders/arrow.glsl").replace("#define GLSLIFY 1\n", ""),
    {
      disableRewriting: false,
      format: "json",
      keepSymbols: false,
      prettyPrint: true,
      renaming: "none"
    }
  );
  const arrowFrag = JSON.parse(res.output).shaders.filter(
    s => s.name === "arrowFragment"
  )[0].contents;

  const shader = gl => {
    const shdr = createShader(
      gl,
      glsl`
          attribute vec2 position;
          varying vec2 v_center;
          varying float v_speed;
          varying float v_size;
          uniform float size;
          uniform float speed;

          void main() {
              v_center = position;
              v_size = size;
              v_speed = speed;
              gl_Position = vec4(position, 0.0, 1.0);
          }
      `,
      arrowFrag
    );
    const texture = util.createTexture(
      gl,
      gl.LINEAR,
      new Uint8Array([255, 255, 255, 255, 255, 0, 0, 255]),
      1,
      2
    );
    util.bindTexture(gl, texture, 0);
    return shdr;
  };
  const draw = createShaderImage(shader, { width: 100, height: 100 });
  test("draws a nice arrow", () => {
    expect(
      draw({
        speed: 0,
        size: 0.2,
        u_color_ramp: 0
      })
    ).toMatchImageSnapshot();
  });

  test("draws a longer red arrow", () => {
    expect(
      draw({
        speed: 0.95,
        size: 0.3,
        u_color_ramp: 0
      })
    ).toMatchImageSnapshot();
  });
});
