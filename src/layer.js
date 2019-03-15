import * as util from "./util";
import { expression } from "mapbox-gl/dist/style-spec";

/**
 * This is an abstract base class that handles most of the mapbox specific
 * stuff as well as a lot of the bookkeeping.
 */
export default class Layer {
  constructor(propertySpec, { id, source, ...options }) {
    this.id = id;
    this.type = "custom";
    this.renderingMode = "2d";
    this.source = source;
    this.propertySpec = propertySpec;

    this._zoomUpdatable = {};
    this._propsOnInit = {};

    this.source.loadTile(0, 0, 0, this.setWind.bind(this));

    // This will initialize the default values
    Object.keys(this.propertySpec).forEach(spec => {
      this.setProperty(spec, options[spec] || this.propertySpec[spec].default);
    });
  }

  /**
   * Update a property using a mapbox style epxression.
   */
  setProperty(prop, value) {
    const spec = this.propertySpec[prop];
    if (!spec) return;
    const expr = expression.createPropertyExpression(value, spec);
    if (expr.result === "success") {
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

  // Child classes can interact with style properties in 2 ways:
  // Either as a camelCased instance variable or by declaring a
  // a setter function which will recieve the *expression* and
  // it is their responsibility to evaluate it.
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

  // Properties that use data drive styling (i.e. ["get", "speed"]),
  // will want to use this method. Since all speed values are evalutated
  // on the GPU side, but expressions are evaluated on the CPU side,
  // we need to evaluate the expression eagerly. We do it here by sampling
  // 256 possible speed values in the range of the dataset and storing
  // those in a 16x16 texture. The shaders than can simply pick the appropriate
  // pixel to determine the correct color.
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

  // called by mapboxgl
  onAdd(map, gl) {
    this.gl = gl;
    this.map = map;
    if (this.windData) {
      this._initialize();
    }
  }

  // This will be called when we have everything we need:
  // the gl context and the data
  // we will call child classes `initialize` as well as do a bunch of
  // stuff to get the properties in order
  _initialize() {
    this.initialize(this.map, this.gl);
    this.windTexture = this.windData.getTexture(this.gl);
    Object.entries(this._propsOnInit).forEach(([k, v]) => {
      this._setPropertyValue(k, v);
    });
    this._propsOnInit = {};
    Object.entries(this._zoomUpdatable).forEach(([k, v]) => {
      this._setPropertyValue(k, v);
    });
    this.map.on("zoom", this.zoom.bind(this));
  }

  // Most properties allow zoom dependent styling. Here we update those.
  zoom() {
    Object.entries(this._zoomUpdatable).forEach(([k, v]) => {
      this._setPropertyValue(k, v);
    });
  }

  // This is called when the map is destroyed or the gl context lost.
  onRemove(map) {
    delete this.gl;
    delete this.map;
    map.off("zoom", this.zoom);
  }

  // called by mapboxgl
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
