function [enhancedImage, greenChannel] = adaptive_clahe_retina(imagePath, clipLimit, numTiles)
% ADAPTIVE_CLAHE_RETINA
% Problem Statement: SIH26038 (MathWorks) - Image Enhancement Module
% 
% Implements green-channel isolation and Contrast-Limited Adaptive
% Histogram Equalization (CLAHE) using Image Processing Toolbox.
%
% Syntax:
%   [enhancedImage, greenChannel] = adaptive_clahe_retina(imagePath, clipLimit, numTiles)
%
% Inputs:
%   imagePath - Path to fundus image (.jpg, .png, .tif)
%   clipLimit - Contrast limit factor (default: 0.02)
%   numTiles  - Tile grid size [M N] (default: [8 8])
%
% Outputs:
%   enhancedImage - Full RGB image with enhanced green channel
%   greenChannel  - Enhanced 2D green channel matrix

if nargin < 2, clipLimit = 0.02; end
if nargin < 3, numTiles = [8 8]; end

% 1. Read input fundus scan
rawRGB = imread(imagePath);
if size(rawRGB, 3) == 1
    rawRGB = cat(3, rawRGB, rawRGB, rawRGB);
end

% 2. Extract Green Channel (Maximum microvascular and hemorrhage contrast)
green = rawRGB(:, :, 2);

% 3. Apply CLAHE using MATLAB Image Processing Toolbox
enhancedGreen = adapthisteq(green, ...
    'ClipLimit', clipLimit, ...
    'NumTiles', numTiles, ...
    'Distribution', 'rayleigh');

% 4. Re-assemble RGB image
enhancedImage = rawRGB;
enhancedImage(:, :, 2) = enhancedGreen;

fprintf('[MATLAB Preprocessing] Green-Channel CLAHE applied successfully to: %s\n', imagePath);
end
