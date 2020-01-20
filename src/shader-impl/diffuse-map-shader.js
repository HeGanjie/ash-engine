
export const diffuseMapShaderImpl = {
  // language=GLSL
  vert: `#version 300 es
      precision mediump float;
      precision mediump int;

      in vec4 a_position;
      in vec2 a_diffuse_texcoord;

      uniform mat4 u_mat4_pp_w2c_transform;

      out vec2 v_diffuse_texcoord;


      void main() {
          gl_Position = u_mat4_pp_w2c_transform * a_position;
          v_diffuse_texcoord = a_diffuse_texcoord;
      }
  `,

  // language=GLSL
  frag: `#version 300 es
      precision mediump float;

      in vec2 v_diffuse_texcoord;
      uniform sampler2D u_mainTexture;
      uniform float u_kd;
      
      out vec4 glFragColor;

      void main() {
          glFragColor = vec4(0, 0, 0, 1);
          //  glFragColor = vec4(0.1, 0.1, 0.1, 1); // ambient

          vec3 pointColor = texture(u_mainTexture, v_diffuse_texcoord).rgb;
          glFragColor.rgb += pointColor * u_kd;
      }
  `

}
