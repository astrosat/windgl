'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var styleSpec = require('mapbox-gl/dist/style-spec');

function createShader(gl, type, source) {
  var shader = gl.createShader(type);
  gl.shaderSource(shader, source);

  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader));
  }

  return shader;
}

function createProgram(gl, vertexSource, fragmentSource) {
  var program = gl.createProgram();

  var vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
  var fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);

  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program));
  }

  var wrapper = { program: program };

  var numAttributes = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);
  for (var i = 0; i < numAttributes; i++) {
    var attribute = gl.getActiveAttrib(program, i);
    wrapper[attribute.name] = gl.getAttribLocation(program, attribute.name);
  }
  var numUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
  for (var i$1 = 0; i$1 < numUniforms; i$1++) {
    var uniform = gl.getActiveUniform(program, i$1);
    wrapper[uniform.name] = gl.getUniformLocation(program, uniform.name);
  }

  return wrapper;
}

function createTexture(gl, filter, data, width, height) {
  var texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  if (data instanceof Uint8Array) {
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      width,
      height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      data
    );
  } else {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, data);
  }
  gl.bindTexture(gl.TEXTURE_2D, null);
  return texture;
}

function bindTexture(gl, texture, unit) {
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, texture);
}

function createBuffer(gl, data) {
  var buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  return buffer;
}

function bindAttribute(gl, buffer, attribute, numComponents) {
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.enableVertexAttribArray(attribute);
  gl.vertexAttribPointer(attribute, numComponents, gl.FLOAT, false, 0, 0);
}

function bindFramebuffer(gl, framebuffer, texture) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  if (texture) {
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      texture,
      0
    );
  }
}

function objectWithoutProperties (obj, exclude) { var target = {}; for (var k in obj) if (Object.prototype.hasOwnProperty.call(obj, k) && exclude.indexOf(k) === -1) target[k] = obj[k]; return target; }

/**
 * This is an abstract base class that handles most of the mapbox specific
 * stuff as well as a lot of the bookkeeping.
 */
var Layer = function Layer(propertySpec, ref) {
  var this$1 = this;
  var id = ref.id;
  var source = ref.source;
  var rest = objectWithoutProperties( ref, ["id", "source"] );
  var options = rest;

  this.id = id;
  this.type = "custom";
  this.renderingMode = "2d";
  this.source = source;
  this.propertySpec = propertySpec;

  this._zoomUpdatable = {};
  this._propsOnInit = {};

  this.source.loadTile(0, 0, 0, this.setWind.bind(this));

  // This will initialize the default values
  Object.keys(this.propertySpec).forEach(function (spec) {
    this$1.setProperty(spec, options[spec] || this$1.propertySpec[spec].default);
  });
};

/**
 * Update a property using a mapbox style epxression.
 */
Layer.prototype.setProperty = function setProperty (prop, value) {
  var spec = this.propertySpec[prop];
  if (!spec) { return; }
  var expr = styleSpec.expression.createPropertyExpression(value, spec);
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
};

// Child classes can interact with style properties in 2 ways:
// Either as a camelCased instance variable or by declaring a
// a setter function which will recieve the *expression* and
// it is their responsibility to evaluate it.
Layer.prototype._setPropertyValue = function _setPropertyValue (prop, value) {
  var name = prop
    .split("-")
    .map(function (a) { return a[0].toUpperCase() + a.slice(1); })
    .join("");
  var setterName = "set" + name;
  if (this[setterName]) {
    this[setterName](value);
  } else {
    this[name[0].toLowerCase() + name.slice(1)] = value.evaluate({
      zoom: this.map && this.map.getZoom()
    });
  }
};

