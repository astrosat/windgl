import glsl from "glslify";
import { createShaderOutput, createShaderImage } from "./runShader";
import { toMatchImageSnapshot } from "jest-image-snapshot";
import createShader from "gl-shader";

import * as util from "../src/util";

expect.extend({ toMatchImageSnapshot });

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
    expect(result[0]).toBeCloseTo(0.5, 4);
    expect(result[1]).toBeCloseTo(0.5, 4);
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
      expect(result[0]).toBeCloseTo(i, 4);
      expect(result[1]).toBeCloseTo(i, 4);
    }
  });

  test("half way", () => {
    const result = wgs84ToMercator([0.25, 0.25]);
    expect(result[0]).toBeCloseTo(0.25, 4);
    expect(result[1]).toBeCloseTo(0.359725036915205, 4);
  });
});

describe("arrows", () => {
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
      glsl.file("../src/shaders/arrows.frag.glsl")
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
