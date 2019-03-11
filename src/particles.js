import * as util from "./util";
import Layer from "./layer";

import particleUpdateVert from "./shaders/particle-update.vert.glsl";
import particleUpdateFrag from "./shaders/particle-update.frag.glsl";
import particleDrawVert from "./shaders/particle-draw.vert.glsl";
import particleDrawFrag from "./shaders/particle-draw.frag.glsl";

class Particles extends Layer {
  constructor(options) {
    super(options);
    this.speedFactor = 0.75; // how fast the particles move
    this.dropRate = 0.003; // how often the particles move to a random place
    this.dropRateBump = 0.01; // drop rate increase relative to individual particle speed
    this._numParticles = 65536;
  }

  initializeParticles(gl, count) {
    const particleRes = (this.particleStateResolution = Math.ceil(
      Math.sqrt(count)
    ));
    this._numParticles = particleRes * particleRes;

    const particleState = new Uint8Array(this._numParticles * 4);
    for (let i = 0; i < particleState.length; i++) {
      particleState[i] = Math.floor(Math.random() * 256); // randomize the initial particle positions
    }
    // textures to hold the particle state for the current and the next frame
    this.particleStateTexture0 = util.createTexture(
      gl,
      gl.NEAREST,
      particleState,
      particleRes,
      particleRes
    );
    this.particleStateTexture1 = util.createTexture(
      gl,
      gl.NEAREST,
      particleState,
      particleRes,
      particleRes
    );

    const particleIndices = new Float32Array(this._numParticles);
    for (let i = 0; i < this._numParticles; i++) particleIndices[i] = i;
    this.particleIndexBuffer = util.createBuffer(gl, particleIndices);
  }

  initialize(map, gl) {
    this.updateProgram = util.createProgram(
      gl,
      particleUpdateVert,
      particleUpdateFrag
    );

    this.drawProgram = util.createProgram(
      gl,
      particleDrawVert,
      particleDrawFrag
    );

    this.framebuffer = gl.createFramebuffer();

    this.quadBuffer = util.createBuffer(
      gl,
      new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1])
    );

    this.initializeParticles(gl, this._numParticles);
  }

  prerender(gl, matrix) {
    if (this.windData) this.update(gl, matrix);
  }

  update(gl, matrix) {
    const blendingEnabled = gl.isEnabled(gl.BLEND);
    gl.disable(gl.BLEND);

    util.bindFramebuffer(gl, this.framebuffer, this.particleStateTexture1);
    gl.viewport(
      0,
      0,
      this.particleStateResolution,
      this.particleStateResolution
    );

    const program = this.updateProgram;
    gl.useProgram(program.program);

    util.bindTexture(gl, this.windTexture, 0);
    util.bindTexture(gl, this.particleStateTexture0, 1);

    util.bindAttribute(gl, this.quadBuffer, program.a_pos, 2);

    gl.uniform1i(program.u_wind, 0);
    gl.uniform1i(program.u_particles, 1);

    gl.uniform1f(program.u_rand_seed, Math.random());
    gl.uniform2f(program.u_wind_res, this.windData.width, this.windData.height);
    gl.uniform2f(program.u_wind_min, this.windData.uMin, this.windData.vMin);
    gl.uniform2f(program.u_wind_max, this.windData.uMax, this.windData.vMax);
    gl.uniform1f(program.u_speed_factor, this.speedFactor);
    gl.uniform1f(program.u_drop_rate, this.dropRate);
    gl.uniform1f(program.u_drop_rate_bump, this.dropRateBump);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // swap the particle state textures so the new one becomes the current one
    const temp = this.particleStateTexture0;
    this.particleStateTexture0 = this.particleStateTexture1;
    this.particleStateTexture1 = temp;

    if (blendingEnabled) gl.enable(gl.BLEND);
    this.map.triggerRepaint();
  }

  draw(gl, matrix) {
    const bounds = this.map.getBounds();
    const eastIter = Math.max(0, Math.ceil((bounds.getEast() - 180) / 360));
    const westIter = Math.max(0, Math.ceil((bounds.getWest() + 180) / -360));
    this.drawParticles(gl, matrix, 0);
    for (let i = 1; i <= eastIter; i++) {
      this.drawParticles(gl, matrix, i);
    }
    for (let i = 1; i <= westIter; i++) {
      this.drawParticles(gl, matrix, -i);
    }
  }

  drawParticles(gl, matrix, dateLineOffset) {
    const program = this.drawProgram;
    gl.useProgram(program.program);

    util.bindTexture(gl, this.windTexture, 0);
    util.bindTexture(gl, this.particleStateTexture0, 1);

    util.bindAttribute(gl, this.particleIndexBuffer, program.a_index, 1);

    gl.uniform1i(program.u_wind, 0);
    gl.uniform1i(program.u_particles, 1);

    gl.uniform1f(program.u_particles_res, this.particleStateResolution);
    gl.uniform1f(program.u_dateline_offset, dateLineOffset);
    gl.uniform2f(program.u_wind_min, this.windData.uMin, this.windData.vMin);
    gl.uniform2f(program.u_wind_max, this.windData.uMax, this.windData.vMax);

    gl.uniformMatrix4fv(program.u_matrix, false, matrix);

    gl.drawArrays(gl.POINTS, 0, this._numParticles);
  }
}

export default options => new Particles(options);
