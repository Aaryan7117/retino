function [isGradeable, metrics, feedback] = check_image_quality(imagePath, focusThresh, entropyThresh)
% CHECK_IMAGE_QUALITY
% Problem Statement: SIH26038 (MathWorks) - Image Quality Assessment (IQA)
%
% Automatically evaluates fundus images for adequacy:
% 1. Focus Sharpness (Laplacian energy variance)
% 2. Illumination & Field-of-View (Shannon entropy & channel mean)
% 3. Automated recapture guidance for field healthcare workers
%
% Syntax:
%   [isGradeable, metrics, feedback] = check_image_quality(imagePath)

if nargin < 2, focusThresh = 80.0; end
if nargin < 3, entropyThresh = 4.0; end

rawRGB = imread(imagePath);
gray = rgb2gray(rawRGB);

% 1. Sharpness measure using 2D Laplacian operator
lapKernel = [0 1 0; 1 -4 1; 0 1 0];
lapFiltered = imfilter(double(gray), lapKernel, 'replicate');
sharpnessScore = var(lapFiltered(:));

% 2. Illumination Entropy
entropyScore = entropy(gray);
meanIntensity = mean(gray(:));

% 3. Field of View (FOV) coverage
retinaMask = gray > 15;
fovCoverage = sum(retinaMask(:)) / numel(retinaMask) * 100;

metrics = struct(...
    'Sharpness', sharpnessScore, ...
    'Entropy', entropyScore, ...
    'MeanIntensity', meanIntensity, ...
    'FOVCoverage', fovCoverage);

% Quality evaluation logic
if sharpnessScore < focusThresh
    isGradeable = false;
    feedback = 'REJECT (Out of Focus): Please adjust the camera diopter or stabilize the patient head rest.';
elseif meanIntensity < 25
    isGradeable = false;
    feedback = 'REJECT (Underexposed): Inadequate illumination. Increase flash intensity or check pupil dilation.';
elseif meanIntensity > 215
    isGradeable = false;
    feedback = 'REJECT (Overexposed): Severe flash artifact washing out macular details.';
elseif fovCoverage < 40
    isGradeable = false;
    feedback = 'REJECT (Incomplete Field): Pupil alignment shifted. Center the camera over the optic axis.';
else
    isGradeable = true;
    feedback = 'GRADEABLE: High-quality diagnostic scan. Ready for automated pipeline.';
end

fprintf('[MATLAB IQA] Status: %s | Sharpness: %.1f | Entropy: %.2f\n', ...
    feedback, sharpnessScore, entropyScore);
end
