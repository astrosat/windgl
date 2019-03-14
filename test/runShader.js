import webglContext from "gl";
import glShaderOutput from "gl-shader-output";
import { PNG } from "pngjs";

export const createShaderOutput = (src, opts) => {
  const gl = webglContext(1, 1);
  const ext = gl.getExtension("STACKGL_resize_drawingbuffer");
  gl.canvas = {
    _w: 1,
    _h: 1,
    get width() {
      return this._w;
    },
    set width(v) {
      this._w = v;
      ext.resize(this._w, this._h);
    },
    get height() {
      return this._h;
    },
    set height(v) {
      this._h = v;
      ext.resize(this._w, this._h);
    }
  };
  return glShaderOutput(src, Object.assign({ gl }, opts));
};

export const createShaderImage = (src, opts) => {
  const { width, height } = opts;
  const draw = createShaderOutput(src, opts);
  return params => {
    const output = draw(params);
    const png = new PNG({
      colorType: 2,
      filterType: 4,
      width,
      height
    });
    png.data = output.map(v => Math.floor(v * 255));
    return PNG.sync.write(png);
  };
};
