import * as util from "./util";
import quadVert from "./shaders/quad.vert.glsl";

import screenFrag from "./shaders/screen.frag.glsl";

class WindGL {
  constructor({ id, source, properties = {} }) {
    this.id = id;
    this.type = "custom";
    this.renderingMode = "2d";
    this.setSource(source);

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

  setSource({ url }) {
    getJSON(url, windData => {
      const windImage = new Image();
      windData.image = windImage;
      const url = windData.tiles[0].replace(/{(z|x|y)}/g, "0");
      if (new URL(url).origin !== window.location.origin) {
        windImage.crossOrigin = "anonymous";
      }
      windImage.src = url;
      windImage.onload = () => this.setWind(windData);
    });
  }

  setWind(windData) {
    this.windData = windData;
    this.windTexture = util.createTexture(
      this.gl,
      this.gl.LINEAR,
      windData.image
    );
    if (this.map) {
      this.map.triggerRepaint();
    }
  }

  onAdd(map, gl) {
    this.gl = gl;
    this.map = map;

    this.screenProgram = util.createProgram(gl, quadVert, screenFrag);

    map.on("resize", this.resize);

    this.quadBuffer = util.createBuffer(
      gl,
      new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1])
    );

    this.setColorRamp(gl, this._colorRamp);
  }

  onRemove(map) {
    delete this.gl;
    delete this.map;
    map.off("resize", this.resize);
  }

  render(gl, matrix) {
    if (this.windData) {
      // util.bindTexture(gl, this.windTexture, 0);
      this.drawTexture(this.windTexture, 0.5, matrix);
      // this.map.triggerRepaint();
    }
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

  drawTexture(texture, opacity, matrix) {
    console.log(matrix, this.gl);
    const gl = this.gl;
    const program = this.screenProgram;
    gl.useProgram(program.program);

    util.bindAttribute(gl, this.quadBuffer, program.a_pos, 2);

    util.bindTexture(gl, texture, 0);
    util.bindTexture(gl, this.colorRampTexture, 2);

    gl.uniform1i(program.u_wind, 0);
    gl.uniform1i(program.u_color_ramp, 2);

    gl.uniform1f(program.u_opacity, opacity);
    gl.uniform2f(program.u_wind_res, this.windData.width, this.windData.height);
    gl.uniform2f(program.u_wind_min, this.windData.uMin, this.windData.vMin);
    gl.uniform2f(program.u_wind_max, this.windData.uMax, this.windData.vMax);
    gl.uniformMatrix4fv(program.u_matrix, false, matrix);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
}

function getJSON(url, callback) {
  const xhr = new XMLHttpRequest();
  xhr.responseType = "json";
  xhr.open("get", url, true);
  xhr.onload = function() {
    if (xhr.status >= 200 && xhr.status < 300) {
      callback(xhr.response);
    } else {
      throw new Error(xhr.statusText);
    }
  };
  xhr.send();
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

export default options => new WindGL(options);
