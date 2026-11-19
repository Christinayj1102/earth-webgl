"use strict";

// 새로 작성한 부분: 위도와 경도로 구체의 삼각형 목록을 생성합니다.
function createSphere(latitudeBands, longitudeBands) {
  var positions = [];
  var normals = [];
  var colors = [];

  function point(latitude, longitude) {
    var theta = latitude * Math.PI / latitudeBands;
    var phi = longitude * 2.0 * Math.PI / longitudeBands;
    var sinTheta = Math.sin(theta);
    return vec3(sinTheta * Math.cos(phi), Math.cos(theta), sinTheta * Math.sin(phi));
  }

  function colorForLongitude(longitude) {
    var band = longitude / longitudeBands;
    return vec4(0.10 + 0.12 * Math.abs(Math.sin(band * Math.PI * 4.0)),
      0.35 + 0.30 * band, 0.65 + 0.20 * (1.0 - band), 1.0);
  }

  for (var lat = 0; lat < latitudeBands; lat += 1) {
    for (var lon = 0; lon < longitudeBands; lon += 1) {
      var a = point(lat, lon);
      var b = point(lat + 1, lon);
      var c = point(lat + 1, lon + 1);
      var d = point(lat, lon + 1);
      var color = colorForLongitude(lon);

      // 위도/경도 매개화에서 a,b,c는 안쪽을 향하므로 외향 순서로 뒤집습니다.
      addTriangle(a, d, c, color);
      addTriangle(a, c, b, color);
    }
  }

  function addTriangle(a, b, c, color) {
    [a, b, c].forEach(function (vertex) {
      positions.push(vec4(vertex, 1.0));
      normals.push(vertex);
      colors.push(color);
    });
  }

  return { positions: positions, normals: normals, colors: colors };
}

// 교수님 예제 스타일의 초기화/렌더링. WebGLUtils, initShaders, MV.js는 제공 파일입니다.
var canvas;
var gl;
var program;
var sphere;
var modelViewLocation;
var projectionLocation;
var rotation = 0.0;

window.onload = function init() {
  canvas = document.getElementById("glCanvas");
  gl = WebGLUtils.setupWebGL(canvas);
  if (!gl) return;

  program = initShaders(gl, "vertex-shader", "fragment-shader");
  if (program === -1) return;
  gl.useProgram(program);

  sphere = createSphere(32, 64);
  configureAttribute("aPosition", sphere.positions, 4);
  configureAttribute("aNormal", sphere.normals, 3);
  configureAttribute("aColor", sphere.colors, 4);

  modelViewLocation = gl.getUniformLocation(program, "uModelView");
  projectionLocation = gl.getUniformLocation(program, "uProjection");
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(0.03, 0.05, 0.10, 1.0);
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);
  gl.frontFace(gl.CCW);
  gl.cullFace(gl.BACK);
  render();
};

function configureAttribute(name, data, size) {
  var buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, flatten(data), gl.STATIC_DRAW);
  var location = gl.getAttribLocation(program, name);
  gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(location);
}

function render() {
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  var eye = vec3(0.0, 0.0, 3.0);
  var view = lookAt(eye, vec3(0.0, 0.0, 0.0), vec3(0.0, 1.0, 0.0));
  var modelView = mult(view, rotateY(rotation));
  var projection = perspective(45.0, canvas.width / canvas.height, 0.1, 10.0);

  // MV.js 행렬을 GPU에 전달할 때는 제공 함수 flatten()을 사용합니다.
  gl.uniformMatrix4fv(modelViewLocation, false, flatten(modelView));
  gl.uniformMatrix4fv(projectionLocation, false, flatten(projection));
  gl.drawArrays(gl.TRIANGLES, 0, sphere.positions.length);

  rotation = (rotation + 0.35) % 360.0;
  window.requestAnimationFrame(render);
}
