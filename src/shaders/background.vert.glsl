precision mediump float;

attribute vec2 a_pos;

varying vec2 v_tex_pos;

uniform mat4 u_matrix;

uniform float u_dateline_offset;

void main() {
    v_tex_pos = a_pos;
    gl_Position = u_matrix * vec4(a_pos + vec2(u_dateline_offset, 0), 0, 1);
}