// Properties that use data drive styling (i.e. ["get", "speed"]),
// will want to use this method. Since all speed values are evalutated
// on the GPU side, but expressions are evaluated on the CPU side,
// we need to evaluate the expression eagerly. We do it here by sampling
// 256 possible speed values in the range of the dataset and storing
// those in a 16x16 texture. The shaders than can simply pick the appropriate
// pixel to determine the correct color.
Layer.prototype.buildColorRamp = function buildColorRamp (expr) {
  var colors = new Uint8Array(256 * 4);
  var range = 1;
  if (expr.kind === "source" || expr.kind === "composite") {
    var u = this.windData.uMax - this.windData.uMin;
    var v = this.windData.vMax - this.windData.vMin;

    range = Math.sqrt(u * u + v * v);
  }

  for (var i = 0; i < 256; i++) {
    var color = expr.evaluate(
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
  this.colorRampTexture = createTexture(
    this.gl,
    this.gl.LINEAR,
    colors,
    16,
    16
  );
};

Layer.prototype.setWind = function setWind (windData) {
  this.windData = windData;
  if (this.map) {
    this._initialize();
    this.map.triggerRepaint();
  }
};

// called by mapboxgl
Layer.prototype.onAdd = function onAdd (map, gl) {
  this.gl = gl;
  this.map = map;
  if (this.windData) {
    this._initialize();
  }
};

// This will be called when we have everything we need:
// the gl context and the data
// we will call child classes `initialize` as well as do a bunch of
// stuff to get the properties in order
Layer.prototype._initialize = function _initialize () {
    var this$1 = this;

  this.initialize(this.map, this.gl);
  this.windTexture = this.windData.getTexture(this.gl);
  Object.entries(this._propsOnInit).forEach(function (ref) {
      var k = ref[0];
      var v = ref[1];

    this$1._setPropertyValue(k, v);
  });
  this._propsOnInit = {};
  Object.entries(this._zoomUpdatable).forEach(function (ref) {
      var k = ref[0];
      var v = ref[1];

    this$1._setPropertyValue(k, v);
  });
  this.map.on("zoom", this.zoom.bind(this));
};

// Most properties allow zoom dependent styling. Here we update those.
Layer.prototype.zoom = function zoom () {
    var this$1 = this;

  Object.entries(this._zoomUpdatable).forEach(function (ref) {
      var k = ref[0];
      var v = ref[1];

    this$1._setPropertyValue(k, v);
  });
};

// This is called when the map is destroyed or the gl context lost.
Layer.prototype.onRemove = function onRemove (map) {
  delete this.gl;
  delete this.map;
  map.off("zoom", this.zoom);
};

// called by mapboxgl
Layer.prototype.render = function render (gl, matrix) {
  if (this.windData) {
    var bounds = this.map.getBounds();
    var eastIter = Math.max(0, Math.ceil((bounds.getEast() - 180) / 360));
    var westIter = Math.max(0, Math.ceil((bounds.getWest() + 180) / -360));
    this.draw(gl, matrix, 0);
    for (var i = 1; i <= eastIter; i++) {
      this.draw(gl, matrix, i);
    }
    for (var i$1 = 1; i$1 <= westIter; i$1++) {
      this.draw(gl, matrix, -i$1);
    }
  }
};

var backgroundVert = "precision mediump float;\n#define GLSLIFY 1\n\nattribute vec2 a_pos;\n\nvarying vec2 v_tex_pos;\n\nuniform mat4 u_matrix;\n\nuniform float u_dateline_offset;\n\nvoid main() {\n    v_tex_pos = a_pos;\n    gl_Position = u_matrix * vec4(a_pos + vec2(u_dateline_offset, 0), 0, 1);\n}\n"; // eslint-disable-line

var backgroundFrag = "precision mediump float;\n#define GLSLIFY 1\n\nconst float PI_0 = 3.14159265359;\n\n/**\n * Converts mapbox style pseudo-mercator coordinates (this is just like mercator, but the unit isn't a meter, but 0..1\n * spans the entire world) into texture like WGS84 coordinates (this is just like WGS84, but instead of angles, it uses\n * intervals of 0..1).\n */\nvec2 mercatorToWGS84(vec2 xy) {\n    // convert lat into an angle\n    float y = radians(180.0 - xy.y * 360.0);\n    // use the formula to convert mercator -> WGS84\n    y = 360.0 / PI_0  * atan(exp(y)) - 90.0;\n    // normalize back into 0..1 interval\n    y = y / -180.0 + 0.5;\n    // pass lng through, as it doesn't change\n    return vec2(xy.x, y);\n}\n\nuniform sampler2D u_wind;\nuniform vec2 u_wind_res;\nuniform vec2 u_wind_min;\nuniform vec2 u_wind_max;\nuniform float u_opacity;\n\nvarying vec2 v_tex_pos;\nvarying vec2 v_st;\n\nuniform mat4 u_matrix;\n\nuniform sampler2D u_color_ramp;\nuniform mat4 u_inverse_matrix;\n\nconst float PI = 3.14159265359;\n\n/**\n * Wind speed lookup. Returns a vector that isn't re-normalized to real world units.\n * Uses manual bilinear filtering based on 4 adjacent pixels for smooth interpolation.\n */\nvec2 windSpeedRelative(const vec2 uv) {\n    // return texture2D(u_wind, uv).rg; // lower-res hardware filtering\n    vec2 px = 1.0 / u_wind_res;\n    vec2 vc = (floor(uv * u_wind_res)) * px;\n    vec2 f = fract(uv * u_wind_res);\n    vec2 tl = texture2D(u_wind, vc).rg;\n    vec2 tr = texture2D(u_wind, vc + vec2(px.x, 0)).rg;\n    vec2 bl = texture2D(u_wind, vc + vec2(0, px.y)).rg;\n    vec2 br = texture2D(u_wind, vc + px).rg;\n    return mix(mix(tl, tr, f.x), mix(bl, br, f.x), f.y);\n}\n\nvec2 windSpeed(const vec2 uv) {\n    return mix(u_wind_min, u_wind_max, windSpeedRelative(uv));\n}\n\n/**\n * Returns the magnitude of the wind speed vector as a proportion of the maximum speed.\n */\nfloat windSpeedMagnitude(const vec2 uv) {\n    return length(windSpeed(uv)) / length(u_wind_max);\n}\n\nvoid main() {\n    // modulus is used to make sure this wraps nicely when zoomed out\n    vec2 tex_pos = mercatorToWGS84(v_tex_pos);\n    float speed_t = windSpeedMagnitude(tex_pos);\n    // color ramp is encoded in a 16x16 texture\n    vec2 ramp_pos = vec2(\n        fract(16.0 * speed_t),\n        floor(16.0 * speed_t) / 16.0);\n\n    vec4 color = texture2D(u_color_ramp, ramp_pos);\n\n    gl_FragColor = vec4(floor(255.0 * color * u_opacity) / 255.0);\n}\n"; // eslint-disable-line

var SampleFill = /*@__PURE__*/(function (Layer$$1) {
  function SampleFill(options) {
    Layer$$1.call(
      this, {
        "sample-fill-color": {
          type: "color",
          default: [
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
          ],
          doc: "The color of each pixel of this layer",
          expression: {
            interpolated: true,
            parameters: ["zoom", "feature"]
          },
          "property-type": "data-driven"
        },
        "sample-opacity": {
          type: "number",
          default: 1,
          minimum: 0,
          maximum: 1,
          transition: true,
          expression: {
            interpolated: true,
            parameters: ["zoom"]
          },
          "property-type": "data-constant"
        }
      },
      options
    );
  }

  if ( Layer$$1 ) SampleFill.__proto__ = Layer$$1;
  SampleFill.prototype = Object.create( Layer$$1 && Layer$$1.prototype );
  SampleFill.prototype.constructor = SampleFill;

  SampleFill.prototype.initialize = function initialize (map, gl) {
    this.backgroundProgram = createProgram(
      gl,
      backgroundVert,
      backgroundFrag
    );

    this.quadBuffer = createBuffer(
      gl,
      new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1])
    );
  };

  SampleFill.prototype.setSampleFillColor = function setSampleFillColor (expr) {
    this.buildColorRamp(expr);
  };

  SampleFill.prototype.draw = function draw (gl, matrix, dateLineOffset) {
    var opacity = this.sampleOpacity;
    var program = this.backgroundProgram;
    gl.useProgram(program.program);

    bindAttribute(gl, this.quadBuffer, program.a_pos, 2);

    bindTexture(gl, this.windTexture, 0);
    bindTexture(gl, this.colorRampTexture, 2);

    gl.uniform1i(program.u_wind, 0);
    gl.uniform1i(program.u_color_ramp, 2);

    gl.uniform1f(program.u_opacity, opacity);
    gl.uniform1f(program.u_dateline_offset, dateLineOffset);
    gl.uniform2f(program.u_wind_res, this.windData.width, this.windData.height);
    gl.uniform2f(program.u_wind_min, this.windData.uMin, this.windData.vMin);
    gl.uniform2f(program.u_wind_max, this.windData.uMax, this.windData.vMax);
    gl.uniformMatrix4fv(program.u_matrix, false, matrix);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  };

  return SampleFill;
}(Layer));

