import psycopg2

conn = psycopg2.connect(
    "postgresql://cme:Azerty09%2B%2B@pg-matching-pfe.postgres.database.azure.com:5432/peap?sslmode=require"
)
cur = conn.cursor()

# List all tables in iam schema
cur.execute("""
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'iam'
    ORDER BY table_name
""")
print("Tables in iam schema:", [r[0] for r in cur.fetchall()])

# List all users
cur.execute("SELECT email, status FROM iam.auth_user ORDER BY email LIMIT 20")
rows = cur.fetchall()
print(f"\nUsers found: {len(rows)}")
for email, status in rows:
    print(f"  {email}  [{status}]")

conn.close()
