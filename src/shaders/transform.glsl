vec2 transform(vec2 inp, mat4 matrix) {
    vec4 transformed = matrix * vec4(inp, 1, 1);
    return transformed.xy / transformed.w;
}

#pragma glslify: export(transform)
