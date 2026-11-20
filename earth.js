"use strict";

// 새로 작성한 부분: 실제 고도를 반영한 위도·경도 구체 Mesh를 생성합니다.
var EARTH_RADIUS_METERS = 6371000.0;
var elevationExaggeration = 20.0;

function createSphere(latitudeBands, longitudeBands) {
  var positions = [];
  var normals = [];
  var colors = [];
  var texCoords = [];

  function point(latitudeIndex, longitudeIndex) {
    var theta = latitudeIndex * Math.PI / latitudeBands;
    var latitude = 90.0 - latitudeIndex * 180.0 / latitudeBands;
    var longitude = longitudeIndex * 360.0 / longitudeBands - 180.0;
    // 두 극점은 경도별 고도 차이로 갈라지지 않도록 하나의 반지름을 공유합니다.
    var elevationLongitude = (latitudeIndex === 0 || latitudeIndex === latitudeBands)
      ? -180.0 : longitude;
    var elevation = getElevationInterpolated(latitude, elevationLongitude);
    var radius = 1.0 + elevationExaggeration * elevation / EARTH_RADIUS_METERS;
    var phi = longitude * Math.PI / 180.0;
    var sinTheta = Math.sin(theta);
    return vec3(radius * sinTheta * Math.cos(phi), radius * Math.cos(theta),
      radius * sinTheta * Math.sin(phi));
  }

  function colorForElevation(elevation) {
    if (elevation < 0.0) {
      return vec4(0.02, 0.16, 0.45, 1.0); // 해양/수심
    }
    if (elevation < 500.0) {
      return vec4(0.20, 0.52, 0.18, 1.0); // 저지대
    }
    if (elevation < 2000.0) {
      return vec4(0.55, 0.42, 0.16, 1.0); // 고지대
    }
    return vec4(0.86, 0.86, 0.82, 1.0); // 고산/설원
  }

  for (var lat = 0; lat < latitudeBands; lat += 1) {
    for (var lon = 0; lon < longitudeBands; lon += 1) {
      var a = point(lat, lon);
      var b = point(lat + 1, lon);
      var c = point(lat + 1, lon + 1);
      var d = point(lat, lon + 1);
      var latitude = 90.0 - lat * 180.0 / latitudeBands;
      var longitude = lon * 360.0 / longitudeBands - 180.0;
      var color = colorForElevation(getElevationInterpolated(latitude, longitude));
      var uvA = texCoord(lat, lon, latitudeBands, longitudeBands);
      var uvB = texCoord(lat + 1, lon, latitudeBands, longitudeBands);
      var uvC = texCoord(lat + 1, lon + 1, latitudeBands, longitudeBands);
      var uvD = texCoord(lat, lon + 1, latitudeBands, longitudeBands);

      // 위도/경도 매개화에서 a,b,c는 안쪽을 향하므로 외향 순서로 뒤집습니다.
      addTriangle(a, d, c, uvA, uvD, uvC, color);
      addTriangle(a, c, b, uvA, uvC, uvB, color);
    }
  }

  function texCoord(latitudeIndex, longitudeIndex, latitudeCount, longitudeCount) {
    return vec2(longitudeIndex / longitudeCount, latitudeIndex / latitudeCount);
  }

  function addTriangle(a, b, c, uvA, uvB, uvC, color) {
    // 고도 변형 후의 실제 변 두 개로 외향 면 법선을 다시 계산합니다.
    var normal = cross(subtract(b, a), subtract(c, a));
    // 극점에서는 두 삼각형 정점이 같은 위치라 외적이 영벡터가 됩니다.
    // 이 경우에는 극점의 방사 방향을 사용해 NaN 법선을 방지합니다.
    if (dot(normal, normal) < 1.0e-12) {
      normal = normalize(add(add(a, b), c));
    } else {
      normal = normalize(normal);
    }
    [[a, uvA], [b, uvB], [c, uvC]].forEach(function (vertexAndUV) {
      var vertex = vertexAndUV[0];
      positions.push(vec4(vertex, 1.0));
      normals.push(normal);
      colors.push(color);
      texCoords.push(vertexAndUV[1]);
    });
  }

  return {
    positions: positions,
    normals: normals,
    colors: colors,
    texCoords: texCoords
  };
}

// 교수님 예제 스타일의 초기화/렌더링. WebGLUtils, initShaders, MV.js는 제공 파일입니다.
var canvas;
var gl;
var program;
var sphere;
var modelViewLocation;
var projectionLocation;
var textureLocation;
var useTextureLocation;
var attributeBuffers = {};
var elevationScaleInput;
var elevationScaleValue;
var textureStatus;
var earthTexture;
var textureReady = false;
var rotation = 0.0;

window.onload = function init() {
  canvas = document.getElementById("glCanvas");
  gl = WebGLUtils.setupWebGL(canvas);
  if (!gl) return;

  program = initShaders(gl, "vertex-shader", "fragment-shader");
  if (program === -1) return;
  gl.useProgram(program);

  elevationScaleInput = document.getElementById("elevationScale");
  elevationScaleValue = document.getElementById("elevationScaleValue");
  textureStatus = document.getElementById("textureStatus");
  elevationScaleInput.addEventListener("input", function () {
    elevationExaggeration = Number(elevationScaleInput.value);
    elevationScaleValue.value = elevationExaggeration;
    sphere = createSphere(32, 64);
    uploadSphereAttributes();
  });
  sphere = createSphere(32, 64);
  uploadSphereAttributes();

  modelViewLocation = gl.getUniformLocation(program, "uModelView");
  projectionLocation = gl.getUniformLocation(program, "uProjection");
  textureLocation = gl.getUniformLocation(program, "uTexture");
  useTextureLocation = gl.getUniformLocation(program, "uUseTexture");
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(0.03, 0.05, 0.10, 1.0);
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);
  gl.frontFace(gl.CCW);
  gl.cullFace(gl.BACK);
  initializeEarthTexture();
  render();
};

function uploadSphereAttributes() {
  configureAttribute("aPosition", sphere.positions, 4);
  configureAttribute("aNormal", sphere.normals, 3);
  configureAttribute("aColor", sphere.colors, 4);
  configureAttribute("aTexCoord", sphere.texCoords, 2);
}

function configureAttribute(name, data, size) {
  var buffer = attributeBuffers[name] || gl.createBuffer();
  attributeBuffers[name] = buffer;
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, flatten(data), gl.STATIC_DRAW);
  var location = gl.getAttribLocation(program, name);
  gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(location);
}

function initializeEarthTexture() {
  earthTexture = gl.createTexture();
  var image = new Image();
  image.onload = function () {
    gl.bindTexture(gl.TEXTURE_2D, earthTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
    textureReady = true;
    textureStatus.textContent = "텍스처 준비 완료";
  };
  image.onerror = function () {
    textureReady = false;
    textureStatus.textContent = "텍스처 로딩 실패: 고도 색상 사용";
    console.error("Unable to load assets/bluemarble-2048.png");
  };
  image.src = "assets/bluemarble-2048.png";
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
  gl.uniform1i(textureLocation, 0);
  // 텍스처가 로드되면 항상 사용하고, 실패한 경우에만 고도 색상으로 fallback합니다.
  gl.uniform1i(useTextureLocation, textureReady ? 1 : 0);
  if (textureReady) {
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, earthTexture);
  }
  gl.drawArrays(gl.TRIANGLES, 0, sphere.positions.length);

  rotation = (rotation + 0.35) % 360.0;
  window.requestAnimationFrame(render);
}
