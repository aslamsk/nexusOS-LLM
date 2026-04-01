const ImageGenTool = require('./tools/imageGen');
const path = require('path');

const prompt = `Premium 3D cartoon fashion scene, a stylish 3D character in a chic blue and white outfit, high-end fashion showroom with minimalist background in cerulean and white tones, floating fashion accessories, soft volumetric lighting, stylish text "MK Fashion" integrated as a 3D logo on the wall, promotional message "Elevate Your Style, Affordably. Shop Mk Fashion!" in clear modern typography, 1200x628 resolution, ultra-high definition, cinematic render`;

const savePath = path.join(process.cwd(), 'outputs', 'mk_fashion_banner_1.png');

console.log('Starting image generation with 16:9 aspect ratio...');
ImageGenTool.generateImage(prompt, savePath, { aspectRatio: "16:9" })
    .then(result => {
        console.log(result);
        process.exit(0);
    })
    .catch(err => {
        console.error('Generation failed:', err);
        process.exit(1);
    });
