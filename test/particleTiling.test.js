import particles from "../src/particles";
import tile from "../src/tileID";
import "geometry-polyfill";

// because geometry-polyfill is kinda buggy
window.DOMMatrix.prototype.transformPoint = function(point) {
  let x = point.x;
  let y = point.y;
  let z = point.z;
  let w = point.w;

  let nx = this.m11 * x + this.m21 * y + this.m31 * z + this.m41 * w;
  let ny = this.m12 * x + this.m22 * y + this.m32 * z + this.m42 * w;
  let nz = this.m13 * x + this.m23 * y + this.m33 * z + this.m43 * w;
  let nw = this.m14 * x + this.m24 * y + this.m34 * z + this.m44 * w;

  return new DOMPoint(nx, ny, nz, nw);
};

jest.mock("../src/shaders/particles.glsl", () => "");

expect.extend({
  // this tests matrices by transforming the points (0,0), (0.5, 0.5) and (1,1)
  // and compares them to the passed values. I find this a lot more intuitive
  // than trying to work out the 16 correct values for a matrix
  toTransformPoints(matrix, zero, half, full) {
    let m = new window.DOMMatrix(matrix);
    let a = m.transformPoint(new window.DOMPoint(0, 0));
    let b = m.transformPoint(new window.DOMPoint(0.5, 0.5));
    let c = m.transformPoint(new window.DOMPoint(1, 1));

    return {
      pass:
        this.equals(new window.DOMPoint(...zero), a) &&
        this.equals(new window.DOMPoint(...half), b) &&
        this.equals(new window.DOMPoint(...full), c),
      message: () => `${this.utils.matcherHint(
        "toTransformPoints",
        undefined,
        undefined,
        { comment: "matrix testing", isNot: this.isNot, promise: this.promise }
      )}

(0.0, 0.0) : ${this.utils.EXPECTED_COLOR(
        `(${zero[0]}, ${zero[1]})`
      )} vs ${this.utils.RECEIVED_COLOR(`(${a.x}, ${a.y})`)}
(0.5, 0.5) : ${this.utils.EXPECTED_COLOR(
        `(${half[0]}, ${half[1]})`
      )} v ${this.utils.RECEIVED_COLOR(`(${b.x}, ${b.y})`)}
(1.0, 1.0): ${this.utils.EXPECTED_COLOR(
        `(${full[0]}, ${full[1]})`
      )} => ${this.utils.RECEIVED_COLOR(`(${c.x}, ${c.y})`)}
`
    };
  }
});

describe("findAssociatedDataTiles", () => {
  let layer;

  beforeEach(() => {
    layer = particles({ id: "particles", source: { metadata: jest.fn() } });
  });

  test("when no source tiles present, returns null", () => {
    const result = layer.findAssociatedDataTiles(tile(4, 3, 3));
    expect(result).toBeUndefined();
  });

  test("when not all source tiles present, returns null", () => {
    layer._tiles[tile(4, 2, 2)] = tile(4, 2, 2);
    layer._tiles[tile(4, 2, 3)] = tile(4, 2, 3);
    layer._tiles[tile(4, 2, 4)] = tile(4, 2, 4);
    layer._tiles[tile(4, 3, 2)] = tile(4, 3, 2);
    layer._tiles[tile(4, 3, 3)] = tile(4, 3, 3);
    layer._tiles[tile(4, 3, 4)] = tile(4, 3, 4);
    layer._tiles[tile(4, 4, 2)] = tile(4, 4, 2);
    layer._tiles[tile(4, 4, 3)] = tile(4, 4, 3);
    const result = layer.findAssociatedDataTiles(tile(4, 3, 3));
    expect(result).toBeUndefined();
  });

  test("when all source tiles present, returns appropriate result", () => {
    layer._tiles[tile(4, 2, 2)] = tile(4, 2, 2);
    layer._tiles[tile(4, 2, 3)] = tile(4, 2, 3);
    layer._tiles[tile(4, 2, 4)] = tile(4, 2, 4);
    layer._tiles[tile(4, 3, 2)] = tile(4, 3, 2);
    layer._tiles[tile(4, 3, 3)] = tile(4, 3, 3);
    layer._tiles[tile(4, 3, 4)] = tile(4, 3, 4);
    layer._tiles[tile(4, 4, 2)] = tile(4, 4, 2);
    layer._tiles[tile(4, 4, 3)] = tile(4, 4, 3);
    layer._tiles[tile(4, 4, 4)] = tile(4, 4, 4);
    const result = layer.findAssociatedDataTiles(tile(4, 3, 3));
    expect(result).toEqual({
      matrix: expect.any(Float32Array),
      tileTopLeft: layer._tiles[tile(4, 2, 2)],
      tileTopCenter: layer._tiles[tile(4, 3, 2)],
      tileTopRight: layer._tiles[tile(4, 4, 2)],
      tileMiddleLeft: layer._tiles[tile(4, 2, 3)],
      tileMiddleCenter: layer._tiles[tile(4, 3, 3)],
      tileMiddleRight: layer._tiles[tile(4, 4, 3)],
      tileBottomLeft: layer._tiles[tile(4, 2, 4)],
      tileBottomCenter: layer._tiles[tile(4, 3, 4)],
      tileBottomRight: layer._tiles[tile(4, 4, 4)]
    });

    expect(result.matrix).toTransformPoints(
      [-0.5, -0.5],
      [0.5, 0.5],
      [1.5, 1.5]
    );
  });

  test("when only parent tile present, returns appropriate result", () => {
    layer._tiles[tile(3, 1, 1)] = tile(3, 1, 1); // parent
    layer._tiles[tile(3, 2, 1)] = tile(3, 2, 1);
    layer._tiles[tile(3, 1, 2)] = tile(3, 1, 2);
    layer._tiles[tile(3, 2, 2)] = tile(3, 2, 2);

    const result = layer.findAssociatedDataTiles(tile(4, 3, 3));
    expect(result).toEqual(
      expect.objectContaining({
        matrix: expect.any(Float32Array),
        tileMiddleCenter: layer._tiles[tile(3, 1, 1)],
        tileMiddleRight: layer._tiles[tile(3, 2, 1)],
        tileBottomCenter: layer._tiles[tile(3, 1, 2)],
        tileBottomRight: layer._tiles[tile(3, 2, 2)]
      })
    );
    expect(result.matrix).toTransformPoints(
      [0.25, 0.25],
      [0.75, 0.75],
      [1.25, 1.25]
    );
  });
});
