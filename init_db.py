from app import DB_FILE, ensure_database


if __name__ == "__main__":
    ensure_database()
    print(f"SQLite database is ready: {DB_FILE}")
