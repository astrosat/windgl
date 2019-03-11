import * as util from "./util";
import Layer from "./layer";

import backgroundVert from "./shaders/background.vert.glsl";
import backgroundFrag from "./shaders/background.frag.glsl";

class Background extends Layer {
  constructor(options) {
    super(options);

    this._colorRamp = [
      0.0,
      "#3288bd",
      0.1,
      "#66c2a5",
      0.2,
      "#abdda4",
      0.3,
      "#e6f598",
      0.4,
      "#fee08b",
      0.5,
      "#fdae61",
      0.6,
      "#f46d43",
      1.0,
      "#d53e4f"
    ];
  }

  initialize(map, gl) {
    this.backgroundProgram = util.createProgram(
      gl,
      backgroundVert,
      backgroundFrag
    );

    this.quadBuffer = util.createBuffer(
      gl,
      new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1])
    );

    this.setColorRamp(gl, this._colorRamp);
  }

  setColorRamp(gl, colors) {
    // lookup texture for colorizing the particles according to their speed
    this.colorRampTexture = util.createTexture(
      gl,
      gl.LINEAR,
      getColorRamp(colors),
      16,
      16
    );
  }

  draw(gl, matrix, dateLineOffset) {
    const opacity = 0.9;
    const program = this.backgroundProgram;
    gl.useProgram(program.program);

    util.bindAttribute(gl, this.quadBuffer, program.a_pos, 2);

    util.bindTexture(gl, this.windTexture, 0);
    util.bindTexture(gl, this.colorRampTexture, 2);

    gl.uniform1i(program.u_wind, 0);
    gl.uniform1i(program.u_color_ramp, 2);

    gl.uniform1f(program.u_opacity, opacity);
    gl.uniform1f(program.u_dateline_offset, dateLineOffset);
    gl.uniform2f(program.u_wind_res, this.windData.width, this.windData.height);
    gl.uniform2f(program.u_wind_min, this.windData.uMin, this.windData.vMin);
    gl.uniform2f(program.u_wind_max, this.windData.uMax, this.windData.vMax);
    gl.uniformMatrix4fv(program.u_matrix, false, matrix);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
}

function getColorRamp(colors) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  canvas.width = 256;
  canvas.height = 1;

  const gradient = ctx.createLinearGradient(0, 0, 256, 0);
  for (let i = 0; i < colors.length; i += 2) {
    gradient.addColorStop(+colors[i], colors[i + 1]);
  }

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 1);

  return new Uint8Array(ctx.getImageData(0, 0, 256, 1).data);
}

export default options => new Background(options);
