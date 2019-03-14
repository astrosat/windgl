import * as util from "./util";

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

export default url => {
  /**
   * A note on how this works:
   * 0. At any moment we can recieve a request for a tile.
   * 1. Before we can fulfil such a request, we need to load metadata. So we store tile requests that were issued before
   *    metadata was loaded and once it loads we issue requests for the tiles once that is done.
   * 2. If metadata is loaded, we check if there already has been a request for the same tile. If yes, we simply add
   *    the callback to the queue, otherwise we save the callback and load the image.
   * 3. When an image is loaded we store the data in a cache and empty the queue of all relevant callbacks by calling them.
   * 4. If there is already data in the cache, simply call the callback right away.
   */
  let tileRequests = {};
  let data;
  let requestsBeforeMetadataLoaded = new Set();
  let cache = {};

  getJSON(url, windData => {
    data = windData;
    requestsBeforeMetadataLoaded.forEach(coords => {
      if (cache[coords]) {
        let req;
        while ((req = tileRequests[coords].pop())) {
          dispatchCallback(coords, req);
        }
      } else {
        load(...coords.split("/"));
      }
    });
    requestsBeforeMetadataLoaded = [];
  });

  function dispatchCallback(coords, cb) {
    const { tiles, ...windData } = data;
    cb(Object.assign({}, windData, { getTexture: cache[coords] }));
  }

  function load(z, x, y) {
    const windImage = new Image();
    const url = data.tiles[0]
      .replace(/{z}/g, z)
      .replace(/{x}/g, x)
      .replace(/{y}/g, y);
    if (new URL(url).origin !== window.location.origin) {
      windImage.crossOrigin = "anonymous";
    }
    windImage.src = url;
    windImage.onload = () => {
      const coords = [z, x, y].join("/");
      let texture;
      cache[coords] = gl => {
        if (texture) return texture;
        texture = util.createTexture(gl, gl.LINEAR, windImage);
        return texture;
      };
      let req;
      while ((req = tileRequests[coords].pop())) {
        dispatchCallback(coords, req);
      }
    };
  }

  return {
    loadTile(z, x, y, cb) {
      const coords = [z, x, y].join("/");
      if (cache[coords]) {
        dispatchCallback(coords, cb);
      } else {
        if (data) {
          if (tileRequests[coords]) {
            tileRequests[coords].push(cb);
          } else {
            tileRequests[coords] = [cb];
            load(z, x, y);
          }
        } else {
          tileRequests[coords] = (tileRequests[coords] || []).concat([cb]);
          requestsBeforeMetadataLoaded.add(coords);
        }
      }
    }
  };
};
