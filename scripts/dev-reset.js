#!/usr/bin/env node
"use strict";

// Borra y recrea el contenedor/volumen de Postgres de apps/backend, corre
// las migraciones de las 4 bases, y deja todo listo para que `turbo run
// dev` levante backend + frontend. Pensado para el ciclo de "reconstruir
// varias veces" durante el desarrollo.
//
// Es un script de Node (no PowerShell) a propósito: la versión anterior
// era un .ps1 y el usuario reportó que "no se ejecuta" — la causa más
// común en Windows es la política de ejecución de PowerShell bloqueando
// scripts sin firmar. Node ya es una dependencia dura de este proyecto
// (hace falta para correr npm), así que `npm run dev` no puede fallar
// por esta razón.
//
// Uso:
//   npm run dev            -> reset completo + levanta todo
//   npm run dev:no-reset   -> sin borrar datos + levanta todo
//   node scripts/dev-reset.js [--skip-reset]   (invocación directa)

const { spawnSync } = require("child_process");
const path = require("path");

const BACKEND_DIR = path.join(__dirname, "..", "apps", "backend");
const CONTAINER_NAME = "val-backend-postgres";
const HEALTH_TIMEOUT_S = 60;

function log(message) {
  console.log(`\n==> ${message}`);
}

function run(command, args, opts = {}) {
  const result = spawnSync(command, args, { stdio: "inherit", shell: true, ...opts });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`"${command} ${args.join(" ")}" salió con código ${result.status}`);
  }
}

function silent(command, args, opts = {}) {
  return spawnSync(command, args, { stdio: "ignore", shell: true, ...opts });
}

// Docker Desktop moderno trae "docker compose" (plugin); algunas
// instalaciones viejas solo tienen el binario standalone "docker-compose".
// Se detecta una sola vez para no confundir un error real con "no existe
// el comando".
function detectCompose() {
  if (silent("docker", ["compose", "version"]).status === 0) {
    return ["docker", "compose"];
  }
  if (silent("docker-compose", ["version"]).status === 0) {
    return ["docker-compose"];
  }
  throw new Error(
    'No se encontró "docker compose" ni "docker-compose". ¿Está Docker Desktop instalado y corriendo?'
  );
}

function compose(cmd, args) {
  run(cmd[0], [...cmd.slice(1), ...args], { cwd: BACKEND_DIR });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitHealthy() {
  log("Esperando a que Postgres esté healthy...");
  for (let i = 0; i < HEALTH_TIMEOUT_S; i++) {
    const res = spawnSync(
      "docker",
      ["inspect", "--format={{.State.Health.Status}}", CONTAINER_NAME],
      { shell: true }
    );
    const status = res.stdout ? res.stdout.toString().trim() : "";
    if (status === "healthy") {
      console.log("Postgres listo.");
      return;
    }
    await wait(1000);
  }
  throw new Error(
    `Postgres no llegó a "healthy" después de ${HEALTH_TIMEOUT_S}s. Corre "docker compose logs" dentro de apps/backend para ver qué pasó.`
  );
}

async function main() {
  const skipReset = process.argv.includes("--skip-reset");
  const cmd = detectCompose();

  if (!skipReset) {
    log("Borrando contenedor y volumen de Postgres (down -v)");
    compose(cmd, ["down", "-v"]);

    // Defensa extra: si queda un contenedor con este nombre que "down -v"
    // no reconoció como suyo (p.ej. porque se creó bajo otro nombre de
    // proyecto de Compose — esto pasó una vez al mover esta carpeta de
    // ubicación, "Conflict: the container name ... is already in use"),
    // se borra a la fuerza acá. Es seguro: en esta rama ya se pidió
    // explícitamente borrar todo, así que no hay datos que proteger.
    silent("docker", ["rm", "-f", CONTAINER_NAME]);

    log("Creando contenedor de Postgres (up -d)");
    compose(cmd, ["up", "-d"]);
  } else {
    log("Asegurando que el contenedor de Postgres esté arriba (sin borrar datos)");
    compose(cmd, ["up", "-d"]);
  }

  await waitHealthy();

  log("Generando los 4 clientes Prisma (npm run db:generate)");
  run("npm", ["run", "db:generate"], { cwd: BACKEND_DIR });

  log("Corriendo migraciones en las 4 bases (npm run db:migrate)");
  run("npm", ["run", "db:migrate"], { cwd: BACKEND_DIR });

  // Idempotente (upsert por unique key) — se corre siempre, no solo en
  // reset completo, para que un `dev:no-reset` en una base ya poblada no
  // falle ni duplique nada.
  log("Poblando catálogo inicial de Market (npm run db:seed:market)");
  run("npm", ["run", "db:seed:market"], { cwd: BACKEND_DIR });

  log("Poblando roles y usuarios de prueba de Identity (npm run db:seed:user)");
  run("npm", ["run", "db:seed:user"], { cwd: BACKEND_DIR });

  log("Poblando catálogos de idioma/moneda/zona horaria (npm run db:seed:catalogs)");
  run("npm", ["run", "db:seed:catalogs"], { cwd: BACKEND_DIR });

  log("Poblando tipos de transacción de Portfolio (npm run db:seed:portfolio)");
  run("npm", ["run", "db:seed:portfolio"], { cwd: BACKEND_DIR });

  log("Listo — levantando backend (:3000) y frontend (:3001)...");
}

main().catch((err) => {
  console.error(`\nError: ${err.message}`);
  process.exit(1);
});