function sampleFill (options) { return new SampleFill(options); }

var particleUpdateVert = "precision mediump float;\n#define GLSLIFY 1\n\nattribute vec2 a_pos;\n\nvarying vec2 v_tex_pos;\n\nvoid main() {\n    v_tex_pos = a_pos;\n    gl_Position = vec4(1.0 - 2.0 * a_pos, 0, 1);\n}\n"; // eslint-disable-line

var particleUpdateFrag = "precision highp float;\n#define GLSLIFY 1\n\nuniform sampler2D u_particles;\nuniform sampler2D u_wind;\nuniform vec2 u_wind_res;\nuniform vec2 u_wind_min;\nuniform vec2 u_wind_max;\nuniform float u_rand_seed;\nuniform float u_speed_factor;\nuniform float u_drop_rate;\nuniform float u_drop_rate_bump;\n\nvarying vec2 v_tex_pos;\n\n// pseudo-random generator\nconst vec3 rand_constants = vec3(12.9898, 78.233, 4375.85453);\nfloat rand(const vec2 co) {\n    float t = dot(rand_constants.xy, co);\n    return fract(sin(t) * (rand_constants.z + t));\n}\n\n// wind speed lookup; use manual bilinear filtering based on 4 adjacent pixels for smooth interpolation\nvec2 lookup_wind(const vec2 uv) {\n    // return texture2D(u_wind, uv).rg; // lower-res hardware filtering\n    vec2 px = 1.0 / u_wind_res;\n    vec2 vc = (floor(uv * u_wind_res)) * px;\n    vec2 f = fract(uv * u_wind_res);\n    vec2 tl = texture2D(u_wind, vc).rg;\n    vec2 tr = texture2D(u_wind, vc + vec2(px.x, 0)).rg;\n    vec2 bl = texture2D(u_wind, vc + vec2(0, px.y)).rg;\n    vec2 br = texture2D(u_wind, vc + px).rg;\n    return mix(mix(tl, tr, f.x), mix(bl, br, f.x), f.y);\n}\n\nvoid main() {\n    vec4 color = texture2D(u_particles, v_tex_pos);\n    vec2 pos = vec2(\n        color.r / 255.0 + color.b,\n        color.g / 255.0 + color.a); // decode particle position from pixel RGBA\n\n    vec2 velocity = mix(u_wind_min, u_wind_max, lookup_wind(pos));\n    float speed_t = length(velocity) / length(u_wind_max);\n\n    vec2 offset = vec2(velocity.x , -velocity.y) * 0.0001 * u_speed_factor;\n\n    // update particle position, wrapping around the date line\n    pos = fract(1.0 + pos + offset);\n\n    // a random seed to use for the particle drop\n    vec2 seed = (pos + v_tex_pos) * u_rand_seed;\n\n    // drop rate is a chance a particle will restart at random position, to avoid degeneration\n    float drop_rate = u_drop_rate + speed_t * u_drop_rate_bump;\n    float drop = step(1.0 - drop_rate, rand(seed));\n\n    vec2 random_pos = vec2(\n        rand(seed + 1.3),\n        rand(seed + 2.1));\n     pos = mix(pos, random_pos, drop);\n\n    // encode the new particle position back into RGBA\n    gl_FragColor = vec4(\n        fract(pos * 255.0),\n        floor(pos * 255.0) / 255.0);\n}\n"; // eslint-disable-line

