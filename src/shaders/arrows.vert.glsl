precision mediump float;

attribute vec2 a_pos;
attribute vec2 a_corner;
varying vec2 v_center;
varying float v_size;
varying float v_speed;

uniform mat4 u_matrix;
uniform vec2 u_dimensions;

uniform sampler2D u_wind;
uniform vec2 u_wind_res;
uniform vec2 u_wind_min;
uniform vec2 u_wind_max;
uniform float u_dateline_offset;

#pragma glslify: mercatorToWGS84 = require(./mercatorToWGS84)

/**
 * Wind speed lookup. Returns a vector that isn't re-normalized to real world units.
 * Uses manual bilinear filtering based on 4 adjacent pixels for smooth interpolation.
 */
vec2 windSpeedRelative(const vec2 uv) {
    return texture2D(u_wind, uv).rg; // lower-res hardware filtering
}

vec2 windSpeed(const vec2 uv) {
    return mix(u_wind_min, u_wind_max, windSpeedRelative(uv));
}


mat2 rotation(float angle) {
    return mat2(cos(angle), -sin(angle),
                sin(angle), cos(angle));
}


void main() {
    float ratio = u_dimensions.x/u_dimensions.y;
    vec2 unit = 0.45 / u_dimensions;
    vec2 pos = a_pos / u_dimensions;

    vec2 speed = windSpeed(pos);
    v_speed = length(speed) / length(u_wind_max);
    float angle = atan(speed.x, speed.y);
    v_center = a_corner;
    v_size = length(speed) / length(u_wind_max);

    pos += rotation(angle) *  a_corner * unit;
    // Fix proportions from rectangular projection to square
    pos.x *= u_dimensions.x / u_dimensions.y;

    gl_Position =  u_matrix * vec4(pos + vec2(u_dateline_offset, 0), 0, 1);
    // TODO: This is a HAX because I have no idea why we're seeing double data. This makes it go away at the cost of perf and some ocasional rendering artefacts.
    if ((pos.x >= 1. || pos.x <= 0.) && u_dateline_offset < 0.0) {
        gl_Position.y = 10000.0;
    }
}
