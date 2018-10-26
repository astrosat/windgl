#define M_PI 3.1415926535897932384626433832795

precision mediump float;

attribute float a_index;

uniform sampler2D u_particles;
uniform float u_particles_res;
uniform mat4 u_matrix;

varying vec2 v_particle_pos;

void main() {
    vec4 color = texture2D(u_particles, vec2(
        fract(a_index / u_particles_res),
        floor(a_index / u_particles_res) / u_particles_res));

    // decode current particle position from the pixel's RGBA value
    v_particle_pos = vec2(
        color.r / 255.0 + color.b,
        color.g / 255.0 + color.a);


    gl_PointSize = 1.0;
    gl_Position = u_matrix * vec4(v_particle_pos.xy, 0, 1);
}