var particleDrawVert = "#define M_PI 3.1415926535897932384626433832795\n\nprecision mediump float;\n#define GLSLIFY 1\n\nconst float PI = 3.14159265359;\n\n/**\n * Converts texture like WGS84 coordinates (this is just like WGS84, but instead of angles, it uses\n * intervals of 0..1) into mapbox style pseudo-mercator coordinates (this is just like mercator, but the unit isn't a meter, but 0..1\n * spans the entire world).\n */\nvec2 wgs84ToMercator(vec2 xy) {\n    // convert to angle\n    float y = -180.0 * xy.y + 90.0;\n    // use the formule to convert\n    y = (180.0 - (180.0 / PI * log(tan(PI / 4.0 + y * PI / 360.0)))) / 360.0;\n    // pass x through, as it doesn't change\n    return vec2(xy.x, y);\n}\n\nattribute float a_index;\n\nuniform sampler2D u_particles;\nuniform float u_particles_res;\nuniform mat4 u_matrix;\nuniform float u_dateline_offset;\n\nvarying vec2 v_particle_pos;\n\nvoid main() {\n    vec4 color = texture2D(u_particles, vec2(\n        fract(a_index / u_particles_res),\n        floor(a_index / u_particles_res) / u_particles_res));\n\n    // decode current particle position from the pixel's RGBA value\n    v_particle_pos = wgs84ToMercator(vec2(\n        color.r / 255.0 + color.b,\n        color.g / 255.0 + color.a));\n\n    gl_PointSize = 2.0;\n    gl_Position = u_matrix * vec4(v_particle_pos.xy + vec2(u_dateline_offset, 0), 0, 1);\n}\n"; // eslint-disable-line

