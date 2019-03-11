precision mediump float;

#pragma glslify: mercatorToWGS84 = require(./mercatorToWGS84)

uniform sampler2D u_wind;
uniform vec2 u_wind_res;
uniform vec2 u_wind_min;
uniform vec2 u_wind_max;
uniform float u_opacity;

varying vec2 v_tex_pos;
varying vec2 v_st;

uniform mat4 u_matrix;

uniform sampler2D u_color_ramp;
uniform mat4 u_inverse_matrix;

const float PI = 3.14159265359;




/**
 * Wind speed lookup. Returns a vector that isn't re-normalized to real world units.
 * Uses manual bilinear filtering based on 4 adjacent pixels for smooth interpolation.
 */
vec2 windSpeedRelative(const vec2 uv) {
    // return texture2D(u_wind, uv).rg; // lower-res hardware filtering
    vec2 px = 1.0 / u_wind_res;
    vec2 vc = (floor(uv * u_wind_res)) * px;
    vec2 f = fract(uv * u_wind_res);
    vec2 tl = texture2D(u_wind, vc).rg;
    vec2 tr = texture2D(u_wind, vc + vec2(px.x, 0)).rg;
    vec2 bl = texture2D(u_wind, vc + vec2(0, px.y)).rg;
    vec2 br = texture2D(u_wind, vc + px).rg;
    return mix(mix(tl, tr, f.x), mix(bl, br, f.x), f.y);
}

vec2 windSpeed(const vec2 uv) {
    return mix(u_wind_min, u_wind_max, windSpeedRelative(uv));
}

/**
 * Returns the magnitude of the wind speed vector as a proportion of the maximum speed.
 */
float windSpeedMagnitude(const vec2 uv) {
    return length(windSpeed(uv)) / length(u_wind_max);
}



void main() {
    // modulus is used to make sure this wraps nicely when zoomed out
    vec2 tex_pos = mercatorToWGS84(v_tex_pos);
    float speed_t = windSpeedMagnitude(tex_pos);
    // color ramp is encoded in a 16x16 texture
    vec2 ramp_pos = vec2(
        fract(16.0 * speed_t),
        floor(16.0 * speed_t) / 16.0);

    vec4 color = texture2D(u_color_ramp, ramp_pos);

    gl_FragColor = vec4(floor(255.0 * color * u_opacity) / 255.0);
}
