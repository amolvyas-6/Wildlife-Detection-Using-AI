import io
import json
import os
import tempfile
import time
from base64 import b64encode

import cv2
import numpy as np
import pika
from minio import Minio
from ultralytics import YOLO

# Configuration
MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "minio:9000")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "minioadmin")
BUCKET_NAME = "wildlife-images"

RABBITMQ_HOST = os.getenv("RABBITMQ_HOST", "rabbitmq")
QUEUE_NAME = "ai_processing_queue"

# YOLO Model Configuration
MODEL_PATH = os.getenv(
    "YOLO_MODEL", "yolov8n.pt"
)  # Use yolov8n for speed, yolov8s/m/l/x for accuracy
CONFIDENCE_THRESHOLD = float(os.getenv("CONFIDENCE_THRESHOLD", "0.5"))

# Initialize MinIO Client
minio_client = Minio(
    MINIO_ENDPOINT,
    access_key=MINIO_ACCESS_KEY,
    secret_key=MINIO_SECRET_KEY,
    secure=False,
)

# Initialize YOLO Model (loaded once at startup)
print(f"Loading YOLO model: {MODEL_PATH}")
model = YOLO(MODEL_PATH)
print("YOLO model loaded successfully!")

# Wildlife animal classes from COCO dataset that YOLO can detect
# These are the animal classes we want to filter for
WILDLIFE_CLASSES = {
    "bird",
    "cat",
    "dog",
    "horse",
    "sheep",
    "cow",
    "elephant",
    "bear",
    "zebra",
    "giraffe",
    # Additional animals that might be in extended models
    "lion",
    "tiger",
    "deer",
    "monkey",
    "rabbit",
    "squirrel",
    "fox",
    "wolf",
    "leopard",
    "cheetah",
    "kangaroo",
    "panda",
    "koala",
    "hippopotamus",
    "rhinoceros",
    "crocodile",
    "alligator",
    "snake",
    "lizard",
    "turtle",
    "frog",
    "fish",
    "shark",
    "whale",
    "dolphin",
    "seal",
    "penguin",
    "owl",
    "eagle",
    "hawk",
    "parrot",
    "flamingo",
    "peacock",
}


def is_wildlife_animal(class_name):
    """Check if the detected class is a wildlife animal."""
    return class_name.lower() in WILDLIFE_CLASSES


# Color palette for bounding boxes (BGR format for OpenCV)
COLORS = [
    (255, 0, 0),  # Blue
    (0, 255, 0),  # Green
    (0, 0, 255),  # Red
    (255, 255, 0),  # Cyan
    (255, 0, 255),  # Magenta
    (0, 255, 255),  # Yellow
    (128, 0, 255),  # Purple
    (255, 128, 0),  # Orange
    (0, 128, 255),  # Light Orange
    (255, 0, 128),  # Pink
]


def get_color_for_class(class_name):
    """Get a consistent color for a class name."""
    return COLORS[hash(class_name) % len(COLORS)]


def draw_bounding_boxes(image, detections):
    """
    Draw bounding boxes and labels on the image.

    Args:
        image: numpy array (BGR format)
        detections: list of detection dictionaries with class, confidence, bbox

    Returns:
        Annotated image as numpy array
    """
    annotated = image.copy()

    for det in detections:
        bbox = det["bbox"]
        class_name = det["class"]
        confidence = det["confidence"]

        x1, y1 = int(bbox["x1"]), int(bbox["y1"])
        x2, y2 = int(bbox["x2"]), int(bbox["y2"])

        color = get_color_for_class(class_name)

        # Draw rectangle
        cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)

        # Prepare label
        label = f"{class_name}: {confidence:.0%}"

        # Get text size for background rectangle
        font = cv2.FONT_HERSHEY_SIMPLEX
        font_scale = 0.6
        thickness = 2
        (text_width, text_height), baseline = cv2.getTextSize(
            label, font, font_scale, thickness
        )

        # Draw background rectangle for text
        cv2.rectangle(
            annotated,
            (x1, y1 - text_height - 10),
            (x1 + text_width + 10, y1),
            color,
            -1,
        )

        # Draw text
        cv2.putText(
            annotated,
            label,
            (x1 + 5, y1 - 5),
            font,
            font_scale,
            (255, 255, 255),
            thickness,
        )

    return annotated