var particleDrawFrag = "precision mediump float;\n#define GLSLIFY 1\n\nuniform sampler2D u_wind;\nuniform vec2 u_wind_min;\nuniform vec2 u_wind_max;\nuniform sampler2D u_color_ramp;\n\nvarying vec2 v_particle_pos;\n\nvoid main() {\n    vec2 velocity = mix(u_wind_min, u_wind_max, texture2D(u_wind, v_particle_pos).rg);\n    float speed_t = length(velocity) / length(u_wind_max);\n\n    // // color ramp is encoded in a 16x16 texture\n    vec2 ramp_pos = vec2(\n        fract(16.0 * speed_t),\n        floor(16.0 * speed_t) / 16.0);\n\n    gl_FragColor = texture2D(u_color_ramp, ramp_pos);\n}\n"; // eslint-disable-line

/**
 * This layer simulates a particles system where the particles move according
 * to the forces of the wind. This is achieved in a two step rendering process:
 *
 * 1. First the particle positions are updated. These are stored in a texure
 *    where the BR channels encode x and AG encode the y position. The `update`
 *    function invokes a shader that updates the positions and renders them back
 *    into a texure. This whole simulation happens in global WSG84 coordinates.
 *
 * 2. In the `draw` phase, actual points are drawn on screen. Their positions
 *    are read from the texture and are projected into pseudo-mercator coordinates
 *    and their final position is computed based on the map viewport.
 */
var Particles = /*@__PURE__*/(function (Layer$$1) {
  function Particles(options) {
    Layer$$1.call(
      this, {
        "particle-color": {
          type: "color",
          default: "white",
          expression: {
            interpolated: true,
            parameters: ["zoom", "feature"]
          },
          "property-type": "data-driven"
        },
        "particle-speed": {
          type: "number",
          minimum: 0,
          default: 0.75,
          transition: true,
          expression: {
            interpolated: true,
            parameters: ["zoom"]
          },
          "property-type": "data-constant"
        }
      },
      options
    );
    this.dropRate = 0.003; // how often the particles move to a random place
    this.dropRateBump = 0.01; // drop rate increase relative to individual particle speed
    this._numParticles = 65536;
  }

  if ( Layer$$1 ) Particles.__proto__ = Layer$$1;
  Particles.prototype = Object.create( Layer$$1 && Layer$$1.prototype );
  Particles.prototype.constructor = Particles;

  Particles.prototype.setParticleColor = function setParticleColor (expr) {
    this.buildColorRamp(expr);
  };

  Particles.prototype.initializeParticles = function initializeParticles (gl, count) {
    var particleRes = (this.particleStateResolution = Math.ceil(
      Math.sqrt(count)
    ));
    this._numParticles = particleRes * particleRes;

    var particleState = new Uint8Array(this._numParticles * 4);
    for (var i = 0; i < particleState.length; i++) {
      particleState[i] = Math.floor(Math.random() * 256); // randomize the initial particle positions
    }
    // textures to hold the particle state for the current and the next frame
    this.particleStateTexture0 = createTexture(
      gl,
      gl.NEAREST,
      particleState,
      particleRes,
      particleRes
    );
    this.particleStateTexture1 = createTexture(
      gl,
      gl.NEAREST,
      particleState,
      particleRes,
      particleRes
    );

    var particleIndices = new Float32Array(this._numParticles);
    for (var i$1 = 0; i$1 < this._numParticles; i$1++) { particleIndices[i$1] = i$1; }
    this.particleIndexBuffer = createBuffer(gl, particleIndices);
  };

  Particles.prototype.initialize = function initialize (map, gl) {
    this.updateProgram = createProgram(
      gl,
      particleUpdateVert,
      particleUpdateFrag
    );

    this.drawProgram = createProgram(
      gl,
      particleDrawVert,
      particleDrawFrag
    );

    this.framebuffer = gl.createFramebuffer();

    this.quadBuffer = createBuffer(
      gl,
      new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1])
    );

    this.initializeParticles(gl, this._numParticles);
  };

  // This is a callback from mapbox for rendering into a texture
  Particles.prototype.prerender = function prerender (gl, matrix) {
    if (this.windData) { this.update(gl, matrix); }
  };

  Particles.prototype.update = function update (gl) {
    var blendingEnabled = gl.isEnabled(gl.BLEND);
    gl.disable(gl.BLEND);

    bindFramebuffer(gl, this.framebuffer, this.particleStateTexture1);
    gl.viewport(
      0,
      0,
      this.particleStateResolution,
      this.particleStateResolution
    );

    var program = this.updateProgram;
    gl.useProgram(program.program);

    bindTexture(gl, this.windTexture, 0);
    bindTexture(gl, this.particleStateTexture0, 1);

    bindAttribute(gl, this.quadBuffer, program.a_pos, 2);

    gl.uniform1i(program.u_wind, 0);
    gl.uniform1i(program.u_particles, 1);

    gl.uniform1f(program.u_rand_seed, Math.random());
    gl.uniform2f(program.u_wind_res, this.windData.width, this.windData.height);
    gl.uniform2f(program.u_wind_min, this.windData.uMin, this.windData.vMin);
    gl.uniform2f(program.u_wind_max, this.windData.uMax, this.windData.vMax);
    gl.uniform1f(program.u_speed_factor, this.particleSpeed);
    gl.uniform1f(program.u_drop_rate, this.dropRate);
    gl.uniform1f(program.u_drop_rate_bump, this.dropRateBump);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // swap the particle state textures so the new one becomes the current one
    var temp = this.particleStateTexture0;
    this.particleStateTexture0 = this.particleStateTexture1;
    this.particleStateTexture1 = temp;

    if (blendingEnabled) { gl.enable(gl.BLEND); }
    this.map.triggerRepaint();
  };

  Particles.prototype.draw = function draw (gl, matrix, dateLineOffset) {
    var program = this.drawProgram;
    gl.useProgram(program.program);

    bindTexture(gl, this.windTexture, 0);
    bindTexture(gl, this.particleStateTexture0, 1);
    bindTexture(gl, this.colorRampTexture, 2);

    bindAttribute(gl, this.particleIndexBuffer, program.a_index, 1);

    gl.uniform1i(program.u_wind, 0);
    gl.uniform1i(program.u_particles, 1);
    gl.uniform1i(program.u_color_ramp, 2);

    gl.uniform1f(program.u_particles_res, this.particleStateResolution);
    gl.uniform1f(program.u_dateline_offset, dateLineOffset);
    gl.uniform2f(program.u_wind_min, this.windData.uMin, this.windData.vMin);
    gl.uniform2f(program.u_wind_max, this.windData.uMax, this.windData.vMax);

    gl.uniformMatrix4fv(program.u_matrix, false, matrix);

    gl.drawArrays(gl.POINTS, 0, this._numParticles);
  };

  return Particles;
}(Layer));

