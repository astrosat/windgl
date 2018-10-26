# WebGL Wind

A WebGL-powered visualization of wind power as a custom Mapbox Layer.
Capable of rendering up to 1 million wind particles at 60fps.

This is based on code from mapbox/webgl-wind, but modified to be used as a custom layer.

## Usage

```sh
npm install --save @astrosat/windgl
```

```javascript
import {Map} from 'mapboxgl';
import windGL from 'windgl';

const map = new Map(...);

map.addLayer(windGL({
    id: 'wind',
    source: {
        url: 'url/to/backend'
    },
    properties: {
        'particle-count': 65536, // the number of particles (should be a number with a int square root)
        'wind-speed-color-ramp': [ // a gradient used for coloring particles
            0.0, '#3288bd',
            0.1, '#66c2a5',
            0.2, '#abdda4',
            0.3, '#e6f598',
            0.4, '#fee08b',
            0.5, '#fdae61',
            0.6, '#f46d43',
            1.0, '#d53e4f' ],
        'particle-fade-opacity': 0.996, // how fast the particle trails fade on each frame
        'particle-speed-factor': 0.25, // how fast the particles move
        'particle-reset-rate': 0.003, // how often the particles move to a random place
        'particle-reset-factor': 0.01 // drop rate increase relative to individual particle speed
    }
}));
```

You can adjust the properties by calling `setProperty(property, value)`.

## Limitations

1. The wind layer must be on top of other layers. Putting it in the middle of the layer stack doesn't work.
2. The wind map doesn't wrap when zoomed out too much. For best results limit the minzoom of the map to something greater than 2.
3. Datasource tiling isn't implemented.
4. Ideally, the properties would be split between layout and paint and behave like proper Mapbox properties. However, the Mapbox code to do that is pretty involved.

## Backend

The backend format will be documented later. Sorry. The main idea is that it should return a small JSON and an image that encodes the grib data. See `demo/2016112000.json` as an example.
