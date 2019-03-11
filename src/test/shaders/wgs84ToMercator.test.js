import glsl from "glslify";
import createShaderOutput from "nogl-shader-output";

const coordinateTransform = glsl`
  #pragma glslify: wgs84ToMercator = require('../../../src/shaders/wgs84ToMercator')

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
          #pragma glslify: mercatorToWGS84 = require('../../../src/shaders/mercatorToWGS84')

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