function particles (options) { return new Particles(options); }

var arrowsVert = "precision mediump float;\n#define GLSLIFY 1\n\nattribute vec2 a_pos;\nattribute vec2 a_corner;\nvarying vec2 v_center;\nvarying float v_size;\nvarying float v_speed;\n\nuniform mat4 u_matrix;\nuniform vec2 u_dimensions;\n\nuniform sampler2D u_wind;\nuniform vec2 u_wind_res;\nuniform vec2 u_wind_min;\nuniform vec2 u_wind_max;\nuniform float u_dateline_offset;\n\nconst float PI = 3.14159265359;\n\n/**\n * Converts mapbox style pseudo-mercator coordinates (this is just like mercator, but the unit isn't a meter, but 0..1\n * spans the entire world) into texture like WGS84 coordinates (this is just like WGS84, but instead of angles, it uses\n * intervals of 0..1).\n */\nvec2 mercatorToWGS84(vec2 xy) {\n    // convert lat into an angle\n    float y = radians(180.0 - xy.y * 360.0);\n    // use the formula to convert mercator -> WGS84\n    y = 360.0 / PI  * atan(exp(y)) - 90.0;\n    // normalize back into 0..1 interval\n    y = y / -180.0 + 0.5;\n    // pass lng through, as it doesn't change\n    return vec2(xy.x, y);\n}\n\n/**\n * Wind speed lookup. Returns a vector that isn't re-normalized to real world units.\n * Uses manual bilinear filtering based on 4 adjacent pixels for smooth interpolation.\n */\nvec2 windSpeedRelative(const vec2 uv) {\n    return texture2D(u_wind, uv).rg; // lower-res hardware filtering\n}\n\nvec2 windSpeed(const vec2 uv) {\n    return mix(u_wind_min, u_wind_max, windSpeedRelative(uv));\n}\n\nmat2 rotation(float angle) {\n    return mat2(cos(angle), -sin(angle),\n                sin(angle), cos(angle));\n}\n\nvoid main() {\n    float ratio = u_dimensions.x/u_dimensions.y;\n    vec2 unit = 0.45 / u_dimensions;\n    vec2 pos = a_pos / u_dimensions;\n\n    vec2 speed = windSpeed(pos);\n    v_speed = length(speed) / length(u_wind_max);\n    float angle = atan(speed.x, speed.y);\n    v_center = a_corner;\n    v_size = length(speed) / length(u_wind_max);\n\n    pos += rotation(angle) *  a_corner * unit;\n    // Fix proportions from rectangular projection to square\n    pos.x *= u_dimensions.x / u_dimensions.y;\n\n    gl_Position =  u_matrix * vec4(pos + vec2(u_dateline_offset, 0), 0, 1);\n    // TODO: This is a HAX because I have no idea why we're seeing double data. This makes it go away at the cost of perf and some ocasional rendering artefacts.\n    if ((pos.x >= 1. || pos.x <= 0.) && u_dateline_offset < 0.0) {\n        gl_Position.y = 10000.0;\n    }\n}\n"; // eslint-disable-line

