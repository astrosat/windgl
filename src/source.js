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

export default relUrl => {
  const url = new URL(relUrl, window.location);
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
  let dataCallbacks = [];

  getJSON(url, windData => {
    data = windData;
    dataCallbacks.forEach(cb => cb(data));
    requestsBeforeMetadataLoaded.forEach(tile => {
      if (cache[tile]) {
        let req;
        while ((req = tileRequests[tile].pop())) {
          dispatchCallback(tile, req);
        }
      } else {
        load(tile);
      }
    });
    requestsBeforeMetadataLoaded = [];
  });

  function dispatchCallback(tile, cb) {
    cb(Object.assign(tile, { getTexture: cache[tile] }));
  }

  function load(tile) {
    const windImage = new Image();
    const tileUrl = new URL(
      data.tiles[0]
        .replace(/{z}/g, tile.z)
        .replace(/{x}/g, tile.x)
        .replace(/{y}/g, tile.y),
      url
    );
    if (tileUrl.origin !== window.location.origin) {
      windImage.crossOrigin = "anonymous";
    }
    windImage.src = tileUrl;
    windImage.onload = () => {
      let texture;
      cache[tile] = gl => {
        if (texture) return texture;
        texture = util.createTexture(gl, gl.LINEAR, windImage);
        return texture;
      };
      let req;
      while ((req = tileRequests[tile].pop())) {
        dispatchCallback(tile, req);
      }
    };
  }

  return {
    metadata(cb) {
      if (data) {
        cb(data);
      } else {
        dataCallbacks.push(cb);
      }
    },
    loadTile(tile, cb) {
      if (cache[tile]) {
        dispatchCallback(tile, cb);
      } else {
        if (data) {
          if (tileRequests[tile]) {
            tileRequests[tile].push(cb);
          } else {
            tileRequests[tile] = [cb];
            load(tile);
          }
        } else {
          tileRequests[tile] = (tileRequests[tile] || []).concat([cb]);
          requestsBeforeMetadataLoaded.add(tile);
        }
      }
    }
  };
};
