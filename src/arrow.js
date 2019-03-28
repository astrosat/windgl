import * as util from "./util";
import Layer from "./layer";
import { arrow } from "./shaders/arrow.glsl";

class Arrows extends Layer {
  constructor(options) {
    super(
      {
        "arrow-min-size": {
          type: "number",
          minimum: 1,
          default: 40,
          expression: {
            interpolated: true,
            parameters: ["zoom"]
          },
          "property-type": "data-constant"
        },
        "arrow-color": {
          type: "color",
          default: "white",
          expression: {
            interpolated: true,
            parameters: ["zoom", "feature"]
          },
          "property-type": "data-driven"
        },
        "arrow-halo-color": {
          type: "color",
          default: "rgba(0,0,0,0)",
          expression: {
            interpolated: true,
            parameters: ["zoom"]
          },
          "property-type": "data-constant"
        }
      },
      options
    );
    this.pixelToGridRatio = 25;
  }

  initialize(map, gl) {
    this.arrowsProgram = arrow(gl);
    this.initializeGrid();
  }

  setArrowColor(expr) {
    this.buildColorRamp(expr);
  }

  initializeGrid() {
    this.cols = this.windData.width;
    this.rows = this.windData.height;
    const numTriangles = this.rows * this.cols * 2;
    const numVertices = numTriangles * 3;
    const positions = new Float32Array(2 * numVertices);
    const corners = new Float32Array(2 * numVertices);
    for (let i = 0; i < this.cols; i++) {
      for (let j = 0; j < this.rows; j++) {
        const index = (i * this.rows + j) * 12;
        positions.set([i, j, i, j, i, j, i, j, i, j, i, j], index);
        corners.set([-1, 1, 1, 1, 1, -1, -1, 1, 1, -1, -1, -1], index);
      }
    }
    this.positionsBuffer = util.createBuffer(this.gl, positions);
    this.cornerBuffer = util.createBuffer(this.gl, corners);
  }

  /**
   * This figures out the ideal number or rows and columns to show.
   *
   * NB: Returns [cols, rows] as that is [x,y] which makes more sense.
   */
  computeDimensions(gl, map, minSize, cols, rows) {
    // If we are rendering multiple copies of the world, then we only care
    // about the square in the middle, as other code will take care of the
    // aditional coppies.
    const [w, h] =
      map.getBounds().getEast() - 180 - (map.getBounds().getWest() + 180) > 0
        ? [gl.canvas.height, gl.canvas.height]
        : [gl.canvas.width, gl.canvas.height];

    const z = map.getZoom();

    // Either we show the grid size of the data, or we show fewer such
    // that these should be about ~minSize.
    return [
      Math.min(Math.floor((Math.floor(z + 1) * w) / minSize), cols) - 1,
      Math.min(Math.floor((Math.floor(z + 1) * h) / minSize), rows) - 1
    ];
  }

  draw(gl, matrix, tile, offset) {
    const program = this.arrowsProgram;
    gl.useProgram(program.program);

    util.bindAttribute(gl, this.positionsBuffer, program.a_pos, 2);
    util.bindAttribute(gl, this.cornerBuffer, program.a_corner, 2);

    util.bindTexture(gl, tile.getTexture(gl), 0);
    util.bindTexture(gl, this.colorRampTexture, 2);

    gl.uniform1i(program.u_wind, 0);
    gl.uniform1i(program.u_color_ramp, 2);
    const [cols, rows] = this.computeDimensions(
      gl,
      this.map,
      this.arrowMinSize,
      this.cols,
      this.rows
    );
    gl.uniform2f(program.u_dimensions, cols, rows);

    gl.uniform2f(program.u_wind_res, this.windData.width, this.windData.height);
    gl.uniform2f(program.u_wind_min, this.windData.uMin, this.windData.vMin);
    gl.uniform2f(program.u_wind_max, this.windData.uMax, this.windData.vMax);
    gl.uniformMatrix4fv(program.u_offset, false, offset);
    gl.uniform4f(
      program.u_halo_color,
      this.arrowHaloColor.r,
      this.arrowHaloColor.g,
      this.arrowHaloColor.b,
      this.arrowHaloColor.a
    );

    gl.uniformMatrix4fv(program.u_matrix, false, matrix);

    // if these were put in a smarter order, we could optimize this call further
    gl.drawArrays(gl.TRIANGLES, 0, this.rows * Math.floor(cols) * 6);
  }
}

export default options => new Arrows(options);
