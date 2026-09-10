import asyncio
from playwright.async_api import Page
from .process_url import process_url
async def url_worker(
    worker_id: int, context, url_queue: asyncio.Queue, failed_urls: list[str]):

    while True:
        url = await url_queue.get()

        print("Worker {worker_id} got URL: {url}")

        try:
            if url is None:
                # None signal mila, worker exit karein
                print(f"Worker {worker_id} exiting.")
                return

            print(f"Worker {worker_id} processing URL: {url}")

            await process_url(context, url, failed_urls, timeout_ms=17000)

        finally:
            url_queue.task_done()

