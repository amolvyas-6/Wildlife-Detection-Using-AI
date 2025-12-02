import pika
import json
import os
import time
import random
from minio import Minio
import io

# Configuration
MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "minio:9000")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "minioadmin")
BUCKET_NAME = "wildlife-images"

RABBITMQ_HOST = os.getenv("RABBITMQ_HOST", "rabbitmq")
QUEUE_NAME = "ai_processing_queue"

# Initialize MinIO Client
minio_client = Minio(
    MINIO_ENDPOINT,
    access_key=MINIO_ACCESS_KEY,
    secret_key=MINIO_SECRET_KEY,
    secure=False
)

def simulate_ai_detection(data, file_type="image"):
    """
    Simulates an AI model detecting wildlife.
    In a real project, you would load a PyTorch/TensorFlow model here.
    """
    print(f"Running AI inference on {file_type}...")

    classes = ["Elephant", "Tiger", "Lion", "Zebra", "Giraffe", "Deer", "No Wildlife Detected"]

    if file_type == "video":
        time.sleep(5) # Simulate longer processing for video
        # Simulate frame-by-frame detection
        detections = []
        # Simulate a 10 second video with detections every second
        for i in range(1, 11):
            detected_class = random.choice(classes)
            if detected_class != "No Wildlife Detected":
                detections.append({
                    "timestamp": f"00:0{i}" if i < 10 else f"00:{i}",
                    "class": detected_class,
                    "confidence": round(random.uniform(0.70, 0.99), 2)
                })
        return {
            "detected": len(detections) > 0,
            "type": "video",
            "detections": detections
        }
    else:
        time.sleep(2)  # Simulate processing time
        detected_class = random.choice(classes)
        confidence = round(random.uniform(0.70, 0.99), 2)

        if detected_class == "No Wildlife Detected":
            confidence = 0.0

        return {
            "detected": detected_class != "No Wildlife Detected",
            "type": "image",
            "class": detected_class,
            "confidence": confidence
        }

def callback(ch, method, properties, body):
    try:
        message = json.loads(body)
        print(f" [x] Received task: {message['task_id']}")

        object_name = message['object_name']
        task_id = message['task_id']
        file_type = message.get('file_type', 'image')

        # Download image/video from MinIO (to simulate reading it for the model)
        try:
            response = minio_client.get_object(BUCKET_NAME, object_name)
            # For video, we might not want to read the whole thing into memory in a real app
            # But for simulation/small files it's fine
            data = response.read()
            response.close()
            response.release_conn()
            print(f"Downloaded {file_type} {object_name} from MinIO")
        except Exception as e:
            print(f"Error downloading file: {e}")
            ch.basic_ack(delivery_tag=method.delivery_tag)
            return

        # Run AI Detection
        result = simulate_ai_detection(data, file_type)
        result['task_id'] = task_id
        result['original_filename'] = message['original_filename']
        result['status'] = 'completed'

        # Save result to MinIO as JSON
        result_json = json.dumps(result).encode('utf-8')
        result_stream = io.BytesIO(result_json)

        result_object_name = f"results/{task_id}.json"

        minio_client.put_object(
            BUCKET_NAME,
            result_object_name,
            result_stream,
            length=len(result_json),
            content_type='application/json'
        )
        print(f"Saved result to {result_object_name}")

        ch.basic_ack(delivery_tag=method.delivery_tag)
        print(" [x] Done")

    except Exception as e:
        print(f"Error processing message: {e}")
        # Optionally nack or retry
        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)

def main():
    print("Worker started. Connecting to RabbitMQ...")
    while True:
        try:
            connection = pika.BlockingConnection(pika.ConnectionParameters(host=RABBITMQ_HOST))
            channel = connection.channel()
            channel.queue_declare(queue=QUEUE_NAME, durable=True)

            channel.basic_qos(prefetch_count=1)
            channel.basic_consume(queue=QUEUE_NAME, on_message_callback=callback)

            print(' [*] Waiting for messages. To exit press CTRL+C')
            channel.start_consuming()
        except pika.exceptions.AMQPConnectionError:
            print("RabbitMQ not ready yet, retrying in 5 seconds...")
            time.sleep(5)
        except Exception as e:
            print(f"Worker error: {e}")
            time.sleep(5)

if __name__ == '__main__':
    main()
