precision mediump float;

attribute vec2 a_pos;

varying vec2 v_tex_pos;
varying vec2 v_st;

uniform mat4 u_inverse_matrix;


/**
 * Converts 3D homogenous coordinates into actual 2D coordinates.
 */
vec2 fix(vec4 inp) {
    return inp.xy / inp.w;
}

void main() {
    v_tex_pos =  fix(u_inverse_matrix * vec4(-2.0 * a_pos + 1.0, 1, 1));
    v_st = vec2(1.0 - 2.0 * a_pos);
    gl_Position =  vec4(1.0 - 2.0 * a_pos, 0, 1);
}
