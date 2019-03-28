precision mediump float;

uniform mat4 u_matrix;
uniform vec2 u_dimensions;
uniform sampler2D u_wind;
uniform vec2 u_wind_res;
uniform vec2 u_wind_min;
uniform vec2 u_wind_max;
uniform mat4 u_offset;
uniform sampler2D u_color_ramp;
uniform vec4 u_halo_color;

attribute vec2 a_pos;
attribute vec2 a_corner;

varying vec2 v_center;
varying float v_size;
varying float v_speed;



#pragma glslify: mercatorToWGS84 = require(./mercatorToWGS84)
#pragma glslify: wgs84ToMercator = require(./wgs84ToMercator)
#pragma glslify: transform = require(./transform)


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


export void arrowVertex() {
    float ratio = u_dimensions.x/u_dimensions.y;
    vec2 unit = 0.45 / u_dimensions;
    vec2 pos = mod(a_pos / u_dimensions, vec2(1,1));

    vec2 speed = windSpeed(pos);
    v_speed = length(speed) / length(u_wind_max);
    float angle = atan(speed.x, speed.y);
    v_center = a_corner;
    v_size = length(speed) / length(u_wind_max);

    pos += rotation(angle) *  a_corner * unit;
    // Fix proportions from rectangular projection to square
    pos.x *= u_dimensions.x / u_dimensions.y;

    vec2 worldCoordsWGS84 = transform(pos, u_offset);
    vec2 worldCoordsMerc = wgs84ToMercator(worldCoordsWGS84);

    gl_Position =  u_matrix * vec4(worldCoordsMerc, 0, 1);
    // TODO: This is a HAX because I have no idea why we're seeing double data. This makes it go away at the cost of perf and some ocasional rendering artefacts.
    // if ((pos.x >= 1. || pos.x <= 0.) ) {
    //     gl_Position.y = 10000.0;
    // }
}

const float PI = 3.14159265359;
const float TWO_PI = 6.28318530718;

float polygon(vec3 st, int N) {
    float a = atan(st.x, st.y) + PI;
  	float r = TWO_PI / float(N);

    float d = cos(floor(0.5 + a / r) * r - a) * length(st.xy);
    return d;
}

mat3 scale(vec2 _scale){
    return mat3(1.0 / _scale.x, 0, 0,
                0, 1.0 / _scale.y, 0,
                0, 0, 1);
}

mat3 translate(vec2 _translate) {
    return mat3(1, 0, _translate.x,
                0, 1, _translate.y,
                0, 0, 1);
}

float arrow(vec3 st, float len) {
    return min(
        polygon(st* scale(vec2(0.3)), 3),
        polygon(st* translate(vec2(-0.00, len / 2.0)) * scale(vec2(0.2, len)), 4)
    );
}

export void arrowFragment() {
    vec3 st = vec3(v_center, 1);
    float size = mix(0.25, 4.0, v_size);
    float d = arrow(st * translate(vec2(0, -size / 2.0)), size);

    float inside = 1.0 - smoothstep(0.4, 0.405, d);
    float halo = (1.0 - smoothstep(0.43, 0.435, d)) - inside;
    vec2 ramp_pos = vec2(
        fract(16.0 * v_speed),
        floor(16.0 * v_speed) / 16.0);

    vec4 color = texture2D(u_color_ramp, ramp_pos);
    gl_FragColor = color * inside + halo * u_halo_color;
}
