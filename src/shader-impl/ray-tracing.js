import rayTracingVert from '../shader-snippets/ray-tracing.vert'
import rayTracingFrag from '../shader-snippets/ray-tracing.frag'


export const rayTracingShaderImpl = {
  genUniforms: material => {
    // const {kS} = material
    return {
      // u_ks: kS
    }
  },

  vert: rayTracingVert,

  frag: rayTracingFrag

}