var arrowsFrag = "precision mediump float;\n#define GLSLIFY 1\n\n#define PI 3.14159265359\n#define TWO_PI 6.28318530718\n\nvarying vec2 v_center;\nvarying float v_size;\nvarying float v_speed;\n\nuniform sampler2D u_color_ramp;\nuniform vec4 u_halo_color;\n\nfloat polygon(vec3 st, int N) {\n    float a = atan(st.x, st.y) + PI;\n  \tfloat r = TWO_PI / float(N);\n\n    float d = cos(floor(0.5 + a / r) * r - a) * length(st.xy);\n    return d;\n}\n\nmat3 scale(vec2 _scale){\n    return mat3(1.0 / _scale.x, 0, 0,\n                0, 1.0 / _scale.y, 0,\n                0, 0, 1);\n}\n\nmat3 translate(vec2 _translate) {\n    return mat3(1, 0, _translate.x,\n                0, 1, _translate.y,\n                0, 0, 1);\n}\n\nfloat arrow(vec3 st, float len) {\n    return min(\n        polygon(st* scale(vec2(0.3)), 3),\n        polygon(st* translate(vec2(-0.00, len / 2.0)) * scale(vec2(0.2, len)), 4)\n    );\n}\n\nvoid main() {\n    vec3 st = vec3(v_center, 1);\n    float size = mix(0.25, 4.0, v_size);\n    float d = arrow(st * translate(vec2(0, -size / 2.0)), size);\n\n    float inside = 1.0 - smoothstep(0.4, 0.405, d);\n    float halo = (1.0 - smoothstep(0.43, 0.435, d)) - inside;\n    vec2 ramp_pos = vec2(\n        fract(16.0 * v_speed),\n        floor(16.0 * v_speed) / 16.0);\n\n    vec4 color = texture2D(u_color_ramp, ramp_pos);\n    gl_FragColor = color * inside + halo * u_halo_color;\n}\n"; // eslint-disable-line

