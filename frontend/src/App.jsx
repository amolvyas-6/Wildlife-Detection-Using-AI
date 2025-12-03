import { useState } from 'react';
import axios from 'axios';
import {
  Upload,
  CheckCircle,
  AlertCircle,
  Loader2,
  Camera,
  Video,
  Image as ImageIcon,
  Play,
  Box,
  Target,
  Clock,
  Layers,
  ZoomIn,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';

const API_BASE_URL = '/api';

function App() {
  const [file, setFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [taskId, setTaskId] = useState(null);
  const [status, setStatus] = useState('idle'); // idle, uploading, processing, completed, error
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('image');

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setStatus('idle');
      setResult(null);
      setError(null);

      // Create preview URL for the selected file
      const previewUrl = URL.createObjectURL(selectedFile);
      setFilePreview(previewUrl);
    }
  };

  const handleTabChange = (value) => {
    setActiveTab(value);
    setFile(null);
    setFilePreview(null);
    setStatus('idle');
    setResult(null);
    setError(null);
  };

  const handleUpload = async () => {
    if (!file) return;

    setStatus('uploading');
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`${API_BASE_URL}/detect`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      setTaskId(response.data.task_id);
      setStatus('processing');
      pollResult(response.data.task_id);
    } catch (err) {
      console.error(err);
      setError('Upload failed. Please try again.');
      setStatus('error');
    }
  };

  const pollResult = async (id) => {
    const interval = setInterval(async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/results/${id}`);
        if (response.data.status === 'completed') {
          setResult(response.data);
          setStatus('completed');
          clearInterval(interval);
        }
      } catch (err) {
        console.log('Polling...');
      }
    }, 2000);

    // Stop polling after 120 seconds (longer for video)
    setTimeout(() => {
      clearInterval(interval);
      if (status !== 'completed') {
        // setStatus('error')
        // setError('Processing timed out.')
      }
    }, 120000);
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans antialiased flex flex-col">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-primary text-primary-foreground p-2 rounded-lg">
              <Camera className="h-6 w-6" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">WildlifeAI</h1>
          </div>
          <nav>
            <ul className="flex gap-6 text-sm font-medium text-muted-foreground">
              <li className="hover:text-primary transition-colors cursor-pointer">
                Dashboard
              </li>
              <li className="hover:text-primary transition-colors cursor-pointer">
                History
              </li>
              <li className="hover:text-primary transition-colors cursor-pointer">
                Settings
              </li>
            </ul>
          </nav>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-12 max-w-4xl">
        <div className="text-center mb-12 space-y-4">
          <h2 className="text-4xl font-extrabold tracking-tight lg:text-5xl">
            Intelligent Wildlife Detection
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Upload images or videos to detect and classify wildlife species
            using our advanced YOLO-powered AI pipeline.
          </p>
        </div>

        <Tabs
          defaultValue="image"
          value={activeTab}
          onValueChange={handleTabChange}
          className="w-full max-w-2xl mx-auto"
        >
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="image" className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4" /> Image Analysis
            </TabsTrigger>
            <TabsTrigger value="video" className="flex items-center gap-2">
              <Video className="h-4 w-4" /> Video Analysis
            </TabsTrigger>
          </TabsList>

          <TabsContent value="image">
            <UploadCard
              type="image"
              file={file}
              filePreview={filePreview}
              status={status}
              onFileChange={handleFileChange}
              onUpload={handleUpload}
              accept="image/*"
            />
          </TabsContent>

          <TabsContent value="video">
            <UploadCard
              type="video"
              file={file}
              filePreview={filePreview}
              status={status}
              onFileChange={handleFileChange}
              onUpload={handleUpload}
              accept="video/*"
            />
          </TabsContent>
        </Tabs>

        {/* Results Section */}
        {status === 'completed' && result && (
          <div className="mt-12 max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className="bg-green-100 dark:bg-green-900 p-2 rounded-full">
                    <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <CardTitle>Analysis Complete</CardTitle>
                    <CardDescription>
                      {result.type === 'video'
                        ? 'Video processing finished successfully.'
                        : 'Image analysis finished successfully.'}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <Separator />
              <CardContent className="pt-6">
                {result.type === 'video' ? (
                  <VideoResults result={result} />
                ) : (
                  <ImageResults result={result} />
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {status === 'error' && (
          <div className="mt-8 max-w-2xl mx-auto">
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 text-destructive p-4 flex items-center gap-3">
              <AlertCircle className="h-5 w-5" />
              <p className="font-medium">
                {error || 'Something went wrong. Please try again.'}
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function UploadCard({
  type,
  file,
  filePreview,
  status,
  onFileChange,
  onUpload,
  accept,
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col items-center justify-center gap-6">
          <div className="w-full">
            <label
              htmlFor={`file-upload-${type}`}
              className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-xl cursor-pointer bg-muted/30 hover:bg-muted/60 transition-colors border-muted-foreground/25 hover:border-primary/50 overflow-hidden"
            >
              {filePreview && type === 'image' ? (
                <img
                  src={filePreview}
                  alt="Preview"
                  className="w-full h-full object-contain"
                />
              ) : filePreview && type === 'video' ? (
                <video
                  src={filePreview}
                  className="w-full h-full object-contain"
                  controls={false}
                  muted
                />
              ) : (
                <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
                  <div className="bg-background p-4 rounded-full shadow-sm mb-4">
                    <Upload className="w-8 h-8 text-primary" />
                  </div>
                  <p className="mb-2 text-sm font-medium">
                    <span className="text-primary">Click to upload</span> or
                    drag and drop
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {type === 'image'
                      ? 'PNG, JPG, JPEG or WEBP'
                      : 'MP4, WEBM or AVI (MAX. 100MB)'}
                  </p>
                </div>
              )}
              <input
                id={`file-upload-${type}`}
                type="file"
                className="hidden"
                onChange={onFileChange}
                accept={accept}
              />
            </label>
          </div>

          {file && (
            <div className="flex items-center justify-between w-full p-4 border rounded-lg bg-card shadow-sm">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="bg-primary/10 p-2 rounded">
                  {type === 'image' ? (
                    <ImageIcon className="h-4 w-4 text-primary" />
                  ) : (
                    <Video className="h-4 w-4 text-primary" />
                  )}
                </div>
                <div className="truncate font-medium text-sm">{file.name}</div>
              </div>
              <Button
                onClick={onUpload}
                disabled={status === 'uploading' || status === 'processing'}
              >
                {status === 'uploading' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : status === 'processing' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Analyze'
                )}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ImagePreviewModal({ imageUrl, onClose }) {
  if (!imageUrl) return null;

  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="relative max-w-full max-h-full">
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 text-white hover:text-gray-300 transition-colors"
        >
          <X className="h-8 w-8" />
        </button>
        <img
          src={imageUrl}
          alt="Annotated preview"
          className="max-w-full max-h-[90vh] object-contain rounded-lg"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    </div>
  );
}

function ImageResults({ result }) {
  const [showModal, setShowModal] = useState(false);
  const detections = result.detections || [];
  const totalObjects = result.total_objects || detections.length;
  const annotatedImageUrl = result.annotated_image
    ? `${API_BASE_URL}/images/${result.annotated_image}`
    : null;

  // Group detections by class
  const classCounts = detections.reduce((acc, det) => {
    acc[det.class] = (acc[det.class] || 0) + 1;
    return acc;
  }, {});

  const uniqueClasses = Object.keys(classCounts);

  if (!result.detected || detections.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="bg-muted/50 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
          <Target className="h-8 w-8 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground font-medium">
          No objects detected in this image.
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          Try uploading a different image with clearer subjects.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Annotated Image Preview */}
      {annotatedImageUrl && (
        <div className="space-y-2">
          <h4 className="font-semibold flex items-center gap-2">
            <ImageIcon className="h-4 w-4" />
            Detection Preview
          </h4>
          <div
            className="relative rounded-lg overflow-hidden border bg-muted/30 cursor-pointer group"
            onClick={() => setShowModal(true)}
          >
            <img
              src={annotatedImageUrl}
              alt="Annotated detection result"
              className="w-full h-auto max-h-[400px] object-contain"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 rounded-full p-3">
                <ZoomIn className="h-6 w-6 text-gray-800" />
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Click image to enlarge
          </p>
        </div>
      )}

      {showModal && (
        <ImagePreviewModal
          imageUrl={annotatedImageUrl}
          onClose={() => setShowModal(false)}
        />
      )}

      <Separator />

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-muted/30 rounded-lg p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Box className="h-4 w-4" />
            Total Objects
          </div>
          <div className="text-3xl font-bold text-primary">{totalObjects}</div>
        </div>
        <div className="bg-muted/30 rounded-lg p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Layers className="h-4 w-4" />
            Unique Classes
          </div>
          <div className="text-3xl font-bold text-primary">
            {uniqueClasses.length}
          </div>
        </div>
      </div>

      {/* Class Summary */}
      <div>
        <h4 className="font-semibold mb-3 flex items-center gap-2">
          <Target className="h-4 w-4" />
          Detected Classes
        </h4>
        <div className="flex flex-wrap gap-2">
          {uniqueClasses.map((className) => (
            <Badge
              key={className}
              variant="secondary"
              className="text-sm py-1 px-3"
            >
              {className}
              <span className="ml-2 bg-primary/20 text-primary px-1.5 py-0.5 rounded text-xs font-bold">
                {classCounts[className]}
              </span>
            </Badge>
          ))}
        </div>
      </div>

      <Separator />

      {/* Detailed Detections */}
      <div>
        <h4 className="font-semibold mb-3">All Detections</h4>
        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
          {detections.map((detection, index) => (
            <DetectionCard key={index} detection={detection} index={index} />
          ))}
        </div>
      </div>
    </div>
  );
}

function DetectionCard({ detection, index }) {
  const confidencePercent = (detection.confidence * 100).toFixed(1);
  const bbox = detection.bbox;

  return (
    <div className="border rounded-lg p-4 bg-card hover:bg-muted/30 transition-colors">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 text-primary w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">
            {index + 1}
          </div>
          <span className="font-semibold text-lg capitalize">
            {detection.class}
          </span>
        </div>
        <Badge
          variant={detection.confidence > 0.8 ? 'default' : 'secondary'}
          className="text-sm"
        >
          {confidencePercent}% confidence
        </Badge>
      </div>

      {/* Confidence Bar */}
      <div className="mb-3">
        <div className="flex items-center gap-2">
          <Progress value={detection.confidence * 100} className="h-2 flex-1" />
        </div>
      </div>

      {/* Bounding Box Info */}
      {bbox && (
        <div className="bg-muted/50 rounded p-2 text-xs font-mono text-muted-foreground">
          <span className="text-foreground font-semibold">Bounding Box:</span>{' '}
          x1:{bbox.x1.toFixed(0)}, y1:{bbox.y1.toFixed(0)}, x2:
          {bbox.x2.toFixed(0)}, y2:{bbox.y2.toFixed(0)}
        </div>
      )}
    </div>
  );
}

function VideoResults({ result }) {
  const detections = result.detections || [];
  const uniqueClasses = result.unique_classes || [];
  const framesWithDetections = result.frames_with_detections || 0;
  const durationSeconds = result.duration_seconds || 0;

  if (!result.detected || detections.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="bg-muted/50 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
          <Video className="h-8 w-8 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground font-medium">
          No objects detected in this video.
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          Try uploading a different video with clearer subjects.
        </p>
      </div>
    );
  }

  // Count total detections across all frames
  const totalDetections = detections.reduce(
    (sum, frame) => sum + frame.detections.length,
    0
  );

  return (
    <div className="space-y-6">
      {/* Video Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-muted/30 rounded-lg p-3 text-center">
          <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
            <Clock className="h-3 w-3" />
            Duration
          </div>
          <div className="text-xl font-bold text-primary">
            {durationSeconds.toFixed(1)}s
          </div>
        </div>
        <div className="bg-muted/30 rounded-lg p-3 text-center">
          <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
            <Layers className="h-3 w-3" />
            Classes
          </div>
          <div className="text-xl font-bold text-primary">
            {uniqueClasses.length}
          </div>
        </div>
        <div className="bg-muted/30 rounded-lg p-3 text-center">
          <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
            <Target className="h-3 w-3" />
            Detections
          </div>
          <div className="text-xl font-bold text-primary">
            {totalDetections}
          </div>
        </div>
        <div className="bg-muted/30 rounded-lg p-3 text-center">
          <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
            <Video className="h-3 w-3" />
            Frames
          </div>
          <div className="text-xl font-bold text-primary">
            {framesWithDetections}
          </div>
        </div>
      </div>

      {/* Unique Classes */}
      {uniqueClasses.length > 0 && (
        <div>
          <h4 className="font-semibold mb-3 flex items-center gap-2">
            <Target className="h-4 w-4" />
            Detected Classes
          </h4>
          <div className="flex flex-wrap gap-2">
            {uniqueClasses.map((className) => (
              <Badge
                key={className}
                variant="secondary"
                className="text-sm py-1 px-3 capitalize"
              >
                {className}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <Separator />

      {/* Timeline */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold">Detection Timeline</h4>
          <Badge variant="outline">{detections.length} Timestamps</Badge>
        </div>

        <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
          {detections.map((frameData, index) => (
            <FrameDetectionCard key={index} frameData={frameData} />
          ))}
        </div>
      </div>
    </div>
  );
}

function FrameDetectionCard({ frameData }) {
  const [expanded, setExpanded] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const detectionCount = frameData.detections?.length || 0;

  const annotatedFrameUrl = frameData.annotated_frame
    ? `${API_BASE_URL}/images/${frameData.annotated_frame}`
    : null;

  // Get unique classes in this frame
  const frameClasses = [
    ...new Set(frameData.detections?.map((d) => d.class) || []),
  ];

  return (
    <div className="border rounded-lg overflow-hidden bg-card">
      <div
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 text-primary px-2 py-1 rounded text-xs font-mono font-bold flex items-center gap-1">
            <Play className="h-3 w-3" />
            {frameData.timestamp}
          </div>
          <div className="flex flex-wrap gap-1">
            {frameClasses.slice(0, 3).map((cls) => (
              <Badge key={cls} variant="outline" className="text-xs capitalize">
                {cls}
              </Badge>
            ))}
            {frameClasses.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{frameClasses.length - 3} more
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {detectionCount} {detectionCount === 1 ? 'object' : 'objects'}
          </Badge>
          <span className="text-muted-foreground text-sm">
            {expanded ? '▲' : '▼'}
          </span>
        </div>
      </div>

      {expanded && (
        <div className="border-t bg-muted/20 p-3 space-y-3">
          {/* Frame Preview */}
          {annotatedFrameUrl && (
            <div
              className="relative rounded-lg overflow-hidden border bg-black cursor-pointer group"
              onClick={() => setShowModal(true)}
            >
              <img
                src={annotatedFrameUrl}
                alt={`Frame at ${frameData.timestamp}`}
                className="w-full h-auto max-h-[300px] object-contain"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 rounded-full p-2">
                  <ZoomIn className="h-5 w-5 text-gray-800" />
                </div>
              </div>
            </div>
          )}

          {/* Detection List */}
          <div className="space-y-2">
            {frameData.detections.map((det, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between text-sm bg-background rounded p-2"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium capitalize">{det.class}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${det.confidence * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground font-mono">
                      {(det.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                  {det.bbox && (
                    <span className="text-xs text-muted-foreground font-mono hidden md:inline">
                      [{det.bbox.x1.toFixed(0)}, {det.bbox.y1.toFixed(0)},{' '}
                      {det.bbox.x2.toFixed(0)}, {det.bbox.y2.toFixed(0)}]
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showModal && (
        <ImagePreviewModal
          imageUrl={annotatedFrameUrl}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}

export default App;
