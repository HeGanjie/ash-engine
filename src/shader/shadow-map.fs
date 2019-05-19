#version 300 es

precision mediump float;

flat in int v_layout;
out vec4 glFragColor[NUM_TEXTURES];

void main() {
    // gl_FragDepth = gl_FragCoord.z;
    <% for (let i = 0; i < NUM_TEXTURES; i++) {%>
    if (v_layout == <%= i %>) {
        glFragColor[<%= i %>] = vec4(gl_FragCoord.zzz, 1.0);
    }
    <% } %>
    // glFragColor[0] = vec4(gl_FragCoord.zzz, 1.0);
}
