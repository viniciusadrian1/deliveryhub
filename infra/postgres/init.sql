-- Cria banco shadow para Prisma (usado em prisma migrate dev)
SELECT 'CREATE DATABASE deliveryhub_shadow OWNER deliveryhub'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'deliveryhub_shadow')\gexec

-- Extensions necessárias
\c deliveryhub
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

\c deliveryhub_shadow
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;
