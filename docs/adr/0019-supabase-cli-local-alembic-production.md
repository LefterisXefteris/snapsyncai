# Local database is `supabase start`; production is the existing cloud project

Local FastAPI uses the Supabase CLI stack on this machine (`supabase start`: Postgres + Storage). Production FastAPI on Railway uses `DATABASE_URL` for the existing cloud Supabase project’s Session pooler. Those are two databases, not two environments inside one. Compose Postgres is gone so local work cannot silently share production data. Schema stays Alembic (`alembic upgrade head` against whichever URL the environment has); we are not switching to `supabase/migrations` or `db push` in this cutover.

**Considered:** a persistent `develop` branch on the production project (still a second database, easy to mix URLs); two cloud projects with the laptop pointed at the “dev” one; replacing Alembic with CLI migrations. Rejected for this cutover: the first two still put daily local work on a network database, and dual migrators recreate the mapping confusion.
