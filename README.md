# NOAA ETOPO 2022 고도 데이터

## 데이터 출처

이 프로젝트는 NOAA National Centers for Environmental Information(NCEI)의
[ETOPO Global Relief Model](https://www.ncei.noaa.gov/products/etopo-global-relief-model)을 사용한다.
사용한 원본은 `ETOPO_2022_v1_15s` Ice Surface 전역 격자이며, NOAA ERDDAP의
[ETOPO 2022 15 arc-second 데이터 접근 페이지](https://coastwatch.pfeg.noaa.gov/erddap/griddap/ETOPO_2022_v1_15s.html)에서 조회했다.
공식 데이터 인용 정보는 NOAA NCEI, *ETOPO 2022 15 Arc-Second Global Relief Model*,
DOI [10.25921/fd45-gt74](https://doi.org/10.25921/fd45-gt74)이다.

원본 해상도는 15 arc-second(0.004166667°)이고, 고도 단위는 미터이다. 원본은
지형과 해저 수심을 함께 포함하므로 음수 고도도 그대로 보존한다. NOAA의 원본
고도는 EGM2008 지오이드 기준이다.

## 전처리 결과

전처리된 파일은 [assets/etopo-2022-1deg.csv](./assets/etopo-2022-1deg.csv)와
[elevation.js](./elevation.js)이다.

- 위도: `-90`부터 `90`까지 1° 간격, 181행
- 경도: `-180`부터 `180`까지 1° 간격, 361열
- 전체 값: `181 × 361 = 65,341`개
- CSV 값: `elevation_m` 미터 단위의 실제 NOAA 고도값
- JavaScript 배열: 위도 우선(flattened row-major) 순서

원본 격자 중심은 정확히 정수가 아니라 `-89.997916...`부터 시작한다. 따라서
15 arc-second 원본에서 240칸마다 샘플링하여 1° 격자로 만들고, 조회 좌표는
가장 가까운 정수 도(degree) 인덱스로 반올림한다. `-90`과 `90`은 원본에서
가장 가까운 남극·북극 셀을 사용하고, `180` 경도는 `-180` 경도를 복제하여
경도 경계가 닫히도록 했다. 북극 행은 NOAA 원본의 최상단 `89.997916...°`
행을 별도로 조회해 반영했다.

## 쌍선형 보간

[elevation.js](./elevation.js)의 `getElevationInterpolated(latitude, longitude)`는
기존 `getElevation()`을 유지하면서 네 격자점 사이를 보간한다.

```text
west = v00 * (1 - fy) + v10 * fy
east = v01 * (1 - fy) + v11 * fy
result = west * (1 - fx) + east * fx
```

정수 좌표에서는 기존 함수를 직접 호출한다. `180°`는 `-180°`와 같은 경도로
처리해 경도 이음새를 주기적으로 연결한다.

## 조회 API

[elevation.js](./elevation.js)의 `getElevation(latitude, longitude)`는
`-90 ≤ latitude ≤ 90`, `-180 ≤ longitude ≤ 180` 범위만 허용하며, 범위를
벗어나면 `RangeError`를 발생시킨다.

인덱스는 다음과 같이 좌표와 정확히 대응한다.

```text
latitudeIndex  = round(latitude)  + 90
longitudeIndex = round(longitude) + 180
flatIndex      = latitudeIndex * 361 + longitudeIndex
```

예를 들어 `getElevation(0, 0)`은 `ELEVATION_DATA[90 * 361 + 180]`을
조회한다. 현재 [index.html](./index.html)은 [elevation.js](./elevation.js)를
[earth.js](./earth.js)보다 먼저 로드한다.

## 대표 좌표 검증

1° 격자에서 반올림된 인덱스로 확인한 결과는 다음과 같다.

| 좌표 | 조회 셀 | 고도(m) | 의미 |
| --- | --- | ---: | --- |
| 에베레스트 부근 `(27.9881, 86.9250)` | `(28, 87)` | `5300.8296` | 고산 지형 |
| 태평양 `(0, -160)` | `(0, -160)` | `-5165.2935` | 해양 수심 |
| 네덜란드 평지 `(52, 5)` | `(52, 5)` | `-1.0357778` | 저지대 평지 |
| 적도·본초자오선 `(0, 0)` | `(0, 0)` | `-4935.732` | 해양 수심 |

에베레스트 좌표의 값은 1° 셀의 대표 고도이므로 정상의 공식 표고
`8848m`와 같지 않다. 실제 구체 변형에서는 이 격자값을 보간하거나 더 높은
해상도 데이터를 사용하면 된다.

## Mesh 적용

기존 [earth.js](./earth.js)의 위도·경도 Mesh 생성 알고리즘은 유지하면서 각
정점의 반지름을 다음 수식으로 변경한다.

```js
var radius = 1.0 + elevationExaggeration * elevation / 6371000.0;
```

`6371000.0`은 실제 지구 평균 반지름(m)이고, `elevationExaggeration`은
HTML 슬라이더로 조절한다. 고도값은 색상뿐 아니라 실제 정점 위치에 적용된다.
삼각형을 만든 뒤 변형된 정점의 두 변에 `cross()`를 적용해 면 법선을 다시
계산하고, 극점의 영벡터 외적은 방사 방향 fallback으로 처리한다.

지구 전체 반지름과 미터 단위 고도의 크기 차이가 매우 크므로, 배율 20은
지형의 높낮이를 시각적으로 확인하기 위한 과장값이다. 현재 Mesh는
`32 × 64` 위도·경도 분할의 비인덱스 삼각형 목록을 사용하므로 정점 수는
`32 × 64 × 2 × 3 = 12,288`개이며, WebGL 1.0의 16비트 인덱스 한계에 걸리지
않는다. 두 극점은 경도별로 같은 반지름을 공유하고, `-180°`와 `180°`는 같은
위치를 사용해 이음새를 닫는다.

## 표면 텍스처

[assets/bluemarble-2048.png](./assets/bluemarble-2048.png)는 NASA Goddard Space
Flight Center Scientific Visualization Studio의 [Blue Marble - A Seamless
Image Mosaic of the Earth](https://svs.gsfc.nasa.gov/2915/)에서 제공하는
2048×1024 PNG를 사용한다. 원본 페이지는 MODIS 기반 전역 true-color mosaic와
다운로드 파일을 제공하며, 사용 시 NASA/GSFC SVS와 Reto Stockli(NASA/GSFC),
NASA Earth Observatory를 크레딧으로 표시하도록 안내한다. 이 프로젝트는 해당
크레딧을 유지하고, 원본 파일을 변경하지 않았다.

Mesh의 위도·경도 인덱스를 다음과 같이 UV로 변환한다.

```text
u = longitudeIndex / longitudeBands
v = latitudeIndex / latitudeBands
```

텍스처는 `UNPACK_FLIP_Y_WEBGL`을 사용해 북극이 이미지의 위쪽에 오도록
업로드한다. `u=0`과 `u=1`은 경도 -180°/180°를 나타내며, 극점에서는 모든
경도가 한 점으로 모이기 때문에 일반적인 equirectangular 텍스처 왜곡이
발생한다. 텍스처 로딩에 실패한 경우에만 기존 고도별 색상 방식으로 fallback한다.
