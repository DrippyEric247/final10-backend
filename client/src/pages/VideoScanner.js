import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { 
  Camera, 
  Upload, 
  Play, 
  Pause, 
  RotateCcw,
  CheckCircle,
  AlertCircle,
  Loader2,
  Video,
  Search,
  Zap
} from 'lucide-react';
import { scanVideo, trackVideoScanner } from '../lib/api';

const VideoScanner = () => {
  const [videoFile, setVideoFile] = useState(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanResults, setScanResults] = useState(null);
  const [error, setError] = useState(null);

  // Video scanning mutation
  const scanMutation = useMutation({
    mutationFn: scanVideo,
    onSuccess: (data) => {
      setScanResults(data);
      setIsScanning(false);
      setError(null);
    },
    onError: (error) => {
      setError(error.response?.data?.message || 'Video scan failed');
      setIsScanning(false);
    }
  });

  // Track daily task mutation
  const trackTaskMutation = useMutation({
    mutationFn: trackVideoScanner,
    onSuccess: (data) => {
      console.log('Daily task tracked:', data);
    },
    onError: (error) => {
      console.error('Failed to track daily task:', error);
    }
  });

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      setVideoFile(file);
      setVideoUrl(URL.createObjectURL(file));
      setScanResults(null);
      setError(null);
    }
  };

  const handleUrlInput = (event) => {
    setVideoUrl(event.target.value);
    setVideoFile(null);
    setScanResults(null);
    setError(null);
  };

  const handleScan = async () => {
    if (!videoUrl && !videoFile) {
      setError('Please upload a video file or enter a video URL');
      return;
    }

    setIsScanning(true);
    setError(null);

    try {
      // Track daily task completion
      trackTaskMutation.mutate();
      
      // Perform video scan
      const formData = new FormData();
      if (videoFile) {
        formData.append('video', videoFile);
      } else {
        formData.append('videoUrl', videoUrl);
      }

      await scanMutation.mutateAsync(formData);
    } catch (error) {
      console.error('Scan error:', error);
    }
  };

  const resetScanner = () => {
    setVideoFile(null);
    setVideoUrl('');
    setScanResults(null);
    setError(null);
    setIsScanning(false);
  };

  return (
    <div className="min-h-screen bg-gray-900 pt-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl font-extrabold text-white mb-4">
            🤖 AI Video Scanner
          </h1>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto">
            Upload a video or paste a URL to identify products using our advanced AI technology
          </p>
        </motion.div>

        {/* Daily Task Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-xl p-6 mb-8 border border-blue-500/30"
        >
          <div className="flex items-center gap-3 mb-4">
            <Zap className="h-6 w-6 text-blue-400" />
            <h3 className="text-lg font-semibold text-white">Daily Task Bonus</h3>
          </div>
          <p className="text-gray-300">
            Use the AI Video Scanner to earn <span className="text-blue-400 font-semibold">20 points</span> for your daily tasks!
          </p>
        </motion.div>

        {/* Video Input Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="bg-gray-800 rounded-xl p-6 mb-8 border border-gray-700"
        >
          <h2 className="text-2xl font-bold text-white mb-6">Upload Video</h2>
          
          {/* File Upload */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Upload Video File
            </label>
            <div className="flex items-center gap-4">
              <input
                type="file"
                accept="video/*"
                onChange={handleFileUpload}
                className="hidden"
                id="video-upload"
              />
              <label
                htmlFor="video-upload"
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg cursor-pointer transition-colors"
              >
                <Upload className="h-4 w-4" />
                Choose Video
              </label>
              {videoFile && (
                <span className="text-green-400 text-sm">
                  ✓ {videoFile.name}
                </span>
              )}
            </div>
          </div>

          {/* URL Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Or Enter Video URL
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                value={videoUrl}
                onChange={handleUrlInput}
                placeholder="https://example.com/video.mp4"
                className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <button
              onClick={handleScan}
              disabled={isScanning || (!videoUrl && !videoFile)}
              className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
            >
              {isScanning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              {isScanning ? 'Scanning...' : 'Scan Video'}
            </button>
            
            <button
              onClick={resetScanner}
              className="flex items-center gap-2 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </button>
          </div>
        </motion.div>

        {/* Error Display */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-500/20 border border-red-500/30 rounded-xl p-6 mb-8"
          >
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <p className="text-red-400">{error}</p>
            </div>
          </motion.div>
        )}

        {/* Scan Results */}
        {scanResults && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-800 rounded-xl p-6 border border-gray-700"
          >
            <div className="flex items-center gap-3 mb-6">
              <CheckCircle className="h-6 w-6 text-green-400" />
              <h2 className="text-2xl font-bold text-white">Scan Results</h2>
            </div>

            {scanResults.products && scanResults.products.length > 0 ? (
              <div className="space-y-4">
                <p className="text-gray-300 mb-4">
                  Found {scanResults.products.length} product(s) in the video:
                </p>
                
                {scanResults.products.map((product, index) => (
                  <div
                    key={index}
                    className="bg-gray-700 rounded-lg p-4 border border-gray-600"
                  >
                    <div className="flex items-start gap-4">
                      {product.image && (
                        <img
                          src={product.image}
                          alt={product.name}
                          className="w-16 h-16 object-cover rounded-lg"
                        />
                      )}
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-white mb-2">
                          {product.name}
                        </h3>
                        <p className="text-gray-400 text-sm mb-2">
                          {product.description}
                        </p>
                        <div className="flex items-center gap-4">
                          <span className="text-green-400 font-semibold">
                            ${product.price}
                          </span>
                          <span className="text-blue-400 text-sm">
                            Confidence: {product.confidence}%
                          </span>
                        </div>
                        {product.timestamp && (
                          <p className="text-gray-500 text-xs mt-2">
                            Found at: {product.timestamp}s
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Video className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-400">
                  No products detected in this video. Try a different video or check the quality.
                </p>
              </div>
            )}

            {/* AI Analysis */}
            {scanResults.analysis && (
              <div className="mt-6 pt-6 border-t border-gray-600">
                <h3 className="text-lg font-semibold text-white mb-3">AI Analysis</h3>
                <div className="bg-gray-700 rounded-lg p-4">
                  <p className="text-gray-300">{scanResults.analysis}</p>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* How It Works */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="bg-gray-800 rounded-xl p-6 border border-gray-700"
        >
          <h2 className="text-2xl font-bold text-white mb-4">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="bg-purple-500/20 p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <Upload className="h-8 w-8 text-purple-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">1. Upload Video</h3>
              <p className="text-gray-400 text-sm">
                Upload a video file or paste a URL of any video content
              </p>
            </div>
            <div className="text-center">
              <div className="bg-blue-500/20 p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <Search className="h-8 w-8 text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">2. AI Analysis</h3>
              <p className="text-gray-400 text-sm">
                Our AI scans the video to identify products and extract details
              </p>
            </div>
            <div className="text-center">
              <div className="bg-green-500/20 p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">3. Get Results</h3>
              <p className="text-gray-400 text-sm">
                Receive detailed product information and search for deals
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default VideoScanner;


