import lambertVert from '../shader-snippets/labmert-shader.vert'
import lambertFrag from '../shader-snippets/lambert-shader.frag'

export const lambertShaderImpl = {
  genUniforms: material => {
    const {albedo, kS, specularExp} = material
    return {
      u_albedoDivPI: albedo / Math.PI,
      u_ks: kS,
      u_specularExp: specularExp,
    }
  },

  vert: lambertVert,

  frag: lambertFrag
}
