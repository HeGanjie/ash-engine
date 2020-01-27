import pbrVert from '../shader-snippets/pbr-shader.vert'
import pbrFrag from '../shader-snippets/pbr-shader.frag'

export const pbrShaderImpl = {
  genUniforms: material => {
    return {}
  },

  vert: pbrVert,
  frag: pbrFrag
}
