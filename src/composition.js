import { CasosDeUso } from "./application/casos-de-uso.js";
import { montarHttp } from "./http/app.js";
import { novaChaveAes } from "./infrastructure/crypto.js";
import { CorreioMemoria, RelogioSistema, SessoesMemoria, WhatsAppMemoria } from "./infrastructure/portas.js";
import { criarBanco, RepositorioSqlite } from "./infrastructure/repositorio-sqlite.js";

export function criarSistema(opcoes = {}) {
  const db = opcoes.db ?? criarBanco();
  const repo = new RepositorioSqlite(db);
  const relogio = opcoes.relogio ?? new RelogioSistema();
  const correio = opcoes.correio ?? new CorreioMemoria();
  const whatsapp = opcoes.whatsapp ?? new WhatsAppMemoria();
  const sessoes = opcoes.sessoes ?? new SessoesMemoria();
  const chaveAes = opcoes.chaveAes ?? novaChaveAes();
  const casos = new CasosDeUso({
    repo,
    relogio,
    correio,
    whatsapp,
    sessoes,
    chaveAes,
    urlBase: opcoes.urlBase ?? "http://localhost",
  });
  return { db, repo, relogio, correio, whatsapp, sessoes, chaveAes, casos };
}

export async function criarAppHttp(opcoes = {}) {
  const sistema = criarSistema(opcoes);
  const app = await montarHttp({ casos: sistema.casos });
  return { app, ...sistema };
}
