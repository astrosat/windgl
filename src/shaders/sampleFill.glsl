precision mediump float;

#pragma glslify: wgs84ToMercator = require(./wgs84ToMercator)
#pragma glslify: mercatorToWGS84 = require(./mercatorToWGS84)
#pragma glslify: transform = require(./transform)

uniform mat4 u_matrix;
uniform mat4 u_offset;
uniform mat4 u_offset_inverse;
uniform sampler2D u_wind;
uniform vec2 u_wind_res;
uniform vec2 u_wind_min;
uniform vec2 u_wind_max;
uniform float u_opacity;
uniform sampler2D u_color_ramp;
uniform mat4 u_inverse_matrix;

attribute vec2 a_pos;

varying vec2 v_tex_pos; // the position in the texture to find

vec2 windTexture(const vec2 uv) {
    return texture2D(u_wind, uv).rg;
}

#pragma glslify: windSpeedRelative = require(./bilinearWind, windTexture=windTexture, windRes=u_wind_res)

export void sampleFillVertex() {
    vec2 worldCoordsWGS84 = transform(a_pos, u_offset);
    vec2 worldCoordsMerc = wgs84ToMercator(worldCoordsWGS84);
    v_tex_pos = worldCoordsMerc;
    gl_Position = u_matrix * vec4(worldCoordsMerc, 0, 1);
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

export void sampleFillFragment() {
    vec2 globalWGS84 = mercatorToWGS84(v_tex_pos);
    vec2 localWGS84 = transform(globalWGS84, u_offset_inverse);
    float speed_t = windSpeedMagnitude(localWGS84);
    // color ramp is./ encoded in a 16x16 texture
    vec2 ramp_pos = vec2(
        fract(16.0 * speed_t),
        floor(16.0 * speed_t) / 16.0);

    vec4 color = texture2D(u_color_ramp, ramp_pos);

    gl_FragColor = vec4(floor(255.0 * color * u_opacity) / 255.0);
}
