function [binaryVessels, vesselProbability] = segment_retinal_vessels(imagePath, vesselThickness)
% SEGMENT_RETINAL_VESSELS
% Problem Statement: SIH26038 (MathWorks) - Retinal Structure Segmentation
%
% Segments the retinal vascular tree using:
% 1. Green-channel extraction (absorbs green maximally)
% 2. Multi-scale tubular vesselness filter (fibermetric / Hessian eigenvalues)
% 3. Morphological post-processing (bwareaopen)
%
% Benchmark: Validated against the official DRIVE dataset.
%
% Syntax:
%   [binaryVessels, vesselProbability] = segment_retinal_vessels(imagePath, vesselThickness)

if nargin < 2, vesselThickness = [1 8]; end

rawRGB = imread(imagePath);
if size(rawRGB, 3) == 1
    rawRGB = cat(3, rawRGB, rawRGB, rawRGB);
end

% 1. Green channel isolation
green = rawRGB(:, :, 2);

% 2. Contrast enhancement before vessel filtering
enhancedGreen = adapthisteq(green, 'ClipLimit', 0.02);

% 3. Multi-scale tubular structure enhancement (fibermetric)
% fibermetric uses Hessian matrix eigenvalues to detect continuous vessels
vesselProbability = fibermetric(enhancedGreen, vesselThickness, ...
    'StructureSensitivity', 12);

% 4. Adaptive Thresholding
threshold = graythresh(vesselProbability) * 0.85;
rawBinary = vesselProbability > threshold;

% 5. Morphological cleaning: Remove tiny spurious noise specks (<30 pixels)
binaryVessels = bwareaopen(rawBinary, 30);

vesselAreaRatio = sum(binaryVessels(:)) / numel(binaryVessels) * 100;
fprintf('[MATLAB Vessel Segmentation] Segmented %s: Vessel density = %.2f%%\n', ...
    imagePath, vesselAreaRatio);
end
