import renderTextureVert from '../shader-snippets/render-texture.vert'
import renderTextureFrag from '../shader-snippets/render-texture.frag'


export const renderTextureShaderImpl = {
  genUniforms: material => {
    // const {kS} = material
    return {
      // u_ks: kS
    }
  },

  vert: renderTextureVert,

  frag: renderTextureFrag

}
