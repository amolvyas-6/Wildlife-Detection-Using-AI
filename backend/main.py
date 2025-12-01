from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from minio import Minio
import pika
import json
import uuid
import os
import io

app = FastAPI(title="Wildlife Detection API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

# Ensure bucket exists
try:
    if not minio_client.bucket_exists(BUCKET_NAME):
        minio_client.make_bucket(BUCKET_NAME)
except Exception as e:
    print(f"Error connecting to MinIO: {e}")

def get_rabbitmq_channel():
    connection = pika.BlockingConnection(pika.ConnectionParameters(host=RABBITMQ_HOST))
    channel = connection.channel()
    channel.queue_declare(queue=QUEUE_NAME, durable=True)
    return connection, channel

@app.get("/")
def read_root():
    return {"message": "Wildlife Detection API is running"}

@app.post("/detect")
async def detect_wildlife(file: UploadFile = File(...)):
    try:
        # Generate unique ID
        task_id = str(uuid.uuid4())
        file_extension = file.filename.split(".")[-1]
        object_name = f"{task_id}.{file_extension}"

        # Read file content
        content = await file.read()
        file_stream = io.BytesIO(content)

        # Determine file type
        content_type = file.content_type
        file_type = "video" if "video" in content_type else "image"

        # Upload to MinIO
        minio_client.put_object(
            BUCKET_NAME,
            object_name,
            file_stream,
            length=len(content),
            content_type=content_type
        )

        # Send task to RabbitMQ
        connection, channel = get_rabbitmq_channel()
        message = {
            "task_id": task_id,
            "object_name": object_name,
            "original_filename": file.filename,
            "file_type": file_type
        }
        channel.basic_publish(
            exchange='',
            routing_key=QUEUE_NAME,
            body=json.dumps(message),
            properties=pika.BasicProperties(
                delivery_mode=2,  # make message persistent
            ))
        connection.close()

        return {"task_id": task_id, "status": "queued", "message": f"{file_type.capitalize()} uploaded and queued for processing"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/results/{task_id}")
def get_result(task_id: str):
    # In a real app, we might check a database. 
    # Here, we'll check if a result file exists in MinIO (simple pattern)
    result_object_name = f"results/{task_id}.json"
    try:
        response = minio_client.get_object(BUCKET_NAME, result_object_name)
        result_data = json.loads(response.read())
        response.close()
        response.release_conn()
        return result_data
    except Exception:
        return {"status": "processing", "message": "Result not ready yet or ID invalid"}