def save_annotated_image_to_minio(image, task_id, suffix="annotated"):
    """
    Save an annotated image to MinIO and return the object name.

    Args:
        image: numpy array (BGR format)
        task_id: task identifier
        suffix: suffix for the filename

    Returns:
        Object name in MinIO
    """
    # Encode image as JPEG
    _, buffer = cv2.imencode(".jpg", image, [cv2.IMWRITE_JPEG_QUALITY, 90])
    image_bytes = buffer.tobytes()

    object_name = f"annotated/{task_id}_{suffix}.jpg"

    minio_client.put_object(
        BUCKET_NAME,
        object_name,
        io.BytesIO(image_bytes),
        length=len(image_bytes),
        content_type="image/jpeg",
    )

    return object_name


def run_yolo_detection_image(image_data, task_id):
    """
    Run YOLO detection on an image.

    Args:
        image_data: Raw bytes of the image
        task_id: Task identifier for saving annotated image

    Returns:
        Dictionary with detection results
    """
    print("Running YOLO inference on image...")

    # Convert bytes to numpy array
    nparr = np.frombuffer(image_data, np.uint8)
    image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if image is None:
        return {
            "detected": False,
            "type": "image",
            "error": "Failed to decode image",
            "detections": [],
        }

    # Get image dimensions
    height, width = image.shape[:2]

    # Run inference
    results = model(image, conf=CONFIDENCE_THRESHOLD)

    detections = []
    for result in results:
        boxes = result.boxes
        if boxes is not None:
            for box in boxes:
                cls_id = int(box.cls[0])
                class_name = model.names[cls_id]
                confidence = float(box.conf[0])
                bbox = box.xyxy[0].tolist()  # [x1, y1, x2, y2]

                # Only include wildlife animals
                if not is_wildlife_animal(class_name):
                    continue

                detections.append(
                    {
                        "class": class_name,
                        "confidence": round(confidence, 2),
                        "bbox": {
                            "x1": round(bbox[0], 2),
                            "y1": round(bbox[1], 2),
                            "x2": round(bbox[2], 2),
                            "y2": round(bbox[3], 2),
                        },
                    }
                )

    # Sort by confidence
    detections.sort(key=lambda x: x["confidence"], reverse=True)

    # Only draw bounding boxes and save annotated image if there are wildlife detections
    annotated_object_name = None
    if detections:
        annotated_image = draw_bounding_boxes(image, detections)
        annotated_object_name = save_annotated_image_to_minio(
            annotated_image, task_id, "annotated"
        )

    return {
        "detected": len(detections) > 0,
        "type": "image",
        "detections": detections,
        "total_objects": len(detections),
        "image_dimensions": {"width": width, "height": height},
        "annotated_image": annotated_object_name,
    }


