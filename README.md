# Wildlife Detection AI

A Cloud Computing project for detecting wildlife in images using AI, powered by a microservices architecture.

## Project Overview

This project demonstrates a modern cloud-native application architecture using:

- **Frontend:** React (Vite) with Tailwind CSS for a sleek UI.
- **Backend:** Python FastAPI for handling API requests.
- **Worker:** Python service for asynchronous AI processing.
- **Message Queue:** RabbitMQ for decoupling the API and Worker.
- **Storage:** MinIO (S3 compatible object storage) for storing images and results.
- **Reverse Proxy:** Caddy for automatic HTTPS and routing.
- **Deployment:** Docker & Docker Compose for containerization.

## Architecture Flow

1. User uploads an image via the **Frontend**.
2. **Backend** receives the image, saves it to **MinIO**, and pushes a task to **RabbitMQ**.
3. **Worker** consumes the task from **RabbitMQ**, downloads the image from **MinIO**, runs AI detection (simulated), and saves the result back to **MinIO**.
4. **Frontend** polls the **Backend** for results, which fetches them from **MinIO**.

## Prerequisites

- Docker and Docker Compose installed on your machine.

## How to Run

1. Clone this repository (if you haven't already).
2. Navigate to the project root.
3. Run the following command to build and start all services:

```bash
docker-compose up --build
```

4. Access the application:
   - **Frontend (Website):** [http://localhost](http://localhost)
   - **Backend API Docs:** [http://localhost/api/docs](http://localhost/api/docs)
   - **MinIO Console:** [http://localhost:9001](http://localhost:9001) (User: `minioadmin`, Pass: `minioadmin`)
   - **RabbitMQ Management:** [http://localhost/rabbitmq/](http://localhost/rabbitmq/) (User: `guest`, Pass: `guest`)

## Tech Stack Details

- **Frontend:** React, Vite, Tailwind CSS, Lucide React, Axios.
- **Backend:** FastAPI, Uvicorn, MinIO Client, Pika (RabbitMQ client).
- **Worker:** Python, Pika, MinIO Client.
- **Reverse Proxy:** Caddy (automatic HTTPS, reverse proxy).
- **Infrastructure:** Docker, Docker Compose.

## Notes for Evaluation

- The AI detection is currently simulated to ensure the project runs smoothly on all hardware without large model downloads. You can see the simulation logic in `worker/worker.py`.
- The project is fully containerized and can be deployed to any cloud provider supporting Docker.
- Caddy provides automatic HTTPS when deployed with a domain name - just update the Caddyfile with your domain.