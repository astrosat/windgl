import * as util from "./util";
import Layer from "./layer";

import { sampleFill } from "./shaders/sampleFill.glsl";

class SampleFill extends Layer {
  constructor(options) {
    super(
      {
        "sample-fill-color": {
          type: "color",
          default: [
            "interpolate",
            ["linear"],
            ["get", "speed"],
            0.0,
            "#3288bd",
            10,
            "#66c2a5",
            20,
            "#abdda4",
            30,
            "#e6f598",
            40,
            "#fee08b",
            50,
            "#fdae61",
            60,
            "#f46d43",
            100.0,
            "#d53e4f"
          ],
          doc: "The color of each pixel of this layer",
          expression: {
            interpolated: true,
            parameters: ["zoom", "feature"]
          },
          "property-type": "data-driven"
        },
        "sample-opacity": {
          type: "number",
          default: 1,
          minimum: 0,
          maximum: 1,
          transition: true,
          expression: {
            interpolated: true,
            parameters: ["zoom"]
          },
          "property-type": "data-constant"
        }
      },
      options
    );
    this.pixelToGridRatio = 20;
  }

  initialize(map, gl) {
    this.backgroundProgram = sampleFill(gl);

    this.quadBuffer = util.createBuffer(
      gl,
      new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1])
    );
  }

  setSampleFillColor(expr) {
    this.buildColorRamp(expr);
  }

  draw(gl, matrix, tile, offset) {
    const opacity = this.sampleOpacity;
    const program = this.backgroundProgram;
    gl.useProgram(program.program);

    util.bindAttribute(gl, this.quadBuffer, program.a_pos, 2);

    util.bindTexture(gl, tile.getTexture(gl), 0);
    util.bindTexture(gl, this.colorRampTexture, 2);

    gl.uniform1i(program.u_wind, 0);
    gl.uniform1i(program.u_color_ramp, 2);

    gl.uniform1f(program.u_opacity, opacity);
    gl.uniformMatrix4fv(program.u_offset, false, offset);
    gl.uniformMatrix4fv(
      program.u_offset_inverse,
      false,
      util.matrixInverse(offset)
    );
    gl.uniform2f(program.u_wind_res, this.windData.width, this.windData.height);
    gl.uniform2f(program.u_wind_min, this.windData.uMin, this.windData.vMin);
    gl.uniform2f(program.u_wind_max, this.windData.uMax, this.windData.vMax);
    gl.uniformMatrix4fv(program.u_matrix, false, matrix);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
}

export default options => new SampleFill(options);
