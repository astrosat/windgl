precision highp float;

#pragma glslify: wgs84ToMercator = require(./wgs84ToMercator)
#pragma glslify: transform = require(./transform)


uniform sampler2D u_particles;

uniform sampler2D u_wind_top_left;
uniform sampler2D u_wind_top_center;
uniform sampler2D u_wind_top_right;
uniform sampler2D u_wind_middle_left;
uniform sampler2D u_wind_middle_center;
uniform sampler2D u_wind_middle_right;
uniform sampler2D u_wind_bottom_left;
uniform sampler2D u_wind_bottom_center;
uniform sampler2D u_wind_bottom_right;

uniform sampler2D u_color_ramp;

uniform vec2 u_wind_res;
uniform vec2 u_wind_min;
uniform vec2 u_wind_max;
uniform float u_rand_seed;
uniform float u_speed_factor;
uniform float u_drop_rate;
uniform float u_drop_rate_bump;
uniform mat4 u_data_matrix;
uniform bool u_initialize;
uniform float u_particles_res;
uniform mat4 u_matrix;
uniform mat4 u_offset;

attribute vec2 a_pos;

varying vec2 v_tex_pos;

export void particleUpdateVertex() {
    v_tex_pos = a_pos;
    gl_Position = vec4(1.0 - 2.0 * a_pos, 0, 1);
}

// pseudo-random generator
const vec3 rand_constants = vec3(12.9898, 78.233, 4375.85453);
float rand(const vec2 co) {
    float t = dot(rand_constants.xy, co);
    return fract(sin(t) * (rand_constants.z + t));
}

// Fetches the proper wind speed from a 3x3 grid of textures
// input should be in the range of -1..2
vec2 windTexture(const vec2 uv) {
    if (uv.x > 1. && uv.y > 1.) {
        return texture2D(u_wind_bottom_right, uv - vec2(1,1)).rg;
    } else if (uv.x > 0. && uv.y > 1.) {
        return texture2D(u_wind_bottom_center, uv - vec2(0,1)).rg;
    } else if (uv.y > 1.) {
        return texture2D(u_wind_bottom_left, uv - vec2(-1,1)).rg;
    } else if (uv.x > 1. && uv.y > 0.) {
        return texture2D(u_wind_middle_right, uv - vec2(1,0)).rg;
    } else if (uv.x > 0. && uv.y > 0.) {
        return texture2D(u_wind_middle_center, uv - vec2(0,0)).rg;
    } else if (uv.y > 0.) {
        return texture2D(u_wind_middle_left, uv - vec2(-1,0)).rg;
    } else if (uv.x > 1.) {
        return texture2D(u_wind_top_right, uv - vec2(1,-1)).rg;
    } else if (uv.x > 0.) {
        return texture2D(u_wind_top_center, uv - vec2(0,-1)).rg;
    } else {
        return texture2D(u_wind_top_left, uv - vec2(-1,-1)).rg;
    }
}

#pragma glslify: lookup_wind = require(./bilinearWind, windTexture=windTexture, windRes=u_wind_res)

// This actually updates the position of a particle
vec2 update(vec2 pos) {
    vec2 wind_tex_pos = transform(pos, u_data_matrix);
    vec2 velocity = mix(u_wind_min, u_wind_max, lookup_wind(wind_tex_pos));
    float speed_t = length(velocity) / length(u_wind_max);

    vec2 offset = vec2(velocity.x , -velocity.y) * 0.0001 * u_speed_factor;

    // update particle position
    pos = fract(1.0 + pos + offset);

    // a random seed to use for the particle drop
    vec2 seed = (pos + v_tex_pos) * u_rand_seed;

    // drop rate is a chance a particle will restart at random position, to avoid degeneration
    float drop_rate = u_drop_rate + speed_t * u_drop_rate_bump + smoothstep(0.24, 0.5, length(pos - vec2(0.5, 0.5)) * 0.7);
    float drop = step(1.0 - drop_rate, rand(seed));

    vec2 random_pos = vec2(
        0.5 * rand(seed + 1.3) + 0.25,
        0.5 * rand(seed + 2.1) + 0.25);
    return mix(pos, random_pos, drop);
}

export void particleUpdateFragment() {
    vec4 color = texture2D(u_particles, v_tex_pos);
    vec2 pos = vec2(
        color.r / 255.0 + color.b,
        color.g / 255.0 + color.a); // decode particle position from pixel RGBA

    pos = update(pos);
    if (u_initialize) {
        for (int i = 0; i < 100; i++) {
            pos = update(pos);
        }
    }

    // encode the new particle position back into RGBA
    gl_FragColor = vec4(
        fract(pos * 255.0),
        floor(pos * 255.0) / 255.0);
}

attribute float a_index;
varying vec2 v_particle_pos;

vec2 fix(vec4 inp) {
    return inp.xy / inp.w;
}


export void particleDrawVertex() {
    vec4 color = texture2D(u_particles, vec2(
        fract(a_index / u_particles_res),
        floor(a_index / u_particles_res) / u_particles_res));

    // decode current particle position from the pixel's RGBA value
    vec2 relativeCoordsWGS84 = vec2(
        color.r / 255.0 + color.b,
        color.g / 255.0 + color.a);

    vec2 worldCoordsWGS84 = transform(relativeCoordsWGS84, u_offset);
    vec2 worldCoordsMerc = wgs84ToMercator(worldCoordsWGS84);


    v_particle_pos = relativeCoordsWGS84;

    gl_PointSize = 2.0;
    gl_Position = u_matrix * vec4(worldCoordsMerc, 0, 1);
}

export void particleDrawFragment() {
    vec2 velocity = mix(u_wind_min, u_wind_max, windTexture(transform(v_particle_pos, u_data_matrix)));
    float speed_t = length(velocity) / length(u_wind_max);

    // // color ramp is encoded in a 16x16 texture
    vec2 ramp_pos = vec2(
        fract(16.0 * speed_t),
        floor(16.0 * speed_t) / 16.0);

    gl_FragColor = texture2D(u_color_ramp, ramp_pos);
}
