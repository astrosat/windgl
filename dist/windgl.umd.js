(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global.windGL = factory());
}(this, (function () { 'use strict';

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

  var drawVert = "#define M_PI 3.1415926535897932384626433832795\nprecision mediump float;attribute float a_index;uniform sampler2D u_particles;uniform float u_particles_res;uniform mat4 u_matrix;varying vec2 v_particle_pos;void main(){vec4 color=texture2D(u_particles,vec2(fract(a_index/u_particles_res),floor(a_index/u_particles_res)/u_particles_res));v_particle_pos=vec2(color.r/255.0+color.b,color.g/255.0+color.a);gl_PointSize=1.0;gl_Position=u_matrix*vec4(v_particle_pos.xy,0,1);}";

  var drawFrag = "precision mediump float;uniform sampler2D u_wind;uniform vec2 u_wind_min;uniform vec2 u_wind_max;uniform sampler2D u_color_ramp;varying vec2 v_particle_pos;void main(){vec2 velocity=mix(u_wind_min,u_wind_max,texture2D(u_wind,v_particle_pos).rg);float speed_t=length(velocity)/length(u_wind_max);vec2 ramp_pos=vec2(fract(16.0*speed_t),floor(16.0*speed_t)/16.0);gl_FragColor=texture2D(u_color_ramp,ramp_pos);}";

  var quadVert = "precision mediump float;attribute vec2 a_pos;varying vec2 v_tex_pos;void main(){v_tex_pos=a_pos;gl_Position=vec4(1.0-2.0*a_pos,0,1);}";

  var screenFrag = "precision mediump float;uniform sampler2D u_screen;uniform float u_opacity;varying vec2 v_tex_pos;void main(){vec4 color=texture2D(u_screen,1.0-v_tex_pos);gl_FragColor=vec4(floor(255.0*color*u_opacity)/255.0);}";

  var updateFrag = "precision highp float;uniform sampler2D u_particles;uniform sampler2D u_wind;uniform vec2 u_wind_res;uniform vec2 u_wind_min;uniform vec2 u_wind_max;uniform float u_rand_seed;uniform float u_speed_factor;uniform float u_drop_rate;uniform float u_drop_rate_bump;varying vec2 v_tex_pos;const vec3 rand_constants=vec3(12.9898,78.233,4375.85453);float rand(const vec2 co){float t=dot(rand_constants.xy,co);return fract(sin(t)*(rand_constants.z+t));}vec2 lookup_wind(const vec2 uv){vec2 px=1.0/u_wind_res;vec2 vc=(floor(uv*u_wind_res))*px;vec2 f=fract(uv*u_wind_res);vec2 tl=texture2D(u_wind,vc).rg;vec2 tr=texture2D(u_wind,vc+vec2(px.x,0)).rg;vec2 bl=texture2D(u_wind,vc+vec2(0,px.y)).rg;vec2 br=texture2D(u_wind,vc+px).rg;return mix(mix(tl,tr,f.x),mix(bl,br,f.x),f.y);}void main(){vec4 color=texture2D(u_particles,v_tex_pos);vec2 pos=vec2(color.r/255.0+color.b,color.g/255.0+color.a);vec2 velocity=mix(u_wind_min,u_wind_max,lookup_wind(pos));float speed_t=length(velocity)/length(u_wind_max);vec2 offset=vec2(velocity.x,-velocity.y)*0.0001*u_speed_factor;pos=fract(1.0+pos+offset);vec2 seed=(pos+v_tex_pos)*u_rand_seed;float drop_rate=u_drop_rate+speed_t*u_drop_rate_bump;float drop=step(1.0-drop_rate,rand(seed));vec2 random_pos=vec2(rand(seed+1.3),rand(seed+2.1));pos=mix(pos,random_pos,drop);gl_FragColor=vec4(fract(pos*255.0),floor(pos*255.0)/255.0);}";

  var WindGL = function WindGL(ref) {
    var this$1 = this;
    var id = ref.id;
    var source = ref.source;
    var properties = ref.properties; if ( properties === void 0 ) properties = {};

    this.id = id;
    this.type = "custom";
    this.renderingMode = "2d";

    this.fadeOpacity = 0.996; // how fast the particle trails fade on each frame
    this.speedFactor = 0.25; // how fast the particles move
    this.dropRate = 0.003; // how often the particles move to a random place
    this.dropRateBump = 0.01; // drop rate increase relative to individual particle speed
    this._numParticles = 65536;
    this._colorRamp = [
      0.0,
      "#3288bd",
      0.1,
      "#66c2a5",
      0.2,
      "#abdda4",
      0.3,
      "#e6f598",
      0.4,
      "#fee08b",
      0.5,
      "#fdae61",
      0.6,
      "#f46d43",
      1.0,
      "#d53e4f"
    ];

    this.resize = this.resize.bind(this);

    Object.entries(properties).forEach(function (ref) {
      var k = ref[0];
      var v = ref[1];

      this$1.setProperty(k, v);
    });

    this.setSource(source);
  };

  var prototypeAccessors = { numParticles: { configurable: true } };

  WindGL.prototype.setProperty = function setProperty (property, value) {
    switch (property) {
      case "particle-fade-opacity":
        this.fadeOpacity = +value;
        break;
      case "particle-speed-factor":
        this.speedFactor = +value;
        break;
      case "particle-reset-rate":
        this.dropRate = +value;
        break;
      case "particle-reset-factor":
        this.dropRateBump = +value;
        break;
      case "particle-count":
        var particleRes = Math.ceil(Math.sqrt(value));
        this._numParticles = particleRes * particleRes;
        if (this.gl) {
          this.setNumParticles(this.gl, this._numParticles);
        }
        break;
      case "wind-speed-color-ramp":
        this._colorRamp = value;
        if (this.gl) {
          this.setColorRamp(this.gl, this._colorRamp);
        }
        break;
      default:
        throw new Error(("Unknown property '" + property + "'."));
    }
    return this;
  };

  WindGL.prototype.setSource = function setSource (ref) {
      var this$1 = this;
      var url = ref.url;

    getJSON(url, function (windData) {
      var windImage = new Image();
      windData.image = windImage;
      var url = windData.tiles[0].replace(/{(z|x|y)}/g, "0");
      if (new URL(url).origin !== window.location.origin) {
        windImage.crossOrigin = "anonymous";
      }
      windImage.src = url;
      windImage.onload = function () { return this$1.setWind(windData); };
    });
  };

  WindGL.prototype.onAdd = function onAdd (map, gl) {
    this.gl = gl;
    this.map = map;
    this.drawProgram = createProgram(gl, drawVert, drawFrag);
    this.screenProgram = createProgram(gl, quadVert, screenFrag);
    this.updateProgram = createProgram(gl, quadVert, updateFrag);

    this.quadBuffer = createBuffer(
      gl,
      new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1])
    );
    this.framebuffer = gl.createFramebuffer();

    this.setColorRamp(gl, this._colorRamp);
    this.setNumParticles(gl, this._numParticles);

    this.resize();

    map.on("resize", this.resize);
  };

  WindGL.prototype.onRemove = function onRemove (map) {
    delete this.gl;
    delete this.map;
    map.off("resize", this.resize);
  };

  WindGL.prototype.resize = function resize () {
    var gl = this.gl;
    var emptyPixels = new Uint8Array(gl.canvas.width * gl.canvas.height * 4);
    // screen textures to hold the drawn screen for the previous and the current frame
    this.backgroundTexture = createTexture(
      gl,
      gl.NEAREST,
      emptyPixels,
      gl.canvas.width,
      gl.canvas.height
    );
    this.screenTexture = createTexture(
      gl,
      gl.NEAREST,
      emptyPixels,
      gl.canvas.width,
      gl.canvas.height
    );
  };

  WindGL.prototype.setColorRamp = function setColorRamp (gl, colors) {
    // lookup texture for colorizing the particles according to their speed
    this.colorRampTexture = createTexture(
      gl,
      gl.LINEAR,
      getColorRamp(colors),
      16,
      16
    );
  };

  WindGL.prototype.setNumParticles = function setNumParticles (gl, numParticles) {
    // we create a square texture where each pixel will hold a particle position encoded as RGBA
    var particleRes = (this.particleStateResolution = Math.ceil(
      Math.sqrt(numParticles)
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
  prototypeAccessors.numParticles.get = function () {
    return this._numParticles;
  };

  WindGL.prototype.setWind = function setWind (windData) {
    this.windData = windData;
    this.windTexture = createTexture(
      this.gl,
      this.gl.LINEAR,
      windData.image
    );
    if (this.map) {
      this.map.triggerRepaint();
    }
  };

  WindGL.prototype.prerender = function prerender (gl, matrix) {
    if (this.windData) { this.draw(gl, matrix); }
  };

  WindGL.prototype.render = function render (gl, matrix) {
    if (this.windData) {
      this.drawTexture(this.screenTexture, 1.0);
      this.map.triggerRepaint();
    }
  };

  WindGL.prototype.draw = function draw (gl, matrix) {
    var blendingEnabled = gl.isEnabled(gl.BLEND);
    gl.disable(gl.BLEND);

    bindTexture(gl, this.windTexture, 0);
    bindTexture(gl, this.particleStateTexture0, 1);

    this.drawScreen(gl, matrix);
    this.updateParticles();
    if (blendingEnabled) { gl.enable(gl.BLEND); }
  };

  WindGL.prototype.drawScreen = function drawScreen (gl, matrix) {
    // draw the screen into a temporary framebuffer to retain it as the background on the next frame
    bindFramebuffer(gl, this.framebuffer, this.screenTexture);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    this.drawTexture(this.backgroundTexture, this.fadeOpacity);
    this.drawParticles(gl, matrix);

    // save the current screen as the background for the next frame
    var temp = this.backgroundTexture;
    this.backgroundTexture = this.screenTexture;
    this.screenTexture = temp;
  };

  WindGL.prototype.drawTexture = function drawTexture (texture, opacity) {
    var gl = this.gl;
    var program = this.screenProgram;
    gl.useProgram(program.program);

    bindAttribute(gl, this.quadBuffer, program.a_pos, 2);
    bindTexture(gl, texture, 2);
    gl.uniform1i(program.u_screen, 2);
    gl.uniform1f(program.u_opacity, opacity);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  };

  WindGL.prototype.drawParticles = function drawParticles (gl, matrix) {
    var program = this.drawProgram;
    gl.useProgram(program.program);

    bindAttribute(gl, this.particleIndexBuffer, program.a_index, 1);
    bindTexture(gl, this.colorRampTexture, 2);

    gl.uniform1i(program.u_wind, 0);
    gl.uniform1i(program.u_particles, 1);
    gl.uniform1i(program.u_colorRamp, 2);

    gl.uniform1f(program.u_particles_res, this.particleStateResolution);
    gl.uniform2f(program.u_wind_min, this.windData.uMin, this.windData.vMin);
    gl.uniform2f(program.u_wind_max, this.windData.uMax, this.windData.vMax);

    gl.uniformMatrix4fv(program.u_matrix, false, matrix);

    gl.drawArrays(gl.POINTS, 0, this._numParticles);
  };

  WindGL.prototype.updateParticles = function updateParticles () {
    var gl = this.gl;
    bindFramebuffer(gl, this.framebuffer, this.particleStateTexture1);
    gl.viewport(
      0,
      0,
      this.particleStateResolution,
      this.particleStateResolution
    );

    var program = this.updateProgram;
    gl.useProgram(program.program);

    bindAttribute(gl, this.quadBuffer, program.a_pos, 2);

    gl.uniform1i(program.u_wind, 0);
    gl.uniform1i(program.u_particles, 1);

    gl.uniform1f(program.u_rand_seed, Math.random());
    gl.uniform2f(program.u_wind_res, this.windData.width, this.windData.height);
    gl.uniform2f(program.u_wind_min, this.windData.uMin, this.windData.vMin);
    gl.uniform2f(program.u_wind_max, this.windData.uMax, this.windData.vMax);
    gl.uniform1f(program.u_speed_factor, this.speedFactor);
    gl.uniform1f(program.u_drop_rate, this.dropRate);
    gl.uniform1f(program.u_drop_rate_bump, this.dropRateBump);

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // swap the particle state textures so the new one becomes the current one
    var temp = this.particleStateTexture0;
    this.particleStateTexture0 = this.particleStateTexture1;
    this.particleStateTexture1 = temp;
  };

  Object.defineProperties( WindGL.prototype, prototypeAccessors );

  function getColorRamp(colors) {
    var canvas = document.createElement("canvas");
    var ctx = canvas.getContext("2d");

    canvas.width = 256;
    canvas.height = 1;

    var gradient = ctx.createLinearGradient(0, 0, 256, 0);
    for (var i = 0; i < colors.length; i += 2) {
      gradient.addColorStop(+colors[i], colors[i + 1]);
    }

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 1);

    return new Uint8Array(ctx.getImageData(0, 0, 256, 1).data);
  }

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

  function index (options) { return new WindGL(options); }

  return index;

})));
