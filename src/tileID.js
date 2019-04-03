const tile2WSG84 = (c, z) => c / Math.pow(2, z);

const tile = (z, x, y, wrap = 0) => ({
  z,
  x,
  y,
  wrap,
  toString() {
    return `${z}/${x}/${y}`;
  },
  parent() {
    if (z > 0) return tile(z - 1, x >> 1, y >> 1, wrap);
    else return tile(z, x, y, wrap);
  },
  children() {
    return [
      tile(z + 1, x * 2, y * 2, wrap),
      tile(z + 1, x * 2 + 1, y * 2, wrap),
      tile(z + 1, x * 2 + 1, y * 2 + 1, wrap),
      tile(z + 1, x * 2, y * 2 + 1, wrap)
    ];
  },
  siblings() {
    return z === 0
      ? []
      : this.parent()
          .children()
          .filter(t => !this.isEqual(t));
  },
  isEqual(other) {
    other.x === x && other.y === y && other.z === z && other.wrap === wrap;
  },
  wgs84UnitBounds() {
    return [
      tile2WSG84(x, z),
      tile2WSG84(y, z),
      tile2WSG84(x + 1, z),
      tile2WSG84(y + 1, z)
    ];
  },
  viewMatrix(scale = 1) {
    return new window.DOMMatrix()
      .translate(
        tile2WSG84(x, z) + wrap - tile2WSG84((scale - 1) / 2, z),
        tile2WSG84(y, z) - tile2WSG84((scale - 1) / 2, z)
      )
      .scale(
        (tile2WSG84(x + 1, z) - tile2WSG84(x, z)) * scale,
        (tile2WSG84(y + 1, z) - tile2WSG84(y, z)) * scale
      )
      .toFloat32Array();
  },
  isRoot() {
    return z === 0;
  },
  neighbor(hor, ver) {
    if (z === 0) {
      return tile(0, 0, 0, wrap + hor);
    }
    const max = Math.pow(2, z);
    return tile(
      z,
      (x + hor + max) % max,
      (y + ver + max) % max,
      x + hor < 0 ? wrap - 1 : x + hor > max ? wrap + 1 : wrap
    );
  },
  quadrant() {
    return [x % 2, y % 2];
  }
});

export default tile;
