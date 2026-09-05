import asyncio
import sys


def run_self_test():
    print("[SELF-TEST] Checking packaged dependencies...")

    import playwright

    print("[OK] playwright")

    import groq

    print("[OK] groq")

    import pandas

    print("[OK] pandas")

    import requests

    print("[OK] requests")

    import openpyxl

    print("[OK] openpyxl")

    print("SELF_TEST_OK")


async def main():
    from app_executor import FlowRunner

    fr = FlowRunner()
    await fr.run_flow()


if __name__ == "__main__":
    if "--self-test" in sys.argv:
        run_self_test()
        sys.exit(0)

    asyncio.run(main())