def run_yolo_detection_video(video_data, task_id):
    """
    Run YOLO detection on a video, processing key frames.

    Args:
        video_data: Raw bytes of the video
        task_id: Task identifier for saving annotated frames

    Returns:
        Dictionary with detection results across frames
    """
    print("Running YOLO inference on video...")

    # Write video to temporary file (OpenCV needs a file path for video)
    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp_file:
        tmp_file.write(video_data)
        tmp_path = tmp_file.name

    try:
        cap = cv2.VideoCapture(tmp_path)

        if not cap.isOpened():
            return {
                "detected": False,
                "type": "video",
                "error": "Failed to open video",
                "detections": [],
            }

        fps = cap.get(cv2.CAP_PROP_FPS)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        duration = total_frames / fps if fps > 0 else 0
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

        # Process one frame per second for efficiency
        frame_interval = int(fps) if fps > 0 else 30

        all_detections = []
        frame_count = 0
        frame_index = 0  # Index for naming saved frames

        while True:
            ret, frame = cap.read()
            if not ret:
                break

            # Process only at specified intervals
            if frame_count % frame_interval == 0:
                timestamp_sec = frame_count / fps if fps > 0 else frame_count
                minutes = int(timestamp_sec // 60)
                seconds = int(timestamp_sec % 60)
                timestamp_str = f"{minutes:02d}:{seconds:02d}"

                # Run YOLO on this frame
                results = model(frame, conf=CONFIDENCE_THRESHOLD)

                frame_detections = []
                for result in results:
                    boxes = result.boxes
                    if boxes is not None:
                        for box in boxes:
                            cls_id = int(box.cls[0])
                            class_name = model.names[cls_id]
                            confidence = float(box.conf[0])
                            bbox = box.xyxy[0].tolist()

                            # Only include wildlife animals
                            if not is_wildlife_animal(class_name):
                                continue

                            frame_detections.append(
                                {
                                    "class": class_name,
                                    "confidence": round(confidence, 2),
                                    "bbox": {
                                        "x1": round(bbox[0], 2),
                                        "y1": round(bbox[1], 2),
                                        "x2": round(bbox[2], 2),
                                        "y2": round(bbox[3], 2),
                                    },
                                }
                            )

                # Save annotated frame if there are detections
                annotated_frame_name = None
                if frame_detections:
                    annotated_frame = draw_bounding_boxes(frame, frame_detections)
                    annotated_frame_name = save_annotated_image_to_minio(
                        annotated_frame, task_id, f"frame_{frame_index:04d}"
                    )

                    all_detections.append(
                        {
                            "timestamp": timestamp_str,
                            "timestamp_seconds": round(timestamp_sec, 2),
                            "frame": frame_count,
                            "detections": frame_detections,
                            "annotated_frame": annotated_frame_name,
                        }
                    )

                frame_index += 1

            frame_count += 1

        cap.release()

        # Summarize unique classes detected
        unique_classes = set()
        for frame_data in all_detections:
            for det in frame_data["detections"]:
                unique_classes.add(det["class"])

        return {
            "detected": len(all_detections) > 0,
            "type": "video",
            "duration_seconds": round(duration, 2),
            "frames_processed": frame_count,
            "frames_analyzed": frame_index,
            "frames_with_detections": len(all_detections),
            "unique_classes": list(unique_classes),
            "video_dimensions": {"width": width, "height": height},
            "detections": all_detections,
        }

    finally:
        # Clean up temporary file
        os.unlink(tmp_path)


def callback(ch, method, properties, body):
    try:
        message = json.loads(body)
        print(f" [x] Received task: {message['task_id']}")

        object_name = message["object_name"]
        task_id = message["task_id"]
        file_type = message.get("file_type", "image")

        # Download image/video from MinIO
        try:
            response = minio_client.get_object(BUCKET_NAME, object_name)
            data = response.read()
            response.close()
            response.release_conn()
            print(
                f"Downloaded {file_type} {object_name} from MinIO ({len(data)} bytes)"
            )
        except Exception as e:
            print(f"Error downloading file: {e}")
            ch.basic_ack(delivery_tag=method.delivery_tag)
            return

        # Run YOLO Detection
        if file_type == "video":
            result = run_yolo_detection_video(data, task_id)
        else:
            result = run_yolo_detection_image(data, task_id)

        result["task_id"] = task_id
        result["original_filename"] = message["original_filename"]
        result["original_object"] = object_name
        result["status"] = "completed"

        # Save result to MinIO as JSON
        result_json = json.dumps(result, indent=2).encode("utf-8")
        result_stream = io.BytesIO(result_json)

        result_object_name = f"results/{task_id}.json"

        minio_client.put_object(
            BUCKET_NAME,
            result_object_name,
            result_stream,
            length=len(result_json),
            content_type="application/json",
        )
        print(f"Saved result to {result_object_name}")

        ch.basic_ack(delivery_tag=method.delivery_tag)
        print(" [x] Done")

    except Exception as e:
        print(f"Error processing message: {e}")
        import traceback

        traceback.print_exc()
        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)


def main():
    print("Worker started. Connecting to RabbitMQ...")
    while True:
        try:
            connection = pika.BlockingConnection(
                pika.ConnectionParameters(host=RABBITMQ_HOST)
            )
            channel = connection.channel()
            channel.queue_declare(queue=QUEUE_NAME, durable=True)

            channel.basic_qos(prefetch_count=1)
            channel.basic_consume(queue=QUEUE_NAME, on_message_callback=callback)

            print(" [*] Waiting for messages. To exit press CTRL+C")
            channel.start_consuming()
        except pika.exceptions.AMQPConnectionError:
            print("RabbitMQ not ready yet, retrying in 5 seconds...")
            time.sleep(5)
        except Exception as e:
            print(f"Worker error: {e}")
            time.sleep(5)


if __name__ == "__main__":
    main()
