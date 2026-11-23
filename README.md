# 지형을 반영한 3D 지구

NOAA의 ETOPO 2022 고도 데이터를 이용해 지구 표면의 높낮이를 표현한 WebGL 과제이다. 지구 표면에는 NASA Blue Marble 이미지를 입혔고, 아래 슬라이더로 지형의 과장 정도를 조절할 수 있다.

## 실행 방법

`index.html`을 파일로 직접 여는 경우 Chrome에서 텍스처가 정상적으로 올라가지 않을 수 있다. VS Code에서 Live Server로 실행하는 방법이 가장 간단하다.

1. VS Code에서 `earth-webgl` 폴더 열기
2. 오른쪽 아래 `Go Live` 클릭
3. Chrome에서 `http://127.0.0.1:5500/index.html` 접속

주소가 `file:///`로 시작하면 Live Server로 실행된 상태가 아니다.

## 사용한 데이터

고도 데이터는 NOAA National Centers for Environmental Information(NCEI)의 [ETOPO Global Relief Model](https://www.ncei.noaa.gov/products/etopo-global-relief-model)을 사용했다. 원본 데이터는 NOAA ERDDAP의 [ETOPO 2022 15 arc-second 데이터](https://coastwatch.pfeg.noaa.gov/erddap/griddap/ETOPO_2022_v1_15s.html)에서 확인했다.

원본의 고도 단위는 미터이며 지형의 높이와 해저 수심을 함께 포함한다. 따라서 해수면 아래의 값은 음수로 저장되어 있다. 공식 인용 정보는 NOAA NCEI, *ETOPO 2022 15 Arc-Second Global Relief Model*이며 DOI는 [10.25921/fd45-gt74](https://doi.org/10.25921/fd45-gt74)이다.

표면 텍스처는 NASA Goddard Space Flight Center Scientific Visualization Studio의 [Blue Marble](https://svs.gsfc.nasa.gov/2915/) 이미지를 사용했다.

## 고도 데이터 전처리

`assets/etopo-2022-1deg.csv`에는 위도와 경도를 1° 간격으로 줄인 데이터가 들어 있다.

- 위도: `-90`부터 `90`까지 181개
- 경도: `-180`부터 `180`까지 361개
- 전체 값: `181 × 361 = 65,341`개
- 단위: 미터

원본 15 arc-second 데이터를 240칸마다 샘플링하여 1° 격자로 만들었다. 프로그램에서 좌표를 조회할 때는 가장 가까운 정수 도의 셀을 사용한다. `180°` 경도는 `-180°`와 같은 위치로 처리해 지구가 이어지도록 했다.

## 함수

`elevation.js`에는 다음 두 함수를 사용한다.

- `getElevation(latitude, longitude)`: 정수 격자 기준의 고도 조회
- `getElevationInterpolated(latitude, longitude)`: 주변 네 지점을 이용한 쌍선형 보간

조회 가능한 범위는 위도 `-90° ~ 90°`, 경도 `-180° ~ 180°`이다. 범위를 벗어나면 `RangeError`가 발생한다.

## 지구 Mesh에 적용한 방식

각 정점의 반지름은 고도에 따라 다음과 같이 계산한다.

```js
var radius = 1.0 + elevationExaggeration * elevation / 6371000.0;
```

실제 지구 반지름과 고도 값의 단위 차이가 크기 때문에 기본 과장 배율은 20으로 설정했다. 지형을 눈으로 확인하기 위한 값이며 실제 지구의 비율과는 다르다.

Mesh는 위도 32칸, 경도 64칸으로 나누었다. 각 사각형을 두 개의 삼각형으로 만들고, 고도에 따라 변형된 정점으로 면의 법선을 다시 계산한다. 극점에서는 외적이 0이 될 수 있어 방사 방향을 법선으로 사용한다.

## 파일 구성

- `index.html`: WebGL 화면과 셰이더 코드
- `earth.js`: 지구 Mesh 생성, 텍스처 적용, 렌더링
- `elevation.js`: 고도 데이터와 고도 조회 함수
- `assets/etopo-2022-1deg.csv`: 1° 간격 고도 데이터
- `assets/bluemarble-2048.png`: 지구 표면 텍스처
- `Common/`: 수업에서 제공된 WebGL 공통 파일
