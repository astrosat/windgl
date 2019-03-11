import * as util from "./util";
import { expression } from "mapbox-gl/dist/style-spec";

export default class Layer {
  constructor({ id, source, ...options }) {
    this.id = id;
    this.type = "custom";
    this.renderingMode = "2d";
    this.source = source;
    this._zoomUpdatable = {};
    this._propsOnInit = {};

    this.source.loadTile(0, 0, 0, this.setWind.bind(this));

    Object.keys(this.propertySpec).forEach(spec => {
      this.setProperty(spec, options[spec] || this.propertySpec[spec].default);
    });
  }

  setProperty(prop, value) {
    const spec = this.propertySpec[prop];
    const expr = expression.createPropertyExpression(value, spec);
    if (expr.result === "success") {
      const name = prop
        .split("-")
        .map(a => a[0].toUpperCase() + a.slice(1))
        .join("");
      switch (expr.value.kind) {
        case "camera":
        case "composite":
          return (this._zoomUpdatable[prop] = expr.value);
        default:
          if (this.map) {
            return this._setPropertyValue(prop, expr.value);
          } else {
            return (this._propsOnInit[prop] = expr.value);
          }
      }
    } else {
      throw new Error(expr.value);
    }
  }

  _setPropertyValue(prop, value) {
    const name = prop
      .split("-")
      .map(a => a[0].toUpperCase() + a.slice(1))
      .join("");
    const setterName = "set" + name;
    if (this[setterName]) {
      this[setterName](value);
    } else {
      this[name[0].toLowerCase() + name.slice(1)] = value.evaluate({
        zoom: this.map && this.map.getZoom()
      });
    }
  }

  buildColorRamp(expr) {
    const colors = new Uint8Array(256 * 4);
    let range = 1;
    if (expr.kind === "source" || expr.kind === "composite") {
      const u = this.windData.uMax - this.windData.uMin;
      const v = this.windData.vMax - this.windData.vMin;

      range = Math.sqrt(u * u + v * v);
    }

    for (let i = 0; i < 256; i++) {
      const color = expr.evaluate(
        expr.kind === "constant" || expr.kind === "source"
          ? {}
          : { zoom: this.map.zoom },
        { properties: { speed: (i / 255) * range } }
      );
      colors[i * 4 + 0] = color.r * 255;
      colors[i * 4 + 1] = color.g * 255;
      colors[i * 4 + 2] = color.b * 255;
      colors[i * 4 + 3] = color.a * 255;
    }
    this.colorRampTexture = util.createTexture(
      this.gl,
      this.gl.LINEAR,
      colors,
      16,
      16
    );
  }

  setWind(windData) {
    this.windData = windData;
    if (this.map) {
      this._initialize();
      this.map.triggerRepaint();
    }
  }

  onAdd(map, gl) {
    this.gl = gl;
    this.map = map;
    this.initialize(map, gl);
    if (this.windData) {
      this._initialize();
    }
  }

  _initialize() {
    this.windTexture = this.windData.getTexture(this.gl);
    map.on("resize", this.resize.bind(this));
    Object.entries(this._propsOnInit).forEach(([k, v]) => {
      this._setPropertyValue(k, v);
    });
    this._propsOnInit = {};
    Object.entries(this._zoomUpdatable).forEach(([k, v]) => {
      this._setPropertyValue(k, v);
    });
    map.on("zoom", this.zoom.bind(this));
  }

  zoom() {
    Object.entries(this._zoomUpdatable).forEach(([k, v]) => {
      this._setPropertyValue(k, v);
    });
  }

  resize() {}

  onRemove(map) {
    delete this.gl;
    delete this.map;
    map.off("resize", this.resize);
    map.off("zoom", this.zoom);
  }

  render(gl, matrix) {
    if (this.windData) {
      const bounds = this.map.getBounds();
      const eastIter = Math.max(0, Math.ceil((bounds.getEast() - 180) / 360));
      const westIter = Math.max(0, Math.ceil((bounds.getWest() + 180) / -360));
      this.draw(gl, matrix, 0);
      for (let i = 1; i <= eastIter; i++) {
        this.draw(gl, matrix, i);
      }
      for (let i = 1; i <= westIter; i++) {
        this.draw(gl, matrix, -i);
      }
    }
  }
}
