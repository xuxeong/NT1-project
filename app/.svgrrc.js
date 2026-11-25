// SVG 파일을 React Native 컴포넌트로 바꿀 때의 설정 (react-native-svg-transformer).
// Figma에서 내려받은 SVG에는 웹 전용 속성(style="display: block")이 들어 있어서,
// Android에서 경고가 나지 않도록 변환할 때만 제거합니다. 원본 SVG 파일은 그대로 둡니다.
module.exports = {
  native: true,
  plugins: ['@svgr/plugin-svgo', '@svgr/plugin-jsx'],
  svgoConfig: {
    plugins: [
      {
        name: 'preset-default',
        params: {
          overrides: {
            inlineStyles: { onlyMatchedOnce: false },
            removeViewBox: false,
            removeUnknownsAndDefaults: false,
            convertColors: false,
          },
        },
      },
      { name: 'removeAttrs', params: { attrs: ['style'] } },
    ],
  },
};
