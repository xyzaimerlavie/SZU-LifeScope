import argparse
import time

from app import complete_walking_routes, missing_route_jobs


def main():
    parser = argparse.ArgumentParser(description="Complete cached AMap walking routes.")
    parser.add_argument("--minutes", type=int, default=30)
    parser.add_argument("--max-jobs", type=int, default=120)
    parser.add_argument("--rounds", type=int, default=1)
    args = parser.parse_args()

    for round_index in range(1, args.rounds + 1):
        before = len(missing_route_jobs(args.minutes))
        if before == 0:
            print({"round": round_index, "remaining": 0}, flush=True)
            break
        result = complete_walking_routes(args.minutes, args.max_jobs)
        result["round"] = round_index
        result["before"] = before
        print(result, flush=True)
        time.sleep(0.5)


if __name__ == "__main__":
    main()
