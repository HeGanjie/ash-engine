import {vec3} from "gl-matrix";
import {buildShader, SHADER_IMPLEMENT_STRATEGY} from "./shader-impl";
import {
  createBufferInfoFromArrays,
  createProgramInfo,
  resizeCanvasToDisplaySize,
  setBuffersAndAttributes,
  setUniforms
} from "./webgl-utils";
import {flatten, flatMap} from "lodash";

export class RayTracingCamera {
  position = vec3.create();
  target = vec3.create();
  fov = Math.PI / 2;
  programInfo = null
  bufferInfo = null
  uniformDict = {}

  constructor() {
  }

  initShader(scene, gl) {
    let [vert, frag] = buildShader(SHADER_IMPLEMENT_STRATEGY.rayTracing, {})
    this.programInfo = createProgramInfo(gl, [vert, frag])
  }

  initBuffer(scene, gl) {
    let vertices = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [1, 1],
      [-1, 1],
      [-1, -1]
    ]
    let arrays = {
      position: {
        numComponents: 2,
        data: flatten(vertices)
      },
      indices:  {
        numComponents: 3,
        data: [
          0, 1, 2,
          3, 4, 5
        ]
      },
    };

    const bufferInfo = createBufferInfoFromArrays(gl, arrays)
    this.bufferInfo = bufferInfo
  }

  render(scene, gl) {
    resizeCanvasToDisplaySize(gl.canvas)
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);

    if (!this.programInfo) {
      this.initShader(scene, gl);
    }
    if (!this.bufferInfo) {
      this.initBuffer(scene, gl)
    }
    gl.useProgram(this.programInfo.program);

    this.uniformDict.u_resolution = [gl.canvas.width, gl.canvas.height]
    setUniforms(this.programInfo.uniformSetters, this.uniformDict);
    setBuffersAndAttributes(gl, this.programInfo.attribSetters, this.bufferInfo);
    gl.drawElements(gl.TRIANGLES, this.bufferInfo.numElements, gl.UNSIGNED_SHORT, 0);
  }
}
