// Hero shader: a simulated ultrasound sector scan with a ghost-shaped cyst.
// Pointer moves steer the probe; drag changes window (x) and level (y), like a DICOM viewer.
(function () {
  const canvas = document.getElementById('scan');
  const out = document.getElementById('wl');
  if (!canvas) return;
  canvas.tabIndex = 0;

  const gl = canvas.getContext('webgl', { antialias: false, preserveDrawingBuffer: false });
  if (!gl) { canvas.replaceWith(Object.assign(document.createElement('p'), { textContent: 'This shader needs WebGL.' })); return; }

  const vs = `attribute vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }`;
  const fs = `
precision highp float;
uniform vec2 uRes; uniform float uTime; uniform float uSteer;
uniform vec2 uGhost; uniform float uW; uniform float uL;

float hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float noise(vec2 p){
  vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y);
}
float fbm(vec2 p){ float v=0., a=.5; for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.03; a*=.5; } return v; }

// Ghost SDF (the GhostRun ghost): round head, straight sides, wavy hem.
float sdGhost(vec2 p){
  float head = length(p - vec2(0., -.03)) - .11;
  vec2 q = p - vec2(0., .06);
  vec2 d = abs(q) - vec2(.11, .09);
  float body = length(max(d,0.)) + min(max(d.x,d.y),0.);
  body = max(body, -( .15 - p.y + .018*sin(p.x*55.) ) );
  return min(head, body);
}

void main(){
  vec2 uv = gl_FragCoord.xy / uRes; uv.y = 1. - uv.y;
  vec2 a = vec2(.5, .03);
  vec2 d = uv - a; d.x *= uRes.x/uRes.y;
  float r = length(d);
  float th = atan(d.x, d.y);
  float hw = .62;
  float inside = step(abs(th - uSteer), hw) * step(.06, r) * step(r, .97);

  // Tissue: layered bands + lateral-stretched speckle in polar space.
  vec2 pol = vec2(th*9., r*60.);
  float speck = hash(floor(pol*vec2(6.,2.)) + floor(uTime*8.)*.013);
  speck = mix(speck, noise(pol*vec2(3.,1.4) + uTime*.15), .5);
  float layers = .55 + .45*sin(r*26. + fbm(vec2(th*3., r*4.))*5.);
  float v = speck * (.35 + .65*layers);
  v *= smoothstep(.06,.12,r);              // near-field dead zone
  v *= exp(-r*1.3);                        // depth attenuation
  v += .25*smoothstep(.02,0.,abs(r-.12-.01*sin(th*14.))); // skin line

  // Ghost cyst: dark inside, bright posterior rim, enhancement shadow below.
  vec2 g = uv - uGhost; g.x *= uRes.x/uRes.y;
  float sd = sdGhost(g);
  float rim = smoothstep(.012,0.,abs(sd));
  v = mix(v, v*.12, smoothstep(.004,-.004,sd));
  v += rim*.55*(.6+.4*speck);
  float eyes = smoothstep(.022,.014,length(g-vec2(-.04,-.03))) + smoothstep(.022,.014,length(g-vec2(.04,-.03)));
  v += eyes*.9;
  float below = step(0., g.y) * smoothstep(.12,.0,abs(g.x)) * smoothstep(.0,.25,g.y) * step(sd,.4);
  v += below*.12;

  // Sweep: a brighter line refreshing across the sector.
  float sweep = fract(uTime*.35);
  float st = mix(uSteer-hw, uSteer+hw, sweep);
  v *= 1. + .35*smoothstep(.03,0.,abs(th-st));

  // Window / level, as in a DICOM viewer (0..255 domain).
  float lo = uL - uW*.5;
  float o = clamp((v*255. - lo)/max(uW,1.), 0., 1.);
  o *= inside;

  // Depth ticks along the right edge of the sector.
  float edge = abs(th - (uSteer+hw));
  float tick = step(edge,.012) * step(fract(r*10.+.5), .08) * step(.1,r) * step(r,.95);
  vec3 col = vec3(o) * vec3(.93,.97,1.);
  col = mix(col, vec3(.9,.65,.2), tick);
  gl_FragColor = vec4(col, 1.);
}`;

  function sh(type, src) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(prog); gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const U = n => gl.getUniformLocation(prog, n);
  const uRes = U('uRes'), uTime = U('uTime'), uSteer = U('uSteer'), uGhost = U('uGhost'), uW = U('uW'), uL = U('uL');

  const state = { steer: 0, tSteer: 0, gx: .5, gy: .55, tgx: .5, tgy: .55, W: 255, L: 128 };
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  function showWL() { out.textContent = `W ${Math.round(state.W)} / L ${Math.round(state.L)}`; }

  let dragging = false, lx = 0, ly = 0;
  canvas.addEventListener('pointerdown', e => { dragging = true; lx = e.clientX; ly = e.clientY; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointerup', () => { dragging = false; });
  canvas.addEventListener('pointercancel', () => { dragging = false; });
  canvas.addEventListener('pointermove', e => {
    const b = canvas.getBoundingClientRect();
    const x = (e.clientX - b.left) / b.width, y = (e.clientY - b.top) / b.height;
    if (dragging) {
      state.W = Math.min(510, Math.max(20, state.W + (e.clientX - lx) * 1.2));
      state.L = Math.min(255, Math.max(0, state.L - (e.clientY - ly) * .8));
      lx = e.clientX; ly = e.clientY; showWL();
    } else {
      state.tSteer = (x - .5) * .5;
      state.tgx = Math.min(.8, Math.max(.2, x));
      state.tgy = Math.min(.8, Math.max(.35, y));
    }
    if (reduce) frame(performance.now());
  });
  canvas.addEventListener('keydown', e => {
    const k = { ArrowRight: [12, 0], ArrowLeft: [-12, 0], ArrowUp: [0, 6], ArrowDown: [0, -6] }[e.key];
    if (!k) return;
    e.preventDefault();
    state.W = Math.min(510, Math.max(20, state.W + k[0]));
    state.L = Math.min(255, Math.max(0, state.L + k[1]));
    showWL(); if (reduce) frame(performance.now());
  });
  canvas.setAttribute('aria-label', 'Simulated ultrasound. Arrow keys change window and level.');

  let visible = true;
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible && !reduce) requestAnimationFrame(loop); }).observe(canvas);

  function frame(t) {
    resize();
    const k = reduce ? 1 : .08;
    state.steer += (state.tSteer - state.steer) * k;
    state.gx += (state.tgx - state.gx) * k * .6;
    state.gy += (state.tgy - state.gy) * k * .6;
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, reduce ? 0 : t / 1000);
    gl.uniform1f(uSteer, state.steer);
    gl.uniform2f(uGhost, state.gx, state.gy);
    gl.uniform1f(uW, state.W); gl.uniform1f(uL, state.L);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  function loop(t) { if (!visible) return; frame(t); requestAnimationFrame(loop); }

  showWL();
  if (reduce) frame(0); else requestAnimationFrame(loop);
  addEventListener('resize', () => frame(performance.now()));
})();
