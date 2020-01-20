
export const shadowMapShaderImpl = {
  // language=GLSL
  vert: `#version 300 es
  precision mediump float;

  in vec4 a_position;

  uniform mat4 u_mat4_proj_w2l_transform;

  void main() {
      gl_Position = u_mat4_proj_w2l_transform * a_position;
  }
`,

  // language=GLSL
  frag: `#version 300 es
  precision mediump float;

  out vec4 glFragColor;

  void main() {
      // TODO use single depth layer instead of glFragColor
      // gl_FragDepth = gl_FragCoord.z; // [0, 1]
      glFragColor = vec4(gl_FragCoord.zzz, 1.0);
  }
`

}
