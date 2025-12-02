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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';

function App() {
  const [file, setFile] = useState(null);
  const [taskId, setTaskId] = useState(null);
  const [status, setStatus] = useState('idle'); // idle, uploading, processing, completed, error
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('image');

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setStatus('idle');
      setResult(null);
      setError(null);
    }
  };

  const handleTabChange = (value) => {
    setActiveTab(value);
    setFile(null);
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
      const response = await axios.post(
        'http://localhost:8000/detect',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );
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
        const response = await axios.get(`http://localhost:8000/results/${id}`);
        if (response.data.status === 'completed') {
          setResult(response.data);
          setStatus('completed');
          clearInterval(interval);
        }
      } catch (err) {
        console.log('Polling...');
      }
    }, 2000);

    // Stop polling after 60 seconds (longer for video)
    setTimeout(() => {
      clearInterval(interval);
      if (status !== 'completed') {
        // setStatus('error')
        // setError('Processing timed out.')
      }
    }, 60000);
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
            using our advanced cloud-native AI pipeline.
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

function UploadCard({ type, file, status, onFileChange, onUpload, accept }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col items-center justify-center gap-6">
          <div className="w-full">
            <label
              htmlFor={`file-upload-${type}`}
              className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-xl cursor-pointer bg-muted/30 hover:bg-muted/60 transition-colors border-muted-foreground/25 hover:border-primary/50"
            >
              <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
                <div className="bg-background p-4 rounded-full shadow-sm mb-4">
                  <Upload className="w-8 h-8 text-primary" />
                </div>
                <p className="mb-2 text-sm font-medium">
                  <span className="text-primary">Click to upload</span> or drag
                  and drop
                </p>
                <p className="text-xs text-muted-foreground">
                  {type === 'image'
                    ? 'SVG, PNG, JPG or GIF (MAX. 800x400px)'
                    : 'MP4, WEBM or OGG (MAX. 50MB)'}
                </p>
              </div>
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

function ImageResults({ result }) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="space-y-2">
        <div className="text-sm font-medium text-muted-foreground">
          Detected Species
        </div>
        <div className="text-3xl font-bold text-primary">{result.class}</div>
        <Badge variant={result.detected ? 'default' : 'secondary'}>
          {result.detected ? 'Wildlife Detected' : 'No Wildlife'}
        </Badge>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium text-muted-foreground">
          Confidence Score
        </div>
        <div className="flex items-center gap-3">
          <Progress value={result.confidence * 100} className="h-3" />
          <span className="font-mono font-bold text-sm w-12 text-right">
            {(result.confidence * 100).toFixed(0)}%
          </span>
        </div>
      </div>
    </div>
  );
}

function VideoResults({ result }) {
  if (!result.detections || result.detections.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No wildlife detected in this video.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold">Timeline of Detections</h4>
        <Badge variant="outline">{result.detections.length} Events</Badge>
      </div>

      <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
        {result.detections.map((detection, index) => (
          <div
            key={index}
            className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
          >
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 text-primary px-2 py-1 rounded text-xs font-mono font-bold flex items-center gap-1">
                <Play className="h-3 w-3" />
                {detection.timestamp}
              </div>
              <span className="font-medium">{detection.class}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-24 h-2 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary"
                  style={{
                    width: `${detection.confidence * 100}%`,
                  }}
                />
              </div>
              <span className="text-xs text-muted-foreground font-mono">
                {(detection.confidence * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
