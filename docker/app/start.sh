#!/bin/sh
set -e

echo "Starting Leftover Chef app container..."

DB_CONNECTION="${DB_CONNECTION:-sqlsrv}"
DB_ENCRYPT_VALUE="${DB_ENCRYPT:-no}"
DB_TRUST_CERT_VALUE="${DB_TRUST_SERVER_CERTIFICATE:-true}"

if [ "${DB_CONNECTION}" = "sqlsrv" ]; then
  SQLSRV_DSN="sqlsrv:Server=${DB_HOST},${DB_PORT};Database=master;Encrypt=${DB_ENCRYPT_VALUE};TrustServerCertificate=${DB_TRUST_CERT_VALUE}"
  APP_SQLSRV_DSN="sqlsrv:Server=${DB_HOST},${DB_PORT};Database=${DB_DATABASE};Encrypt=${DB_ENCRYPT_VALUE};TrustServerCertificate=${DB_TRUST_CERT_VALUE}"
  export SQLSRV_DSN
  export APP_SQLSRV_DSN
elif [ "${DB_CONNECTION}" = "pgsql" ]; then
  APP_PGSQL_DSN="pgsql:host=${DB_HOST};port=${DB_PORT};dbname=${DB_DATABASE}"
  export APP_PGSQL_DSN
fi

if [ ! -f vendor/autoload.php ]; then
  echo "Missing vendor/autoload.php."
  echo "Install Composer dependencies on the host first so the vendor directory is available to Docker."
  exit 1
fi

if [ "${DB_CONNECTION}" = "sqlsrv" ]; then
  echo "Waiting for SQL Server at ${DB_HOST}:${DB_PORT}..."
  until php -r "try { new PDO(getenv('SQLSRV_DSN'), getenv('DB_USERNAME'), getenv('DB_PASSWORD')); exit(0); } catch (Throwable \$e) { fwrite(STDERR, \$e->getMessage() . PHP_EOL); exit(1); }"; do
    sleep 5
  done

  echo "Ensuring database ${DB_DATABASE} exists..."
  php -r "try {
    \$pdo = new PDO(getenv('SQLSRV_DSN'), getenv('DB_USERNAME'), getenv('DB_PASSWORD'));
    \$database = str_replace(']', ']]', getenv('DB_DATABASE'));
    \$pdo->exec(\"IF DB_ID(N'\" . \$database . \"') IS NULL CREATE DATABASE [\" . \$database . \"]\");
    echo 'Database ready.' . PHP_EOL;
  } catch (Throwable \$e) {
    fwrite(STDERR, 'Database bootstrap failed: ' . \$e->getMessage() . PHP_EOL);
    exit(1);
  }"

  echo "Waiting for database ${DB_DATABASE} to accept connections..."
  until php -r "try { new PDO(getenv('APP_SQLSRV_DSN'), getenv('DB_USERNAME'), getenv('DB_PASSWORD')); exit(0); } catch (Throwable \$e) { fwrite(STDERR, \$e->getMessage() . PHP_EOL); exit(1); }"; do
    sleep 2
  done
elif [ "${DB_CONNECTION}" = "pgsql" ]; then
  echo "Waiting for PostgreSQL at ${DB_HOST}:${DB_PORT}/${DB_DATABASE}..."
  until php -r "try { new PDO(getenv('APP_PGSQL_DSN'), getenv('DB_USERNAME'), getenv('DB_PASSWORD')); exit(0); } catch (Throwable \$e) { fwrite(STDERR, \$e->getMessage() . PHP_EOL); exit(1); }"; do
    sleep 2
  done
else
  echo "Unsupported DB_CONNECTION: ${DB_CONNECTION}"
  exit 1
fi

echo "Preparing Laravel..."
mkdir -p \
  storage/framework/cache/data \
  storage/framework/sessions \
  storage/framework/views \
  storage/logs \
  bootstrap/cache

chown -R www-data:www-data storage bootstrap/cache
chmod -R ug+rwX storage bootstrap/cache

if [ -z "${APP_KEY}" ]; then
  echo "Generating application key..."
  GENERATED_APP_KEY=$(php artisan key:generate --show --no-interaction)
  export APP_KEY="${GENERATED_APP_KEY}"

  if [ -f .env ]; then
    if grep -q '^APP_KEY=' .env; then
      sed -i "s|^APP_KEY=.*|APP_KEY=${GENERATED_APP_KEY}|" .env
    else
      echo "APP_KEY=${GENERATED_APP_KEY}" >> .env
    fi
  fi
else
  export APP_KEY
fi

php artisan config:clear || true
php artisan cache:clear || true

echo "Creating storage symlink..."
php artisan storage:link --force || true

echo "Running migrations..."
php artisan migrate --force

echo "Seeding database..."
php artisan db:seed --force

echo "Starting Apache..."
apache2-foreground
