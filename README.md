# WindGL

A WebGL-powered visualization of wind power using custom Mapbox Layers.
Capable of rendering up to 1 million wind particles at 60fps.

## Usage

```sh
npm install --save @astrosat/windgl
```

```javascript
import {Map} from 'mapboxgl';
import {sampleFill, particles, source} from '@astrosat/windgl';

// 1. Create a source
const windSource = source('http://url/to/backend');

const map = new Map(...);

map.addLayer(sampleFill({
    id: 'windbackground', // required
    source: windSource, // required
    'sample-fill-opacity': 0.8 // optional
}));
```

## Layers

This package offers several ways to visualize wind speed.

### Sample Fill

![Sample Fill](./demo/random/sampleFill.png)

This layer will use a color map to show the wind speed at each pixel (interpolated from the data set). You can customize it with the following properties:

#### `sample-fill-color`

A `color` value. You can interpolate based on zoom or using data-driven styling (`["get", "speed"]` will get the speed at the current pixel). The default value is a nice color scale:

```json
[
  "interpolate",
  ["linear"],
  ["get", "speed"],
  0.0,
  "#3288bd",
  10,
  "#66c2a5",
  20,
  "#abdda4",
  30,
  "#e6f598",
  40,
  "#fee08b",
  50,
  "#fdae61",
  60,
  "#f46d43",
  100.0,
  "#d53e4f"
]
```

#### `sample-opacity`

A `number` between `0` and `1`. Indicates the global opacity of the layer. You can use zoom for styling.

#### Particles

![Particles](./random/particles.png)

A particle layer showing wind speed by animating particles based on the wind speed. You can customize it with the following properties:

#### `particle-color`

A `color` value. You can interpolate based on zoom or using data-driven styling (`["get", "speed"]` will get the speed at the current particle). The default value is `white`.

#### `particle-speed`

A positive `number`. Indicates how quickly the particles move (i.e. is a multiplier for the speed vector from the dataset). Can be interpolated based on zoom levels. Default is `0.75`.

You can adjust the properties by calling `setProperty(property, value)`.

## Limitations

3. Datasource tiling isn't implemented.

## Backend

The backend format will be documented later. Sorry. The main idea is that it should return a small JSON and an image that encodes the grib data. See `demo/2016112000.json` as an example.
