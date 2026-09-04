import asyncio

from app_executor import FlowRunner


async def main():

    fr = FlowRunner()

    await fr.run_flow()


if __name__ == "__main__":
    asyncio.run(main())
