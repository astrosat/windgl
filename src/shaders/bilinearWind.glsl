/**
 * Wind speed lookup. Returns a vector that isn't re-normalized to real world units.
 * Uses manual bilinear filtering based on 4 adjacent pixels for smooth interpolation.
 */
vec2 bilinearWind(const vec2 uv) {
    // return texture2D(u_wind, uv).rg; // lower-res hardware filtering
    vec2 px = 1.0 / windRes;
    vec2 vc = (floor(uv * windRes)) * px;
    vec2 f = fract(uv * windRes);
    vec2 tl = windTexture(vc);
    vec2 tr = windTexture(vc + vec2(px.x, 0));
    vec2 bl = windTexture(vc + vec2(0, px.y));
    vec2 br = windTexture(vc + px);
    return mix(mix(tl, tr, f.x), mix(bl, br, f.x), f.y);
}

#pragma glslify: export(bilinearWind)
