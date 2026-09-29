export default {
 content: ['./index.html', './src/**/*.{ts,tsx}'],
 important: '.store-workspace',
 corePlugins: { preflight: false },
 theme: { extend: { fontFamily: { sans: ['Inter','ui-sans-serif','system-ui','sans-serif'] }, colors: { forest: '#065F46' } } },
 plugins: [],
};
