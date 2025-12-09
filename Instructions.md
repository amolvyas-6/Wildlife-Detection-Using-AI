# Project Instructions & Architecture Guide

## 🚀 Quick Start (How to Run)

**You do NOT need to install Python, Node.js, or any libraries on your local machine to run this project.**

The only requirement is **Docker** and **Docker Compose**.

### Steps:

1.  **Open a terminal** in the root directory of this project (where `docker-compose.yml` is located).
2.  **Run the following command:**

    ```bash
    docker-compose up --build
    ```

    _(Note: On some newer Docker versions, the command is `docker compose up --build` without the hyphen)._

3.  **Wait for the build to complete.**

    - Docker will automatically download all necessary environments (Python, Node.js, Caddy).
    - It will install all dependencies inside the containers.
    - It will start the Frontend, Backend, Worker, Database (MinIO), and Queue (RabbitMQ).

4.  **Access the Application:**

    - **Website (Frontend):** [http://localhost](http://localhost)
    - **API Docs (Backend):** [http://localhost/api/docs](http://localhost/api/docs)
    - **MinIO Console (Storage):** [http://localhost:9001](http://localhost:9001)
      - _Username:_ `minioadmin`
      - _Password:_ `minioadmin`
    - **RabbitMQ Dashboard (Queue):** [http://localhost/rabbitmq/](http://localhost/rabbitmq/)
      - _Username:_ `guest`
      - _Password:_ `guest`

5.  **To Stop the Project:**
    - Press `Ctrl + C` in the terminal.
    - To remove containers, run: `docker-compose down`

---

## 🏗️ How It Works (Architecture)

This project uses a **Microservices Architecture**. Each component runs in its own isolated container and communicates over a virtual network.

### 1. The Workflow

1.  **User Action**: You upload an image or video on the **Frontend** website.
2.  **Upload**: The Frontend sends the file to the **Backend API**.
3.  **Storage**: The Backend saves the raw file into **MinIO** (Object Storage, similar to AWS S3).
4.  **Queuing**: The Backend creates a "task" (containing the file ID) and sends it to **RabbitMQ**.
    - _Why?_ This allows the backend to respond immediately ("File uploaded!") without making the user wait for the AI to finish processing.
5.  **Processing**: The **Worker** service is constantly listening to RabbitMQ.
    - It picks up the task.
    - It downloads the file from **MinIO**.
    - It runs the AI model (simulated YOLO/Classification).
    - It saves the JSON results back to **MinIO**.
6.  **Result Retrieval**: The **Frontend** automatically polls the Backend every few seconds to check if the results are ready. Once the Worker finishes, the Backend fetches the results from MinIO and displays them.

### 2. The Components

| Service      | Tech Stack                       | Role                                                                                                                                 |
| :----------- | :------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------- |
| **Frontend** | React, Vite, Tailwind, shadcn/ui | The user interface. It handles file uploads and displays results (progress bars for images, timelines for videos). Served via Caddy. |
| **Backend**  | Python, FastAPI                  | The API Gateway. It coordinates between the user, storage, and the queue.                                                            |
| **Worker**   | Python                           | The "Brain". It performs the heavy AI computation in the background so the website stays fast.                                       |
| **MinIO**    | Go (Binary)                      | Object Storage. Stores the actual image/video files and the result JSON files.                                                       |
| **RabbitMQ** | Erlang                           | Message Broker. Ensures no tasks are lost and distributes work to the worker.                                                        |

### 3. Why this is "Cloud Native"

- **Containerization**: Everything is packaged in Docker. It runs exactly the same on your laptop as it would on a massive server.
- **Decoupling**: The Frontend doesn't know about the AI. The Backend doesn't do the heavy lifting. If 1000 users upload files, we can just add more **Worker** containers without changing the code.
- **Scalability**: We use a message queue (RabbitMQ) to handle load spikes.
- **Automatic HTTPS**: Caddy provides automatic HTTPS certificate management when deployed with a domain name.

---

## 🐳 Docker Internals: Data & Networking

### 1. Where are my files stored? (Data Persistence)

When you upload files, they are stored in a **`data`** folder inside this project directory.

- **Will I lose my files if I stop the container?**
  **NO.** We use "Bind Mounts" which map a folder on your computer to a folder inside the container.
- **The Data Folders:**

  - `./data/minio`: Stores all your uploaded images/videos and the JSON results.
  - `./data/rabbitmq`: Stores the queue data (ensuring tasks aren't lost if the server crashes).

  _You can open these folders in your file explorer to see the raw data being stored!_

- **How to reset everything (Delete all data):**
  If you want to completely wipe the database and start fresh, simply delete the `data` folder:
  ```bash
  sudo rm -rf data/
  ```
  _(Note: You might need `sudo` because Docker creates these files as the root user)._

### 2. How do containers talk to each other? (Networking)

We created a custom internal network called `wildlife-network`.

- **Isolation**: This network is isolated from the outside world. Only ports we explicitly expose (like 80, 443) are accessible from your computer.
- **Service Discovery**: Inside this network, containers call each other by their **service name**, not IP address.
  - The Backend talks to MinIO using the hostname `minio` (e.g., `http://minio:9000`).
  - The Worker talks to RabbitMQ using the hostname `rabbitmq`.
  - Docker's internal DNS handles resolving these names to the correct internal IP addresses automatically.

### 3. Reverse Proxy with Caddy

Caddy acts as the main entry point and reverse proxy for all services:

- `/` → Frontend (React app)
- `/api/*` → Backend (FastAPI)
- `/rabbitmq/*` → RabbitMQ Management (Queue UI)

MinIO Console is accessed directly on port 9001 (not through the reverse proxy) as it doesn't support subpath routing well.

---

## 🔒 Production Deployment with HTTPS

To enable automatic HTTPS in production:

1. Point your domain to your server's IP address
2. Update the Caddyfile with your domain name (replace `:80` with `yourdomain.com`)
3. Expose port 443 in docker-compose.yml
4. Caddy will automatically obtain and renew SSL certificates from Let's Encrypt