var Arrows = /*@__PURE__*/(function (Layer$$1) {
  function Arrows(options) {
    Layer$$1.call(
      this, {
        "arrow-min-size": {
          type: "number",
          minimum: 1,
          default: 40,
          expression: {
            interpolated: true,
            parameters: ["zoom"]
          },
          "property-type": "data-constant"
        },
        "arrow-color": {
          type: "color",
          default: "white",
          expression: {
            interpolated: true,
            parameters: ["zoom", "feature"]
          },
          "property-type": "data-driven"
        },
        "arrow-halo-color": {
          type: "color",
          default: "rgba(0,0,0,0)",
          expression: {
            interpolated: true,
            parameters: ["zoom"]
          },
          "property-type": "data-constant"
        }
      },
      options
    );
  }

  if ( Layer$$1 ) Arrows.__proto__ = Layer$$1;
  Arrows.prototype = Object.create( Layer$$1 && Layer$$1.prototype );
  Arrows.prototype.constructor = Arrows;

  Arrows.prototype.initialize = function initialize (map, gl) {
    this.arrowsProgram = createProgram(gl, arrowsVert, arrowsFrag);
    this.initializeGrid();
  };

  Arrows.prototype.setArrowColor = function setArrowColor (expr) {
    this.buildColorRamp(expr);
  };

  Arrows.prototype.initializeGrid = function initializeGrid () {
    this.cols = this.windData.width;
    this.rows = this.windData.height;
    var numTriangles = this.rows * this.cols * 2;
    var numVertices = numTriangles * 3;
    var positions = new Float32Array(2 * numVertices);
    var corners = new Float32Array(2 * numVertices);
    for (var i = 0; i < this.cols; i++) {
      for (var j = 0; j < this.rows; j++) {
        var index = (i * this.rows + j) * 12;
        positions.set([i, j, i, j, i, j, i, j, i, j, i, j], index);
        corners.set([-1, 1, 1, 1, 1, -1, -1, 1, 1, -1, -1, -1], index);
      }
    }
    this.positionsBuffer = createBuffer(this.gl, positions);
    this.cornerBuffer = createBuffer(this.gl, corners);
  };

  /**
   * This figures out the ideal number or rows and columns to show.
   *
   * NB: Returns [cols, rows] as that is [x,y] which makes more sense.
   */
  Arrows.prototype.computeDimensions = function computeDimensions (gl, map, minSize, cols, rows) {
    // If we are rendering multiple copies of the world, then we only care
    // about the square in the middle, as other code will take care of the
    // aditional coppies.
    var ref =
      map.getBounds().getEast() - 180 - (map.getBounds().getWest() + 180) > 0
        ? [gl.canvas.height, gl.canvas.height]
        : [gl.canvas.width, gl.canvas.height];
    var w = ref[0];
    var h = ref[1];

    var z = map.getZoom();

    // Either we show the grid size of the data, or we show fewer such
    // that these should be about ~minSize.
    return [
      Math.min(Math.floor((Math.floor(z + 1) * w) / minSize), cols),
      Math.min(Math.floor((Math.floor(z + 1) * h) / minSize), rows)
    ];
  };

  Arrows.prototype.draw = function draw (gl, matrix, dateLineOffset) {
    var program = this.arrowsProgram;
    gl.useProgram(program.program);

    bindAttribute(gl, this.positionsBuffer, program.a_pos, 2);
    bindAttribute(gl, this.cornerBuffer, program.a_corner, 2);

    bindTexture(gl, this.windTexture, 0);
    bindTexture(gl, this.colorRampTexture, 2);

    gl.uniform1i(program.u_wind, 0);
    gl.uniform1i(program.u_color_ramp, 2);
    var ref = this.computeDimensions(
      gl,
      this.map,
      this.arrowMinSize,
      this.cols,
      this.rows
    );
    var cols = ref[0];
    var rows = ref[1];
    gl.uniform2f(program.u_dimensions, cols, rows);

    gl.uniform2f(program.u_wind_res, this.windData.width, this.windData.height);
    gl.uniform2f(program.u_wind_min, this.windData.uMin, this.windData.vMin);
    gl.uniform2f(program.u_wind_max, this.windData.uMax, this.windData.vMax);
    gl.uniform1f(program.u_dateline_offset, dateLineOffset);
    gl.uniform4f(
      program.u_halo_color,
      this.arrowHaloColor.r,
      this.arrowHaloColor.g,
      this.arrowHaloColor.b,
      this.arrowHaloColor.a
    );

    gl.uniformMatrix4fv(program.u_matrix, false, matrix);

    // if these were put in a smarter order, we could optimize this call further
    gl.drawArrays(gl.TRIANGLES, 0, this.rows * Math.floor(cols) * 6);
  };

  return Arrows;
}(Layer));

function arrow (options) { return new Arrows(options); }

function getJSON(url, callback) {
  var xhr = new XMLHttpRequest();
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

function source (relUrl) {
  var url = new URL(relUrl, window.location);
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
  var tileRequests = {};
  var data;
  var requestsBeforeMetadataLoaded = new Set();
  var cache = {};

  getJSON(url, function (windData) {
    data = windData;
    requestsBeforeMetadataLoaded.forEach(function (coords) {
      if (cache[coords]) {
        var req;
        while ((req = tileRequests[coords].pop())) {
          dispatchCallback(coords, req);
        }
      } else {
        load.apply(void 0, coords.split("/"));
      }
    });
    requestsBeforeMetadataLoaded = [];
  });

  function dispatchCallback(coords, cb) {
    cb(Object.assign({}, data, { getTexture: cache[coords] }));
  }

  function load(z, x, y) {
    var windImage = new Image();
    var tileUrl = new URL(
      data.tiles[0]
        .replace(/{z}/g, z)
        .replace(/{x}/g, x)
        .replace(/{y}/g, y),
      url
    );
    if (tileUrl.origin !== window.location.origin) {
      windImage.crossOrigin = "anonymous";
    }
    windImage.src = tileUrl;
    windImage.onload = function () {
      var coords = [z, x, y].join("/");
      var texture;
      cache[coords] = function (gl) {
        if (texture) { return texture; }
        texture = createTexture(gl, gl.LINEAR, windImage);
        return texture;
      };
      var req;
      while ((req = tileRequests[coords].pop())) {
        dispatchCallback(coords, req);
      }
    };
  }

  return {
    loadTile: function loadTile(z, x, y, cb) {
      var coords = [z, x, y].join("/");
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
}

exports.sampleFill = sampleFill;
exports.particles = particles;
exports.arrow = arrow;
exports.source = source;
