import * as util from "./util";
import Layer from "./layer";
import arrowsVert from "./shaders/arrows.vert.glsl";
import arrowsFrag from "./shaders/arrows.frag.glsl";

class Arrows extends Layer {
  constructor(options) {
    this.propertySpec = {
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
      "particle-color": {
        type: "color",
        default: "white",
        expression: {
          interpolated: true,
          parameters: ["zoom", "feature"]
        },
        "property-type": "data-driven"
      },
      "particle-halo-color": {
        type: "color",
        default: "rgba(0,0,0,0)",
        expression: {
          interpolated: true,
          parameters: ["zoom"]
        },
        "property-type": "data-constant"
      }
    };
    super(options);
  }

  initialize(map, gl) {
    this.arrowsProgram = util.createProgram(gl, arrowsVert, arrowsFrag);
    this.initializeGrid();
  }

  setParticleColor(expr) {
    this.buildColorRamp(expr);
  }

  initializeGrid() {
    this.cols = this.windData.width;
    this.rows = this.windData.height;
    const numTriangles = this.rows * this.cols * 2;
    const numVertices = numTriangles * 3;
    const positions = new Float32Array(2 * numVertices);
    const corners = new Float32Array(2 * numVertices);
    console.log(this.cols, this.rows);
    for (let i = 0; i < this.cols; i++) {
      for (let j = 0; j < this.rows; j++) {
        const index = (i * this.rows + j) * 12;
        positions.set([i, j, i, j, i, j, i, j, i, j, i, j], index);
        corners.set([-1, 1, 1, 1, 1, -1, -1, 1, 1, -1, -1, -1], index);
      }
    }
    this.positionsBuffer = util.createBuffer(this.gl, positions);
    this.cornerBuffer = util.createBuffer(this.gl, corners);
    console.log(positions, corners);
  }

  computeDimensions(gl, map) {
    if (
      map.getBounds().getEast() - 180 - (map.getBounds().getWest() + 180) >
      0
    ) {
      return [gl.canvas.height, gl.canvas.height];
    } else {
      return [gl.canvas.width, gl.canvas.height];
    }
  }

  draw(gl, matrix, dateLineOffset) {
    const program = this.arrowsProgram;
    gl.useProgram(program.program);

    util.bindAttribute(gl, this.positionsBuffer, program.a_pos, 2);
    util.bindAttribute(gl, this.cornerBuffer, program.a_corner, 2);

    util.bindTexture(gl, this.windTexture, 0);
    util.bindTexture(gl, this.colorRampTexture, 2);

    gl.uniform1i(program.u_wind, 0);
    gl.uniform1i(program.u_color_ramp, 2);

    // compute downsampling
    const [w, h] = this.computeDimensions(gl, this.map);
    const z = this.map.getZoom();
    const cols = Math.min(
      Math.floor((Math.floor(z + 1) * w) / this.arrowMinSize),
      this.cols
    );
    const rows = Math.min(
      Math.floor((Math.floor(z + 1) * h) / this.arrowMinSize),
      this.rows
    );

    gl.uniform2f(program.u_dimensions, cols, rows);

    gl.uniform2f(program.u_wind_res, this.windData.width, this.windData.height);
    gl.uniform2f(program.u_wind_min, this.windData.uMin, this.windData.vMin);
    gl.uniform2f(program.u_wind_max, this.windData.uMax, this.windData.vMax);
    gl.uniform1f(program.u_dateline_offset, dateLineOffset);
    gl.uniform4f(
      program.u_halo_color,
      this.particleHaloColor.r,
      this.particleHaloColor.g,
      this.particleHaloColor.b,
      this.particleHaloColor.a
    );

    gl.uniformMatrix4fv(program.u_matrix, false, matrix);

    // if these were put in a smarter order, we could optimize this call further
    gl.drawArrays(gl.TRIANGLES, 0, this.rows * Math.floor(cols) * 6);
  }
}

export default options => new Arrows(options);
