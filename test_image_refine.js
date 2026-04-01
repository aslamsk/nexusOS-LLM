const ImageGenTool = require('./tools/imageGen');
const path = require('path');

const prompt = `a blue luxury sports car`;
const savePath = path.join(process.cwd(), 'outputs', 'test_refined_car.png');

console.log('Testing ImageGen with AUTO-REFINEMENT...');
ImageGenTool.generateImage(prompt, savePath, { aspectRatio: "16:9", refine: true })
    .then(result => {
        console.log(result);
        process.exit(0);
    })
    .catch(err => {
        console.error('Test failed:', err);
        process.exit(1);
    });
