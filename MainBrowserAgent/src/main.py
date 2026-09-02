import asyncio

from app_executor import flow_runner


async def main():

    fr= flow_runner.FlowRunner()
    
    await fr.run_flow()

if __name__ == "__main__":
    asyncio.run(main())
