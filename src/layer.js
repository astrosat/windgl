import * as util from "./util";

export default class Layer {
  constructor({ id, source }) {
    this.id = id;
    this.type = "custom";
    this.renderingMode = "2d";
    this.source = source;

    this.source.loadTile(0, 0, 0, this.setWind.bind(this));
  }

  setWind(windData) {
    this.windData = windData;
    if (this.map) {
      this.windTexture = windData.getTexture(this.gl);
      this.map.triggerRepaint();
    }
  }

  onAdd(map, gl) {
    this.gl = gl;
    this.map = map;
    this.initialize(map, gl);
    if (this.windData) {
      this.windTexture = this.windData.getTexture(gl);
    }
    map.on("resize", this.resize);
  }

  resize() {}

  onRemove(map) {
    delete this.gl;
    delete this.map;
    map.off("resize", this.resize);
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
