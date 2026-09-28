import { criarAppHttp } from "../src/composition.js";
import { RelogioFixo } from "../src/infrastructure/portas.js";
import { StatusConsulta } from "../src/domain/entidades.js";
import { randomUUID } from "node:crypto";

export const AGORA_PADRAO = "2026-09-28T12:00:00.000Z";

export async function sistemaTeste(iso = AGORA_PADRAO) {
  const relogio = new RelogioFixo(iso);
  const criado = await criarAppHttp({ relogio });
  await criado.app.ready();
  return { ...criado, relogio };
}

export async function cadastrarELogar(app, extra = {}) {
  const email = extra.email ?? `psico-${randomUUID()}@ex.com`;
  const senha = extra.senha ?? "segredo";
  const cadastro = await app.inject({
    method: "POST",
    url: "/psicologos",
    payload: {
      nome: extra.nome ?? "Dra. Ana",
      email,
      crp: extra.crp ?? "CRP-01/12345",
      whatsapp: extra.whatsapp ?? "11999999999",
      senha,
    },
  });
  const login = await app.inject({
    method: "POST",
    url: "/login",
    payload: { email, senha },
  });
  return {
    psicologoId: cadastro.json().id,
    token: login.json().token,
    headers: { authorization: `Bearer ${login.json().token}` },
  };
}

export async function configurarAgendaBasica(app, headers, diaSemana = 1) {
  await app.inject({
    method: "PUT",
    url: "/painel/modalidade",
    headers,
    payload: { presencial: { ativo: true, enderecoBase: "Rua A, 100" } },
  });
  const dias = Array.isArray(diaSemana) ? diaSemana : [diaSemana];
  for (const dia of dias) {
    await app.inject({
      method: "POST",
      url: "/painel/grades",
      headers,
      payload: {
        diaSemana: dia,
        horarioInicio: "08:00",
        horarioFim: "18:00",
        duracaoSessaoMinutos: 50,
        intervaloMinutos: 10,
      },
    });
  }
}

export async function agendar(app, psicologoId, { dataHoraInicio, cpf, email, nome, whatsapp }) {
  return app.inject({
    method: "POST",
    url: `/publico/psicologos/${psicologoId}/agendamentos`,
    payload: {
      nome: nome ?? "Paciente",
      email: email ?? "p@ex.com",
      cpf: cpf ?? "11111111111",
      whatsapp: whatsapp ?? "11988887777",
      dataHoraInicio,
    },
  });
}

export function inserirConsultaDireta(repo, dados) {
  repo.inserirConsulta({
    id: dados.id ?? randomUUID(),
    psicologoId: dados.psicologoId,
    pacienteId: dados.pacienteId,
    dataHoraInicio: dados.dataHoraInicio,
    dataHoraFim: dados.dataHoraFim,
    modalidade: dados.modalidade ?? "PRESENCIAL",
    localOuLink: dados.localOuLink ?? "Rua A, 100",
    status: dados.status ?? StatusConsulta.AGENDADO,
    tokenAcesso: dados.tokenAcesso ?? randomUUID(),
    anotacaoProntuario: dados.anotacaoProntuario ?? null,
    dataHoraCriacao: dados.dataHoraCriacao ?? AGORA_PADRAO,
    dataHoraUltimaAlteracao: dados.dataHoraUltimaAlteracao ?? AGORA_PADRAO,
  });
}
