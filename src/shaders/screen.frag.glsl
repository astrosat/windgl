precision mediump float;

uniform sampler2D u_wind;
uniform vec2 u_wind_res;
uniform vec2 u_wind_min;
uniform vec2 u_wind_max;
uniform float u_opacity;

varying vec2 v_tex_pos;
uniform mat4 u_matrix;

uniform sampler2D u_color_ramp;


const float PI = 3.14159265359;


/**
 * Converts mapbox style pseudo-mercator coordinates (this is just like mercator, but the unit isn't a meter, but 0..1
 * spans the entire world) into texture like WGS84 coordinates (this is just like WGS84, but instead of angles, it uses
 * intervals of 0..1).
 */
vec2 mercatorToWGS84(vec2 xy) {
    // convert lat into an angle
    float y = radians(180.0 - xy.y * 360.0);
    // use the formula to convert mercator -> WGS84
    y = 360.0 / PI  * atan(exp(y)) - 90.0;
    // normalize back into 0..1 interval
    y = y / -180.0 + 0.5;
    // pass lng through, as it doesn't change
    return vec2(xy.x, y);
}

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

/**
 * Returns the magnitude of the wind speed vector as a proportion of the maximum speed.
 */
float windSpeed(const vec2 uv) {
    vec2 velocity = mix(u_wind_min, u_wind_max, windSpeedRelative(uv));
    return length(velocity) / length(u_wind_max);
}

void main() {
    // modulus is used to make sure this wraps nicely when zoomed out
    vec2 tex_pos = mercatorToWGS84(mod(v_tex_pos, 1.0));
    float speed_t = windSpeed(tex_pos);
    // color ramp is encoded in a 16x16 texture
    vec2 ramp_pos = vec2(
        fract(16.0 * speed_t),
        floor(16.0 * speed_t) / 16.0);

    gl_FragColor = texture2D(u_color_ramp, ramp_pos);
}
